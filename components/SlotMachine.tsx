'use client'

import type { SlotSymbol } from '@/types'

type SlotMachineProps = {
  combination: [SlotSymbol, SlotSymbol, SlotSymbol] | null
  isSpinning: boolean
  lastWin: boolean | null
}

export function SlotMachine({ combination, isSpinning, lastWin }: SlotMachineProps) {
  const displaySymbols = combination || ['❓', '❓', '❓']

  return (
    <div className="bg-white p-8 rounded-2xl border border-neutral-200">
      <div className="bg-neutral-100 p-6 rounded-xl mb-4">
        <div className="flex justify-center gap-4">
          {displaySymbols.map((symbol, index) => (
            <div
              key={index}
              className={`
                w-24 h-24 bg-white rounded-lg flex items-center justify-center
                text-5xl font-semibold border border-neutral-200
                ${isSpinning ? 'animate-spin' : ''}
                ${lastWin && combination ? 'ring-2 ring-neutral-900' : ''}
              `}
            >
              {symbol}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-neutral-500 text-xs uppercase tracking-[0.2em]">
        {isSpinning ? 'Spinning' : combination ? 'Result' : 'Ready'}
      </div>
    </div>
  )
}
