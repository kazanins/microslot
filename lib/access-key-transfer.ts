import { createWalletClient, createPublicClient, http, type Address, parseUnits, hexToBytes, zeroAddress, getAddress } from 'viem'
import { Address as OxAddress, PublicKey } from 'ox'
import { KeyAuthorization, SignatureEnvelope } from 'ox/tempo'
import { Account, Actions, Abis } from 'viem/tempo'
import { tempoModerato } from './wagmi'
import { TEMPO_CONFIG } from './tempo'

const rpcUser = process.env.TEMPO_RPC_USER
const rpcPass = process.env.TEMPO_RPC_PASS
const rpcHeaders = rpcUser && rpcPass
  ? { Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPass}`).toString('base64')}` }
  : undefined

/**
 * Execute a transfer using an access key
 * This allows the casino to pull funds from the user's account
 */
export type AccessKeyTransferContext = {
  publicClient: ReturnType<typeof createPublicClient>
  accessKeyAccount: ReturnType<typeof Account.fromWebCryptoP256>
  accessKeyAddress: Address
}

export async function getAccessKeyTransferContext(
  accessKeyPair: {
    publicKeyRaw: `0x${string}`
    privateKeyJwk: JsonWebKey
  },
  userAddress: Address
): Promise<AccessKeyTransferContext> {
  console.log('  Importing private key from JWK...')
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    accessKeyPair.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const chainWithFeeToken = {
    ...tempoModerato,
    feeToken: TEMPO_CONFIG.alphaUsdAddress,
  } as const

  const rpcTransport = rpcHeaders
    ? http(TEMPO_CONFIG.rpcUrl, { fetchOptions: { headers: rpcHeaders } })
    : http(TEMPO_CONFIG.rpcUrl)

  const publicClient = createPublicClient({
    chain: chainWithFeeToken,
    transport: rpcTransport,
  })

  const publicKey = PublicKey.from(hexToBytes(accessKeyPair.publicKeyRaw))
  const accessKeyAccountWithoutAccess = Account.fromWebCryptoP256({
    publicKey,
    privateKey,
  })
  console.log('  Access key OWN address (without access):', accessKeyAccountWithoutAccess.address)
  console.log('  Access key expected address:', OxAddress.fromPublicKey(publicKey))

  const accessKeyAccount = Account.fromWebCryptoP256(
    { publicKey, privateKey },
    { access: userAddress }
  )

  console.log('  Access key account created:')
  console.log('    - Address:', accessKeyAccount.address)
  console.log('    - Type:', accessKeyAccount.type)
  console.log('    - Source:', accessKeyAccount.source)

  return {
    publicClient,
    accessKeyAccount,
    accessKeyAddress: accessKeyAccountWithoutAccess.address,
  }
}

export async function getRemainingAccessKeyLimit(
  context: AccessKeyTransferContext,
  userAddress: Address
): Promise<bigint> {
  const keychainAddress = getAddress('0xaaaaaaaa00000000000000000000000000000000')
  return context.publicClient.readContract({
    address: keychainAddress,
    abi: Abis.accountKeychain,
    functionName: 'getRemainingLimit',
    args: [userAddress, context.accessKeyAddress, TEMPO_CONFIG.alphaUsdAddress],
  })
}

