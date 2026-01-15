'use client'

import { GamePanel } from '@/components/GamePanel'
import { ActivityLog } from '@/components/ActivityLog'
import { AuthButtons } from '@/components/AuthButtons'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { getAddressUrl } from '@/lib/tempo'
import type { ActivityLogEntry } from '@/types'

export default function Home() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()

  useEffect(() => {
    setMounted(true)
  }, [])

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
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              MicroSlot
            </h1>
            <p className="text-neutral-500 text-xs mt-1">
              Tempo Micropayments Demo • HTTP Payment Authentication
            </p>
          </div>

          <div className="flex items-center gap-4">
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
          <GamePanel addLog={addLog} />
        </div>

        <div className="w-1/2 overflow-hidden bg-neutral-50">
          <ActivityLog logs={logs} />
        </div>
      </main>
    </div>
  )
}
