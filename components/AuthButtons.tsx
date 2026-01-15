'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import type { ActivityLogEntry } from '@/types'

type AuthButtonsProps = {
  addLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void
}

export function AuthButtons({ addLog }: AuthButtonsProps) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const webAuthnConnector = connectors.find((c) => c.type === 'webAuthn')

  const handleSignUp = async () => {
    if (!webAuthnConnector) {
      addLog({
        type: 'error',
        message: 'WebAuthn connector not available',
      })
      return
    }

    try {
      addLog({
        type: 'auth',
        message: 'Creating new Tempo account with passkey...',
      })

      // Use sign-up capability to create new credential
      connect(
        {
          connector: webAuthnConnector,
          chainId: 42431,
          capabilities: { type: 'sign-up' },
        },
        {
          onSuccess: async (data) => {
            addLog({
              type: 'auth',
              message: `✅ Tempo account created! Address: ${data.accounts[0]}`,
            })

            // Fund account via faucet
            try {
              addLog({
                type: 'deposit',
                message: 'Requesting $1000 AlphaUSD from faucet...',
              })

              const faucetResponse = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: data.accounts[0] }),
              })

              if (faucetResponse.ok) {
                const faucetData = await faucetResponse.json()
                if (faucetData.funded) {
                  addLog({
                    type: 'deposit',
                    message: '✅ Account funded with $1000 AlphaUSD!',
                  })
                } else {
                  addLog({
                    type: 'error',
                    message: 'Faucet funding request sent but not confirmed',
                    details: faucetData,
                  })
                }
              }
            } catch (error) {
              addLog({
                type: 'error',
                message: `Faucet funding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              })
            }
          },
          onError: (error) => {
            console.error('Sign up error:', error)
            addLog({
              type: 'error',
              message: `Sign up failed: ${error.message}`,
              details: { error: error.toString() },
            })
          },
        }
      )
    } catch (error) {
      addLog({
        type: 'error',
        message: `Sign up error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleLogin = async () => {
    if (!webAuthnConnector) {
      addLog({
        type: 'error',
        message: 'WebAuthn connector not available',
      })
      return
    }

    try {
      addLog({
        type: 'auth',
        message: 'Signing in with existing passkey...',
      })

      // Use sign-in capability to use existing credential
      connect(
        {
          connector: webAuthnConnector,
          chainId: 42431,
          capabilities: { type: 'sign-in' },
        },
        {
          onSuccess: (data) => {
            addLog({
              type: 'auth',
              message: `✅ Signed in! Address: ${data.accounts[0]}`,
            })
          },
          onError: (error) => {
            console.error('Login error:', error)
            addLog({
              type: 'error',
              message: `Login failed: ${error.message}`,
              details: { error: error.toString() },
            })
          },
        }
      )
    } catch (error) {
      addLog({
        type: 'error',
        message: `Login error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleLogout = () => {
    addLog({
      type: 'auth',
      message: 'Signing out...',
    })
    disconnect()
    addLog({
      type: 'auth',
      message: 'Signed out successfully',
    })
  }

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="flex gap-3">
        <div className="flex-1 bg-neutral-200 animate-pulse h-11 rounded-lg"></div>
        <div className="flex-1 bg-neutral-200 animate-pulse h-11 rounded-lg"></div>
      </div>
    )
  }

  if (isConnected) {
    return (
      <button
        onClick={handleLogout}
        className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    )
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleSignUp}
        className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        Sign Up
      </button>
      <button
        onClick={handleLogin}
        className="flex-1 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-900 font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        Log In
      </button>
    </div>
  )
}
