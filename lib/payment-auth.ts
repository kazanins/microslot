import type { PaymentChallenge, PaymentCredential } from '@/types'
import { randomBytes } from 'crypto'
import { encodeFunctionData, parseUnits } from 'viem'
import { TEMPO_CONFIG } from './tempo'

const TIP20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Generate a cryptographically random challenge ID
export function generateChallengeId(): string {
  return randomBytes(16).toString('base64url')
}

// Create WWW-Authenticate: Payment header
export function createPaymentChallenge(challengeData: {
  to: `0x${string}`
  amount: number
  token: `0x${string}`
  validForSeconds?: number
}): PaymentChallenge {
  const challengeId = generateChallengeId()
  const amountWei = parseUnits(
    challengeData.amount.toString(),
    TEMPO_CONFIG.pathUsdDecimals
  )
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + (challengeData.validForSeconds ?? 120)
  )

  const data = encodeFunctionData({
    abi: TIP20_ABI,
    functionName: 'transfer',
    args: [challengeData.to, amountWei],
  })

  const request = {
    transaction: {
      to: challengeData.token,
      data,
      validBefore: `0x${validBefore.toString(16)}`,
    },
  }

  const requestBase64 = Buffer.from(JSON.stringify(request)).toString('base64url')

  return {
    id: challengeId,
    realm: 'microslot-casino',
    method: 'tempo',
    intent: 'charge',
    request: requestBase64,
  }
}

// Format WWW-Authenticate header value
export function formatAuthenticateHeader(challenge: PaymentChallenge): string {
  return `Payment id="${challenge.id}", realm="${challenge.realm}", method="${challenge.method}", intent="${challenge.intent}", request="${challenge.request}"`
}

// Parse Authorization: Payment header
export function parsePaymentCredential(authHeader: string): PaymentCredential | null {
  try {
    // Remove "Payment " prefix
    const token68 = authHeader.replace(/^Payment\s+/i, '')

    // Decode base64url
    const decoded = Buffer.from(token68, 'base64url').toString('utf-8')
    const credential = JSON.parse(decoded) as PaymentCredential

    return credential
  } catch (error) {
    console.error('Failed to parse payment credential:', error)
    return null
  }
}

// Create Payment-Receipt header
export function createPaymentReceipt(data: {
  status: 'success' | 'failed'
  method: string
  timestamp: string
  reference: string
}): string {
  const receipt = JSON.stringify(data)
  return Buffer.from(receipt).toString('base64url')
}

// Generate error response for 402/401
export function createPaymentError(code: string, message: string, statusCode: 402 | 401 = 402) {
  return {
    statusCode,
    body: {
      error: code,
      message,
    },
  }
}
