// Activity Log Types
export type ActivityLogEntry = {
  id: string
  timestamp: Date
  type: 'auth' | 'deposit' | 'spin' | 'payment' | 'win' | 'prize' | 'transaction' | 'error'
  message: string
  txHash?: string
  details?: Record<string, unknown>
}

// Slot Machine Types
export type SlotSymbol = '🍒' | '🍋' | '🍊' | '🍇' | '💎' | '7️⃣'

export type SpinResult = {
  combination: [SlotSymbol, SlotSymbol, SlotSymbol]
  isWin: boolean
  remainingBalance: number
  txHash: string
}

// Access Key Types
export type AccessKeyLimit = {
  token: `0x${string}`
  amount: string
}

export type KeyAuthorization = {
  chainId: string
  keyId: `0x${string}`
  keyType: string
  expiry: string
  limits: AccessKeyLimit[]
}

import type { KeyAuthorization } from 'ox/tempo'

export type AccessKeySession = {
  accessKeyAddress: `0x${string}`
  accessKeyPair: {
    publicKeyRaw: `0x${string}`
    privateKeyJwk: JsonWebKey
  }
  keyAuthorization?: KeyAuthorization.Rpc
  depositedAmount: number
  remainingBalance: number
}

// HTTP Payment Authentication Types
export type PaymentChallenge = {
  id: string
  realm: string
  method: string
  intent: string
  request: string // base64url-encoded JSON
}

export type PaymentCredential = {
  id: string
  payload: unknown
}

// API Response Types
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

export type SignupResponse = {
  address: `0x${string}`
  funded: boolean
}

export type AccessKeyResponse = {
  success: boolean
  depositedAmount: number
  remainingBalance: number
}

export type PrizeResponse = {
  txHash: string
  amount: string
}
