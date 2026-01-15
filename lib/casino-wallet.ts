import { randomBytes } from 'crypto'
import { createWalletClient, http, type Address, type WalletClient, publicActions } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from './wagmi'

let casinoWalletClient: WalletClient | null = null
let casinoAddress: Address | null = null

// Initialize casino wallet from private key
export function initializeCasinoWallet(): { client: WalletClient; address: Address } {
  if (casinoWalletClient && casinoAddress) {
    return { client: casinoWalletClient, address: casinoAddress }
  }

  const privateKey = process.env.CASINO_PRIVATE_KEY as `0x${string}`

  if (!privateKey) {
    throw new Error('CASINO_PRIVATE_KEY not set in environment variables')
  }

  const account = privateKeyToAccount(privateKey)
  casinoAddress = account.address

  casinoWalletClient = createWalletClient({
    account,
    chain: tempoModerato,
    transport: http(),
  }).extend(publicActions)

  return { client: casinoWalletClient, address: casinoAddress }
}

// Get casino wallet address
export function getCasinoAddress(): Address {
  if (!casinoAddress) {
    const { address } = initializeCasinoWallet()
    return address
  }
  return casinoAddress
}

// Get casino wallet client
export function getCasinoClient(): WalletClient {
  if (!casinoWalletClient) {
    const { client } = initializeCasinoWallet()
    return client
  }
  return casinoWalletClient
}

// Generate a new casino wallet (for initial setup)
export function generateCasinoWallet() {
  const privateKey = `0x${randomBytes(32).toString('hex')}` as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  return {
    privateKey,
    address: account.address,
  }
}
