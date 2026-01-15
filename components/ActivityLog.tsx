'use client'

import { useEffect, useRef } from 'react'
import type { ActivityLogEntry } from '@/types'
import { getTransactionUrl } from '@/lib/tempo'

export function ActivityLog({ logs }: { logs: ActivityLogEntry[] }) {
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLogColor = (type: ActivityLogEntry['type']): string => {
    switch (type) {
      case 'error':
        return 'text-neutral-900'
      case 'win':
      case 'prize':
        return 'text-neutral-800'
      default:
        return 'text-neutral-600'
    }
  }

  const getLogIcon = (_type: ActivityLogEntry['type']): string => '•'

  return (
    <div className="h-full flex flex-col bg-white border-l border-neutral-200">
      <div className="bg-white p-5 border-b border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900">Activity Log</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Real-time micropayment flow demonstration
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-center text-neutral-400 mt-8">
            <p>No activity yet</p>
            <p className="text-xs mt-2">Sign up to get started.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl border border-neutral-200">
              <div className="flex items-start gap-3">
                <span className="text-base text-neutral-400">{getLogIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs text-neutral-400">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`text-[10px] uppercase tracking-[0.2em] ${getLogColor(log.type)}`}>
                      {log.type}
                    </span>
                  </div>
                  <p className="text-neutral-700 mt-2 break-words">{log.message}</p>
                  {log.txHash && (
                    <a
                      href={getTransactionUrl(log.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-900 hover:text-neutral-600 underline text-xs mt-2 inline-block"
                    >
                      View on Explorer →
                    </a>
                  )}
                  {log.details && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-neutral-500 hover:text-neutral-700">
                        Details
                      </summary>
                      <pre className="mt-2 text-neutral-500 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      <div className="bg-white p-3 border-t border-neutral-200 text-center">
        <p className="text-xs text-neutral-400">{logs.length} events logged</p>
      </div>
    </div>
  )
}
