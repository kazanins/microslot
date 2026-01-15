'use client'

import { GamePanel } from '@/components/GamePanel'
import { ActivityLog } from '@/components/ActivityLog'
import { AuthButtons } from '@/components/AuthButtons'
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { getAddressUrl } from '@/lib/tempo'
import type { ActivityLogEntry } from '@/types'

const balanceStorageKey = (account: string) => `microslot-balance:${account.toLowerCase()}`

const readStoredBalance = (account: string) => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(balanceStorageKey(account))
  if (!stored) return null
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : null
}

const storeBalance = (account: string, value: number) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(balanceStorageKey(account), value.toString())
}

export default function Home() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const [balance, setBalance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { address, isConnected } = useAccount()

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchOnChainBalance = useCallback(async (accountAddress: string, txHash?: `0x${string}`) => {
    const params = new URLSearchParams({ address: accountAddress })

    if (txHash) {
      params.set('txHash', txHash)
    }

    const response = await fetch(`/api/balance?${params.toString()}`)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      console.warn('Balance fetch failed:', response.status, errorBody)
      return null
    }

    const data = (await response.json()) as { balance: number | null }

    if (data.balance === null) {
      return null
    }

    setBalance(data.balance)
    storeBalance(accountAddress, data.balance)
    return data.balance
  }, [])

  const refreshBalance = useCallback(async (txHash?: `0x${string}`): Promise<void> => {
    if (!address || isRefreshing) return

    setIsRefreshing(true)
    try {
      await fetchOnChainBalance(address, txHash)
    } finally {
      setIsRefreshing(false)
    }
  }, [address, fetchOnChainBalance, isRefreshing])

  useEffect(() => {
    if (!mounted) return

    if (!isConnected || !address) {
      setBalance(0)
      return
    }

    const storedBalance = readStoredBalance(address)
    if (storedBalance !== null) {
      setBalance(storedBalance)
    }

    void fetchOnChainBalance(address)
  }, [address, fetchOnChainBalance, isConnected, mounted])

  const addLog = (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      timestamp: new Date(),
    }
    setLogs((prev) => [...prev, newEntry])
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              MicroSlot
            </h1>
            <p className="text-neutral-500 text-xs mt-1">
              Rethinking x402
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                Account Balance
              </span>
              <button
                type="button"
                onClick={() => refreshBalance()}
                disabled={!mounted || isRefreshing || !address}
                className={`text-[10px] uppercase tracking-[0.25em] border px-2 py-1 rounded-full transition ${
                  !mounted || isRefreshing || !address
                    ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                    : 'border-neutral-300 text-neutral-600 hover:text-neutral-900 hover:border-neutral-400'
                }`}
              >
                {isRefreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
            <div className="text-3xl font-semibold text-neutral-900">
              ${new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(balance)}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {mounted && isConnected && address && (
              <a
                href={getAddressUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-600 hover:text-neutral-900 font-mono underline transition-colors"
                title="View account on Tempo Explorer"
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </a>
            )}
            <div className="min-w-[280px]">
              <AuthButtons addLog={addLog} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-neutral-200 overflow-y-auto bg-neutral-50">
          <GamePanel addLog={addLog} onRefreshBalance={refreshBalance} />
        </div>

        <div className="w-1/2 overflow-hidden bg-neutral-50">
          <ActivityLog logs={logs} />
        </div>
      </main>
    </div>
  )
}
