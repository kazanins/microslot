import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
import { tempoModerato } from '@/lib/wagmi'
import { TEMPO_CONFIG } from '@/lib/tempo'

const rpcUser = process.env.TEMPO_RPC_USER
const rpcPass = process.env.TEMPO_RPC_PASS
const rpcHeaders = rpcUser && rpcPass
  ? { Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPass}`).toString('base64')}` }
  : undefined

const CACHE_TTL = 10_000
const COOLDOWN_TTL = 30_000
const balanceCache = globalThis as unknown as {
  microslotBalanceCache?: Map<string, { balance: number; updatedAt: number }>
  microslotBalanceCooldown?: Map<string, number>
  microslotBalanceInFlight?: Map<string, Promise<number | null>>
}

if (!balanceCache.microslotBalanceCache) {
  balanceCache.microslotBalanceCache = new Map()
}

if (!balanceCache.microslotBalanceCooldown) {
  balanceCache.microslotBalanceCooldown = new Map()
}

if (!balanceCache.microslotBalanceInFlight) {
  balanceCache.microslotBalanceInFlight = new Map()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimitError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error ? String(error.message) : ''
  const details = 'details' in error ? String(error.details) : ''
  return message.includes('429') || message.includes('too many connections') || details.includes('too many connections')
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 2, baseDelay = 300): Promise<T> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (isRateLimitError(error) || attempt === retries) {
        throw error
      }
      await wait(baseDelay * (attempt + 1))
    }
  }

  throw lastError
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  const txHash = request.nextUrl.searchParams.get('txHash')

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 })
  }

  const cacheKey = address.toLowerCase()
  const cached = balanceCache.microslotBalanceCache?.get(cacheKey)
  const now = Date.now()
  const lastAttempt = balanceCache.microslotBalanceCooldown?.get(cacheKey)

  if (!txHash && cached && now - cached.updatedAt < CACHE_TTL) {
    return NextResponse.json({ balance: cached.balance, cached: true })
  }

  if (!txHash && lastAttempt && now - lastAttempt < COOLDOWN_TTL) {
    return NextResponse.json({ balance: cached?.balance ?? null, cached: !!cached, stale: true })
  }

  const inFlight = balanceCache.microslotBalanceInFlight?.get(cacheKey)
  if (inFlight) {
    const inFlightBalance = await inFlight
    return NextResponse.json({ balance: inFlightBalance ?? cached?.balance ?? null, cached: !!cached, stale: true })
  }

  balanceCache.microslotBalanceCooldown?.set(cacheKey, now)

  const fetchPromise = (async () => {
    const publicClient = createPublicClient({
      chain: tempoModerato,
      transport: rpcHeaders
        ? http(TEMPO_CONFIG.rpcUrl, { fetchOptions: { headers: rpcHeaders } })
        : http(TEMPO_CONFIG.rpcUrl),
    })

    if (txHash) {
      await withRetry(() => publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` }))
    }

    const balanceWei = await withRetry(() => publicClient.readContract({
      address: TEMPO_CONFIG.pathUsdAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    }), 1, 500)

    const balance = Number(formatUnits(balanceWei, TEMPO_CONFIG.pathUsdDecimals))
    balanceCache.microslotBalanceCache?.set(cacheKey, { balance, updatedAt: Date.now() })
    return balance
  })()

  balanceCache.microslotBalanceInFlight?.set(cacheKey, fetchPromise)

  try {
    const balance = await fetchPromise
    return NextResponse.json({ balance })
  } catch (error) {
    console.error('Failed to fetch balance:', error)

    if (cached) {
      return NextResponse.json({ balance: cached.balance, cached: true, stale: true })
    }

    return NextResponse.json({ balance: null, stale: true })
  } finally {
    balanceCache.microslotBalanceInFlight?.delete(cacheKey)
  }
}
