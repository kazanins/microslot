import { NextRequest, NextResponse } from 'next/server'
import { hashMessage, hexToBytes, parseUnits } from 'viem'
import { Address, PublicKey } from 'ox'
import { SignatureEnvelope } from 'ox/tempo'
import { getAccessKey, updateBalance, storeChallenge, getChallenge, deleteChallenge, setAccessKey } from '@/lib/session-store'
import { createPaymentChallenge, formatAuthenticateHeader, parsePaymentCredential, createPaymentReceipt, createPaymentError } from '@/lib/payment-auth'
import { generateSlotCombination, isWinningCombination, TEMPO_CONFIG } from '@/lib/tempo'
import { getCasinoAddress } from '@/lib/casino-wallet'
import { sendPrizeToUser } from '@/lib/tempo-transfers'
import { executeAccessKeyTransfer, getAccessKeyTransferContext, getRemainingAccessKeyLimit } from '@/lib/access-key-transfer'
import type { AccessKeySession } from '@/types'

const SPIN_COST = 1 // $1 per spin
const PRIZE_AMOUNT = 1000 // $1000 per win

function createPaymentMessage(challengeId: string, request: string) {
  return `microslot:${challengeId}:${request}`
}


export async function GET(request: NextRequest) {
  try {
    // Get user address from query or header
    const userAddress = request.nextUrl.searchParams.get('address')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('Authorization')

    if (!authHeader?.startsWith('Payment ')) {
      return return402PaymentRequired(userAddress)
    }

    return await handlePaymentCredential(authHeader, userAddress)
  } catch (error) {
    console.error('Spin error:', error)
    return NextResponse.json(
      { error: 'Spin failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function return402PaymentRequired(userAddress: string) {
  const challenge = createPaymentChallenge({
    to: getCasinoAddress(),
    amount: SPIN_COST,
    token: TEMPO_CONFIG.pathUsdAddress,
  })

  storeChallenge(userAddress, challenge)

  const authenticateHeader = formatAuthenticateHeader(challenge)
  const error = createPaymentError('payment_required', 'Payment required to spin')

  return new NextResponse(JSON.stringify(error.body), {
    status: 402,
    headers: {
      'WWW-Authenticate': authenticateHeader,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function handlePaymentCredential(authHeader: string, userAddress: string) {
  const credential = parsePaymentCredential(authHeader)

  if (!credential) {
    return return401PaymentRequired(userAddress, 'malformed_proof', 'Invalid payment credential')
  }

  const challenge = getChallenge(userAddress, credential.id)

  if (!challenge) {
    return return401PaymentRequired(userAddress, 'payment_expired', 'Challenge not found or expired')
  }

  const payload = credential.payload as { signature?: string; accessKeyAddress?: `0x${string}` }

  if (!payload?.signature || !payload.accessKeyAddress) {
    deleteChallenge(userAddress, challenge.id)
    return return401PaymentRequired(userAddress, 'malformed_proof', 'Payment credential missing fields')
  }

  const accessKey = getAccessKey(userAddress)

  if (!accessKey || accessKey.remainingBalance < SPIN_COST) {
    deleteChallenge(userAddress, challenge.id)
    return return401PaymentRequired(userAddress, 'payment_required', 'Access key missing or insufficient balance')
  }

  if (accessKey.accessKeyAddress.toLowerCase() !== payload.accessKeyAddress.toLowerCase()) {
    deleteChallenge(userAddress, challenge.id)
    return return401PaymentRequired(userAddress, 'payment_verification_failed', 'Access key mismatch')
  }

  const message = createPaymentMessage(challenge.id, challenge.request)
  const hash = hashMessage(message)

  let isValid = false

  try {
    const rawSignature = payload.signature as `0x${string}`
    const signature = rawSignature.endsWith(SignatureEnvelope.magicBytes.slice(2))
      ? rawSignature
      : (rawSignature + SignatureEnvelope.magicBytes.slice(2)) as `0x${string}`

    const envelope = SignatureEnvelope.deserialize(signature)
    const publicKey = PublicKey.from(hexToBytes(accessKey.accessKeyPair.publicKeyRaw))
    const derivedAddress = Address.fromPublicKey(publicKey)

    if (!Address.isEqual(derivedAddress, accessKey.accessKeyAddress)) {
      deleteChallenge(userAddress, challenge.id)
      return return401PaymentRequired(
        userAddress,
        'payment_verification_failed',
        'Access key address mismatch'
      )
    }

    isValid = SignatureEnvelope.verify(envelope, {
      publicKey,
      payload: hash,
    })
  } catch (error) {
    console.error('Payment signature verification failed:', error)
  }

  if (!isValid) {
    deleteChallenge(userAddress, challenge.id)
    return return401PaymentRequired(userAddress, 'payment_verification_failed', 'Payment signature invalid')
  }

  deleteChallenge(userAddress, challenge.id)

  return await executeSpin(userAddress, accessKey)
}

function return401PaymentRequired(userAddress: string, code: string, message: string) {
  const challenge = createPaymentChallenge({
    to: getCasinoAddress(),
    amount: SPIN_COST,
    token: TEMPO_CONFIG.pathUsdAddress,
  })

  storeChallenge(userAddress, challenge)

  const authenticateHeader = formatAuthenticateHeader(challenge)
  const error = createPaymentError(code, message, 401)

  return new NextResponse(JSON.stringify(error.body), {
    status: 401,
    headers: {
      'WWW-Authenticate': authenticateHeader,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function executeSpin(userAddress: string, accessKey: AccessKeySession) {
  // Generate random combination
  const combination = generateSlotCombination()
  const isWin = isWinningCombination(combination)

  let spinTxHash: `0x${string}`
  let newBalance = accessKey.remainingBalance

  const spinCostWei = parseUnits(SPIN_COST.toString(), TEMPO_CONFIG.pathUsdDecimals)
  const feeBufferWei = parseUnits('0.01', TEMPO_CONFIG.pathUsdDecimals)

  try {
    let remainingLimitWei: bigint | null = null

    if (accessKey.keyAuthorization?.limits?.[0]?.limit) {
      remainingLimitWei = BigInt(accessKey.keyAuthorization.limits[0].limit)
    } else {
      const context = await getAccessKeyTransferContext(
        accessKey.accessKeyPair,
        userAddress as `0x${string}`
      )

      remainingLimitWei = await getRemainingAccessKeyLimit(
        context,
        userAddress as `0x${string}`
      )
    }

    if (remainingLimitWei !== null) {
      const remainingLimitDollars = Number(remainingLimitWei) / 10 ** TEMPO_CONFIG.pathUsdDecimals
      newBalance = Math.min(accessKey.remainingBalance, remainingLimitDollars)
      updateBalance(userAddress, newBalance)

      if (remainingLimitWei < spinCostWei + feeBufferWei) {
        return return401PaymentRequired(
          userAddress,
          'payment_required',
          'Access key balance depleted'
        )
      }
    }
  } catch (error) {
    console.warn('Failed to load remaining access key limit:', error)
  }

  try {
    console.log(`💸 Executing REAL on-chain transfer of $${SPIN_COST} from user to casino...`)

    // Execute REAL on-chain transfer using the access key
    // This pulls $1 pathUSD from user's account to casino
    spinTxHash = (await executeAccessKeyTransfer(
      accessKey.accessKeyPair,
      getCasinoAddress(),
      SPIN_COST,
      userAddress as `0x${string}`,
      accessKey.keyAuthorization
    )) as `0x${string}`

    console.log(`✅ Spin cost transferred! TX: ${spinTxHash}`)

    // Update balance after successful on-chain transfer
    newBalance = Math.max(newBalance - SPIN_COST, 0)
    updateBalance(userAddress, newBalance)

    if (accessKey.keyAuthorization) {
      setAccessKey(userAddress, {
        ...accessKey,
        keyAuthorization: undefined,
        remainingBalance: newBalance,
      })
    }
  } catch (error) {
    console.error('❌ Failed to execute spin transfer:', error)
    throw new Error('Failed to deduct spin cost: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }

  let prizeTxHash: string | undefined

  // If win, send real prize!
  if (isWin) {
    try {
      console.log(`🎉 User ${userAddress} won! Sending $${PRIZE_AMOUNT} prize...`)

      // Send REAL on-chain transfer from casino to winner
      prizeTxHash = await sendPrizeToUser(userAddress as `0x${string}`, PRIZE_AMOUNT)

      console.log(`✅ Prize sent! TX: ${prizeTxHash}`)
    } catch (error) {
      console.error('Failed to send prize:', error)
      // Don't fail the spin if prize sending fails
      prizeTxHash = undefined
    }
  }

  // Create payment receipt
  const receipt = createPaymentReceipt({
    status: 'success',
    method: 'tempo',
    timestamp: new Date().toISOString(),
    reference: spinTxHash,
  })

  return NextResponse.json(
    {
      combination,
      isWin,
      remainingBalance: newBalance,
      txHash: spinTxHash,
      ...(prizeTxHash && { prizeTxHash }),
    },
    {
      headers: {
        'Payment-Receipt': receipt,
        'Cache-Control': 'private',
      },
    }
  )
}
