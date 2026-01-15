import { NextResponse } from 'next/server'
import { getCasinoAddress } from '@/lib/casino-wallet'

export async function GET() {
  try {
    const casinoAddress = getCasinoAddress()

    return NextResponse.json({
      casinoAddress,
    })
  } catch (error) {
    console.error('Casino address error:', error)
    return NextResponse.json(
      { error: 'Failed to get casino address' },
      { status: 500 }
    )
  }
}
