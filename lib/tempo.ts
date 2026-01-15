import { type Address, parseUnits } from 'viem'

// Tempo testnet configuration
export const TEMPO_CONFIG = {
  chainId: 42431,
  rpcUrl: process.env.NEXT_PUBLIC_TEMPO_RPC_URL || 'https://rpc.moderato.tempo.xyz',
  explorerUrl: process.env.NEXT_PUBLIC_TEMPO_EXPLORER || 'https://explore.tempo.xyz',
  pathUsdAddress: (process.env.NEXT_PUBLIC_PATH_USD_ADDRESS || '0x20c0000000000000000000000000000000000000') as Address,
  pathUsdDecimals: 6,
  faucetUrl: process.env.FAUCET_URL || 'https://tiny-faucet.up.railway.app/api/fund',
} as const

// Helper to convert dollar amounts to pathUSD wei
export function dollarsToPathUSD(dollars: number): bigint {
  return parseUnits(dollars.toString(), TEMPO_CONFIG.pathUsdDecimals)
}

// Helper to format pathUSD wei to dollar display
export function pathUSDToDollars(wei: bigint): number {
  return Number(wei) / 10 ** TEMPO_CONFIG.pathUsdDecimals
}

// Helper to get transaction explorer URL
export function getTransactionUrl(txHash: string): string {
  return `${TEMPO_CONFIG.explorerUrl}/tx/${txHash}`
}

// Helper to get address explorer URL
export function getAddressUrl(address: string): string {
  return `${TEMPO_CONFIG.explorerUrl}/address/${address}`
}

// Slot machine symbols with probabilities
export const SLOT_SYMBOLS = {
  '🍒': 0.30,
  '🍋': 0.25,
  '🍊': 0.20,
  '🍇': 0.15,
  '💎': 0.08,
  '7️⃣': 0.02,
} as const

export type SlotSymbol = keyof typeof SLOT_SYMBOLS

// Generate random slot combination
export function generateSlotCombination(): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const symbols = Object.keys(SLOT_SYMBOLS) as SlotSymbol[]
  const probabilities = Object.values(SLOT_SYMBOLS)

  const getRandomSymbol = (): SlotSymbol => {
    const rand = Math.random()
    let cumulative = 0

    for (let i = 0; i < symbols.length; i++) {
      cumulative += probabilities[i]
      if (rand < cumulative) {
        return symbols[i]
      }
    }

    return symbols[symbols.length - 1]
  }

  return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
}

// Check if combination is a win (all three match)
export function isWinningCombination(combination: [SlotSymbol, SlotSymbol, SlotSymbol]): boolean {
  return combination[0] === combination[1] && combination[1] === combination[2]
}

// Calculate win probability
export function calculateWinProbability(): number {
  return Object.values(SLOT_SYMBOLS).reduce((sum, prob) => sum + (prob * prob * prob), 0)
}
