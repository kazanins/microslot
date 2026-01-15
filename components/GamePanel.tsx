'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Account } from 'viem/tempo'
import { hexToBytes } from 'viem'
import { PublicKey } from 'ox'
import { SlotMachine } from './SlotMachine'
import { AddFundsButtons } from './AddFundsButtons'
import { Confetti } from './Confetti'
import type { ActivityLogEntry, SlotSymbol } from '@/types'

type GamePanelProps = {
  addLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void
  onRefreshBalance?: () => void
}

type PaymentChallenge = {
  id: string
  realm: string
  method: string
  intent: string
  request: string
}

type AccessKeyStorage = {
  accessKeyAddress: `0x${string}`
  publicKeyRaw: `0x${string}`
  privateKeyJwk: JsonWebKey
}

function parsePaymentChallenge(header: string | null): PaymentChallenge | null {
  if (!header || !header.startsWith('Payment ')) return null
  const params = Object.fromEntries(
    Array.from(header.matchAll(/(\w+)="([^"]*)"/g)).map((match) => [
      match[1],
      match[2],
    ])
  )

  if (!params.id || !params.request || !params.realm || !params.method || !params.intent) {
    return null
  }
  return {
    id: params.id,
    realm: params.realm,
    method: params.method,
    intent: params.intent,
    request: params.request,
  }
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createPaymentMessage(challenge: PaymentChallenge) {
  return `microslot:${challenge.id}:${challenge.request}`
}

