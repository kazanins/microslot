import { NextRequest, NextResponse } from 'next/server'
import { sendPrizeToUser } from '@/lib/tempo-transfers'

const PRIZE_AMOUNT = 100 // $100 prize (pathUSD)

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      )
    }

    // Execute REAL on-chain transfer from casino to winner
    const txHash = await sendPrizeToUser(address as `0x${string}`, PRIZE_AMOUNT)

    return NextResponse.json({
      success: true,
      txHash,
      amount: PRIZE_AMOUNT.toString(),
    })
  } catch (error) {
    console.error('Prize error:', error)
    return NextResponse.json(
      { error: 'Failed to send prize', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
