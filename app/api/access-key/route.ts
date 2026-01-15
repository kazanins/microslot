import { NextRequest, NextResponse } from 'next/server'
import { setAccessKey, getAccessKey } from '@/lib/session-store'
import type { AccessKeySession } from '@/types'
import { Address, PublicKey } from 'ox'
import { hexToBytes } from 'viem'
import { Account } from 'viem/tempo'

export async function POST(request: NextRequest) {
  try {
    const { address, amount, accessKeyPair, accessKeyAddress, keyAuthorization } = await request.json()

    if (!address || !amount || !accessKeyPair || !accessKeyAddress) {
      return NextResponse.json(
        { error: 'Address, amount, accessKeyPair, and accessKeyAddress required' },
        { status: 400 }
      )
    }

    if (!accessKeyPair.privateKeyJwk || !accessKeyPair.publicKeyRaw) {
      return NextResponse.json(
        { error: 'Public key and private key JWK required' },
        { status: 400 }
      )
    }

    console.log('Storing access key for user:', address)
    console.log('Access key pair received:', {
      publicKeyRaw: String(accessKeyPair.publicKeyRaw).slice(0, 20) + '...',
      hasPrivateKeyJwk: !!accessKeyPair.privateKeyJwk,
      publicKeyType: typeof accessKeyPair.publicKeyRaw,
      privateKeyType: typeof accessKeyPair.privateKeyJwk,
    })
    console.log('Raw accessKeyPair:', JSON.stringify(accessKeyPair).slice(0, 200))

    const publicKey = PublicKey.from(hexToBytes(accessKeyPair.publicKeyRaw))
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      accessKeyPair.privateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )
    const derivedAddress = Account.fromWebCryptoP256({ publicKey, privateKey }).address

    if (!Address.isEqual(derivedAddress, accessKeyAddress)) {
      return NextResponse.json(
        { error: 'Access key address mismatch' },
        { status: 400 }
      )
    }

    const accessKeySession: AccessKeySession = {
      accessKeyAddress: accessKeyAddress,
      accessKeyPair: {
        publicKeyRaw: accessKeyPair.publicKeyRaw,
        privateKeyJwk: accessKeyPair.privateKeyJwk,
      },
      keyAuthorization: keyAuthorization ?? undefined,
      depositedAmount: amount,
      remainingBalance: amount,
    }

    console.log('Storing session with privateKeyJwk type:', typeof accessKeySession.accessKeyPair.privateKeyJwk)
    console.log('Storing session with privateKeyJwk value:', JSON.stringify(accessKeySession.accessKeyPair.privateKeyJwk).slice(0, 30))
    console.log('Storing session with publicKeyRaw:', accessKeySession.accessKeyPair.publicKeyRaw.slice(0, 18) + '...')

    setAccessKey(address, accessKeySession)

    // Verify it was stored
    const storedKey = getAccessKey(address)
    console.log('Access key stored and verified:', {
      address,
      stored: !!storedKey,
      balance: storedKey?.remainingBalance,
      hasKeyPair: !!storedKey?.accessKeyPair,
    })

    return NextResponse.json({
      success: true,
      depositedAmount: amount,
      remainingBalance: amount,
    })
  } catch (error) {
    console.error('Access key error:', error)
    return NextResponse.json(
      { error: 'Failed to store access key', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
