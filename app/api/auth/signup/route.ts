import { NextRequest, NextResponse } from 'next/server'
import { TEMPO_CONFIG } from '@/lib/tempo'

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      )
    }

    const requestFaucet = async (token: string, amount: number) => {
      const response = await fetch(TEMPO_CONFIG.faucetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          token,
          amount,
        }),
      })

      const data = await response.json()
      return { ok: response.ok, data }
    }

    const alphaUsd = await requestFaucet('AlphaUSD', 1000)
    if (!alphaUsd.ok && typeof alphaUsd.data?.message === 'string' && alphaUsd.data.message.includes('replacement')) {
      // Faucet can return replacement underpriced; retry once after a short delay.
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    const alphaUsdFinal = alphaUsd.ok ? alphaUsd : await requestFaucet('AlphaUSD', 1000)
    const pathUsd = await requestFaucet('pathUSD', 1000)

    console.log('Faucet response (AlphaUSD):', alphaUsdFinal.data)
    console.log('Faucet response (pathUSD):', pathUsd.data)

    if (!alphaUsdFinal.ok || !pathUsd.ok) {
      if (!alphaUsdFinal.ok) console.error('Faucet error (AlphaUSD):', alphaUsdFinal.data)
      if (!pathUsd.ok) console.error('Faucet error (pathUSD):', pathUsd.data)
      return NextResponse.json(
        {
          address,
          funded: alphaUsdFinal.ok || pathUsd.ok,
          alphaUsd: alphaUsdFinal.ok,
          pathUsd: pathUsd.ok,
        },
        { status: 200 } // Still return 200 as account was created
      )
    }

    return NextResponse.json({
      address,
      funded: true,
      alphaUsd: true,
      pathUsd: true,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Signup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