export async function executeAccessKeyTransfer(
  accessKeyPair: {
    publicKeyRaw: `0x${string}`
    privateKeyJwk: JsonWebKey
  },
  toAddress: Address,
  amountDollars: number,
  userAddress: Address, // The parent account that this access key can spend from
  keyAuthorization?: KeyAuthorization.Rpc
): Promise<string> {
  try {
    console.log('executeAccessKeyTransfer called')
    console.log('  userAddress (parent):', userAddress)
    console.log('  toAddress:', toAddress)
    console.log('  amount:', amountDollars)

    const { publicClient, accessKeyAccount, accessKeyAddress } = await getAccessKeyTransferContext(
      accessKeyPair,
      userAddress
    )

    if (!keyAuthorization) {
      const keyInfo = await publicClient.readContract({
        address: getAddress('0xaaaaaaaa00000000000000000000000000000000'),
        abi: Abis.accountKeychain,
        functionName: 'getKey',
        args: [userAddress, accessKeyAddress],
      })

      console.log('  Access key on-chain status:', keyInfo)

      if (keyInfo.keyId === zeroAddress || keyInfo.isRevoked) {
        throw new Error('Access key not found or revoked on-chain')
      }
    }

    const accessKeyClient = createWalletClient({
      account: accessKeyAccount,
      chain: {
        ...tempoModerato,
        feeToken: TEMPO_CONFIG.alphaUsdAddress,
      },
      transport: rpcHeaders
        ? http(TEMPO_CONFIG.rpcUrl, { fetchOptions: { headers: rpcHeaders } })
        : http(TEMPO_CONFIG.rpcUrl),
    })

    console.log('  Access key account created:')
    console.log('    - Address:', accessKeyAccount.address)
    console.log('    - Type:', accessKeyAccount.type)
    console.log('    - Source: accessKey')

    // Create a TIP-20 transfer transaction
    const amount = parseUnits(amountDollars.toString(), TEMPO_CONFIG.alphaUsdDecimals)
    console.log(`Transferring ${amountDollars} AlphaUSD (${amount} wei) from ${userAddress} to ${toAddress}`)

    console.log('Executing access-key transfer...')

    const normalizedKeyAuthorization = keyAuthorization
      ? KeyAuthorization.from({
          address: keyAuthorization.keyId,
          type: keyAuthorization.keyType,
          signature: SignatureEnvelope.fromRpc(keyAuthorization.signature),
          ...(keyAuthorization.chainId && keyAuthorization.chainId !== '0x'
            ? { chainId: BigInt(keyAuthorization.chainId) }
            : {}),
          ...(keyAuthorization.expiry && keyAuthorization.expiry !== '0x' && keyAuthorization.expiry !== '0x0'
            ? { expiry: Number(keyAuthorization.expiry) }
            : {}),
          ...(keyAuthorization.limits
            ? {
                limits: keyAuthorization.limits.map((limit) => ({
                  token: limit.token,
                  limit: BigInt(limit.limit),
                })),
              }
            : {}),
        })
      : undefined

    const transferCall = Actions.token.transfer.call({
      amount,
      to: toAddress,
      token: TEMPO_CONFIG.alphaUsdAddress,
    })

    let gasEstimate: bigint | null = null

    try {
      gasEstimate = await publicClient.estimateContractGas({
        ...transferCall,
        account: accessKeyAccount,
        feeToken: TEMPO_CONFIG.alphaUsdAddress,
        keyAuthorization: normalizedKeyAuthorization,
      } as any)
    } catch (error) {
      console.warn('  Gas estimate failed, using fallback limit:', error)
    }

    const gasFloor = BigInt(300000)
    const gasLimit = gasEstimate ? gasEstimate * BigInt(3) : gasFloor
    const finalGasLimit = gasLimit > gasFloor ? gasLimit : gasFloor
    console.log(
      '  Gas limit:',
      finalGasLimit.toString(),
      gasEstimate ? `(estimate ${gasEstimate.toString()})` : '(fallback)'
    )

    const txHash = await Actions.token.transfer(accessKeyClient, {
      account: accessKeyAccount,
      amount,
      to: toAddress,
      token: TEMPO_CONFIG.alphaUsdAddress,
      feeToken: TEMPO_CONFIG.alphaUsdAddress,
      keyAuthorization: normalizedKeyAuthorization,
      gas: finalGasLimit,
    } as any)

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status && receipt.status !== 'success') {
      throw new Error(`Spin transfer reverted: ${receipt.status}`)
    }

    console.log('✅ Transfer executed! TX:', receipt.transactionHash)
    return receipt.transactionHash

  } catch (error) {
    console.error('❌ Access key transfer failed:', error)
    throw error
  }
}
