'use client'

import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import type { ActivityLogEntry } from '@/types'
import { parseUnits, bytesToHex, type Address } from 'viem'
import { PublicKey } from 'ox'
import { KeyAuthorization } from 'ox/tempo'
import { Account, WebCryptoP256 } from 'viem/tempo'
import { TEMPO_CONFIG } from '@/lib/tempo'

type AddFundsButtonsProps = {
  addLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void
  onFundsAdded: (amount: number) => void
}

export function AddFundsButtons({ addLog, onFundsAdded }: AddFundsButtonsProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [isAdding, setIsAdding] = useState(false)

  const handleAddFunds = async (amount: number) => {
    if (!address || !walletClient || isAdding) return

    setIsAdding(true)

    try {
      addLog({
        type: 'deposit',
        message: `Creating access key for $${amount}...`,
      })

      // Get the casino address from backend

      addLog({
        type: 'payment',
        message: 'Generating new access key...',
      })

      // Generate a NEW WebCrypto P256 key pair for the access key
      // This will be given to the casino to spend on user's behalf
      // IMPORTANT: extractable: true allows us to export and send the private key
      const accessKeyPair = await WebCryptoP256.createKeyPair({ extractable: true })

      // Export the private key from CryptoKey
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', accessKeyPair.privateKey)

      if (!privateKeyJwk.d) {
        throw new Error('Failed to export private key: no d value in JWK')
      }

      const publicKeyRaw = bytesToHex(PublicKey.toBytes(accessKeyPair.publicKey))
      const accessKeyAccountWithoutAccess = Account.fromWebCryptoP256(accessKeyPair)
      const accessKeyAddress = accessKeyAccountWithoutAccess.address

      console.log('Frontend: Created access key with address:', accessKeyAddress)
      console.log('Frontend: Access key publicKey:', accessKeyPair.publicKey)
      console.log('Frontend: Access key publicKeyRaw:', publicKeyRaw)

      // Amount in AlphaUSD wei (6 decimals) - must be bigint
      const amountWei = parseUnits(amount.toString(), 6)

      addLog({
        type: 'payment',
        message: 'Signing access key authorization...',
      })

      const account = walletClient.account
      if (!account) {
        throw new Error('Wallet account not available')
      }

      if (!('signKeyAuthorization' in account)) {
        throw new Error('Account does not support key authorization')
      }

      const accessKeyAccount = Account.fromWebCryptoP256(accessKeyPair, {
        access: account.address,
      })
      const keyAuthorization = await (account as any).signKeyAuthorization(
        accessKeyAccount,
        {
          expiry: Math.floor(Date.now() / 1000) + 86400,
          limits: [
            {
              token: TEMPO_CONFIG.alphaUsdAddress as Address,
              limit: amountWei,
            },
          ],
        }
      )

      const keyAuthorizationRpc = KeyAuthorization.toRpc(keyAuthorization)

      addLog({
        type: 'payment',
        message: '✅ Access key authorization signed',
      })

      // Submit the access key to the backend
      // The casino will receive this key to spend on user's behalf
      const serializedKeyPair = {
        publicKeyRaw,
        privateKeyJwk,
      }

      const response = await fetch('/api/access-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          {
            address,
            amount,
            accessKeyPair: serializedKeyPair,
            accessKeyAddress,
            keyAuthorization: keyAuthorizationRpc,
          },
          (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to store access key')
      }

      const data = await response.json()

      if (typeof window !== 'undefined') {
        const storageKey = `microslot-access-key:${address.toLowerCase()}`
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            accessKeyAddress,
            publicKeyRaw: serializedKeyPair.publicKeyRaw,
            privateKeyJwk: serializedKeyPair.privateKeyJwk,
          })
        )
      }

      addLog({
        type: 'deposit',
        message: `✅ Added $${amount} to machine! Balance: $${data.remainingBalance.toFixed(2)}`,
      })

      onFundsAdded(amount)
    } catch (error) {
      console.error('Add funds error:', error)
      addLog({
        type: 'error',
        message: `Failed to add funds: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-center text-xs uppercase tracking-[0.2em] text-neutral-500">
        Add Funds
      </div>
      <div className="flex gap-3">
        {[10, 20, 50].map((amount) => (
          <button
            key={amount}
            onClick={() => handleAddFunds(amount)}
            disabled={isAdding}
            className={`
              flex-1 py-3 rounded-xl font-semibold text-base border transition-all
              ${
                isAdding
                  ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                  : 'bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-100'
              }
            `}
          >
            +${amount}
          </button>
        ))}
      </div>
      <div className="text-center text-xs text-neutral-400">
        Creates an access key with your passkey signature
      </div>
    </div>
  )
}