function getAccessKeyStorage(address: string): AccessKeyStorage | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(`microslot-access-key:${address.toLowerCase()}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AccessKeyStorage
  } catch {
    return null
  }
}

export function GamePanel({ addLog, onRefreshBalance }: GamePanelProps) {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [combination, setCombination] = useState<[SlotSymbol, SlotSymbol, SlotSymbol] | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiKey, setConfettiKey] = useState(0)
  const [depositedBalance, setDepositedBalance] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (lastWin) {
      setConfettiKey((prev) => prev + 1)
      setShowConfetti(true)
      const timeout = window.setTimeout(() => setShowConfetti(false), 4000)
      return () => window.clearTimeout(timeout)
    }

    setShowConfetti(false)
  }, [lastWin])

  useEffect(() => {
    if (!isConnected) {
      setDepositedBalance(0)
    }
  }, [isConnected])

  const handleSpin = async () => {
    if (!address || depositedBalance < 1 || isSpinning) return

    setIsSpinning(true)
    setLastWin(null)

    addLog({
      type: 'spin',
      message: 'Requesting spin... ($1 cost)',
    })

    try {
      // Call /api/spin
      const response = await fetch(`/api/spin?address=${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      let activeResponse = response

      if (response.status === 402) {
        const authHeader = response.headers.get('WWW-Authenticate')
        const challenge = parsePaymentChallenge(authHeader)

        addLog({
          type: 'payment',
          message: '402 Payment Required - preparing payment credential',
          details: challenge
            ? {
                challengeHeader: `WWW-Authenticate: Payment id="${challenge.id}", realm="${challenge.realm}", method="${challenge.method}", intent="${challenge.intent}", request="${challenge.request}"`,
                challengeId: challenge.id,
                realm: challenge.realm,
                method: challenge.method,
                intent: challenge.intent,
                requestJson: JSON.parse(
                  atob(challenge.request.replace(/-/g, '+').replace(/_/g, '/'))
                ),
                signedMessage: createPaymentMessage(challenge),
              }
            : undefined,
        })

        if (!challenge) {
          throw new Error('Payment challenge missing or invalid')
        }

        const accessKey = getAccessKeyStorage(address)

        if (!accessKey) {
          throw new Error('Access key missing. Add funds to create one.')
        }

        const privateKey = await crypto.subtle.importKey(
          'jwk',
          accessKey.privateKeyJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign']
        )
        const publicKey = PublicKey.from(hexToBytes(accessKey.publicKeyRaw))
        const accessKeyAccount = Account.fromWebCryptoP256({
          publicKey,
          privateKey,
        })
        const message = createPaymentMessage(challenge)
        const signature = await accessKeyAccount.signMessage({ message })

        const credential = {
          id: challenge.id,
          payload: {
            signature,
            accessKeyAddress: accessKey.accessKeyAddress,
          },
        }

        addLog({
          type: 'payment',
          message: 'Responding to payment challenge with access key signature',
          details: {
            credential,
            realm: challenge.realm,
            method: challenge.method,
            intent: challenge.intent,
            signedMessage: message,
          },
        })

        const retryResponse = await fetch(`/api/spin?address=${address}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Payment ${base64UrlEncode(JSON.stringify(credential))}`,
          },
        })

        activeResponse = retryResponse
      }

      if (!activeResponse.ok) {
        const errorBody = await activeResponse.json().catch(() => null)
        if (activeResponse.status === 401) {
          if (errorBody?.message === 'Access key balance depleted') {
            setDepositedBalance(0)
            addLog({
              type: 'payment',
              message: 'Balance depleted — add funds to continue.',
              details: errorBody,
            })
            return
          }

          addLog({
            type: 'payment',
            message: 'Payment verification failed. Please retry spin.',
          })
        }
        throw new Error(errorBody?.message || `Spin failed: ${activeResponse.statusText}`)
      }

      const data = await activeResponse.json()

      setCombination(data.combination)
      setLastWin(data.isWin)
      setDepositedBalance(data.remainingBalance)

      addLog({
        type: 'transaction',
        message: 'Spin executed!',
        txHash: data.txHash,
      })

      if (onRefreshBalance) {
        window.setTimeout(() => onRefreshBalance(), 500)
      }

      if (data.isWin) {
        addLog({
          type: 'win',
          message: `🎉 WINNING COMBINATION! You won $100!`,
        })

        // Prize transaction included in response
        if (data.prizeTxHash) {
          addLog({
            type: 'prize',
            message: `✅ Prize of $100 sent to your account!`,
            txHash: data.prizeTxHash,
          })

        } else {
          addLog({
            type: 'error',
            message: 'Prize distribution pending (check casino wallet balance)',
          })
        }
      }
    } catch (error) {
      console.error('Spin error:', error)
      addLog({
        type: 'error',
        message: `Spin failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsSpinning(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {showConfetti && <Confetti key={confettiKey} />}
      <div className="p-6 space-y-6">
        {!mounted ? (
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-neutral-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="text-center py-12 text-neutral-500">
            <p className="text-sm uppercase tracking-[0.2em] mb-2">Slot Machine</p>
            <p>Sign up or login to start playing.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-neutral-200 p-6 rounded-2xl text-center">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">
                Deposited Balance
              </div>
              <div className="text-5xl font-semibold text-neutral-900">
                ${new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(depositedBalance)}
              </div>
            </div>

            <SlotMachine
              combination={combination}
              isSpinning={isSpinning}
              lastWin={lastWin}
            />

            <AddFundsButtons
              addLog={addLog}
              currentBalance={depositedBalance}
              onFundsAdded={(totalBalance) => {
                setDepositedBalance(totalBalance)
              }}
            />

            <button
              onClick={handleSpin}
              disabled={isSpinning || depositedBalance < 1}
              className={`w-full py-5 rounded-xl font-semibold text-lg transition-all border ${
                isSpinning || depositedBalance < 1
                  ? 'bg-neutral-200 text-neutral-400 border-neutral-200 cursor-not-allowed'
                  : 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 hover:border-neutral-800'
              }`}
            >
              {isSpinning ? 'Spinning…' : depositedBalance < 1 ? 'Add funds to spin' : 'Spin ($1)'}
            </button>

            {lastWin !== null && (
              <div
                className={`text-center p-4 rounded-xl text-sm font-semibold border ${
                  lastWin
                    ? 'bg-white text-neutral-900 border-neutral-900'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                }`}
              >
                {lastWin ? 'You win $100.' : 'No win this time.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
