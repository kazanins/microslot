import { createWalletClient, createPublicClient, http, type Address, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from './wagmi'
import { TEMPO_CONFIG } from './tempo'

const rpcUser = process.env.TEMPO_RPC_USER
const rpcPass = process.env.TEMPO_RPC_PASS
const rpcHeaders = rpcUser && rpcPass
  ? { Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPass}`).toString('base64')}` }
  : undefined

// TIP-20 (ERC-20) ABI for transfer function
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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Create public client for reading
export function getPublicClient() {
  return createPublicClient({
    chain: tempoModerato,
    transport: rpcHeaders
      ? http(TEMPO_CONFIG.rpcUrl, { fetchOptions: { headers: rpcHeaders } })
      : http(TEMPO_CONFIG.rpcUrl),
  })
}

// Create casino wallet client
export function getCasinoWalletClient() {
  const privateKey = process.env.CASINO_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('CASINO_PRIVATE_KEY not configured')
  }

  const account = privateKeyToAccount(privateKey)

  return createWalletClient({
    account,
    chain: tempoModerato,
    transport: rpcHeaders
      ? http(TEMPO_CONFIG.rpcUrl, { fetchOptions: { headers: rpcHeaders } })
      : http(TEMPO_CONFIG.rpcUrl),
  })
}

// Get pathUSD balance
export async function getPathUSDBalance(address: Address): Promise<bigint> {
  const publicClient = getPublicClient()

  const balance = await publicClient.readContract({
    address: TEMPO_CONFIG.pathUsdAddress,
    abi: TIP20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })

  return balance
}

// Transfer pathUSD from casino to user (for prizes)
export async function sendPrizeToUser(userAddress: Address, amountDollars: number): Promise<string> {
  const casinoClient = getCasinoWalletClient()
  const amount = parseUnits(amountDollars.toString(), TEMPO_CONFIG.pathUsdDecimals)

  const txHash = await casinoClient.writeContract({
    address: TEMPO_CONFIG.pathUsdAddress,
    abi: TIP20_ABI,
    functionName: 'transfer',
    args: [userAddress, amount],
  })

  return txHash
}

// Note: For user-to-casino transfers (spin cost), we would use access keys
// Access keys allow the casino to pull funds from the user's account
// This is implemented in the access key authorization flow
