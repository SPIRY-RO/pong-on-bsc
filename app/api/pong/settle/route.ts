import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { eip3009Abi } from '@/lib/eip3009Abi'

const TREASURY = process.env.TREASURY as `0x${string}`
const USD1_TOKEN = process.env.USD1_TOKEN as `0x${string}`
const PRICE_MINOR = process.env.PRICE_MINOR || '10000000'
const PONG_PER_USD1 = parseInt(process.env.PONG_PER_USD1 || '4000')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = body

    // Validation
    if (!from || !to || !value || validAfter === undefined || !validBefore || !nonce || !v || !r || !s) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate to address
    if (to.toLowerCase() !== TREASURY.toLowerCase()) {
      return NextResponse.json(
        { error: `Invalid 'to' address. Expected ${TREASURY}` },
        { status: 422 }
      )
    }

    // Validate value - must be 1, 5, or 10 USD1 (in minor units with 6 decimals)
    const validValues = ['1000000', '5000000', '10000000']
    if (!validValues.includes(value)) {
      return NextResponse.json(
        { error: `Invalid value. Expected 1, 5, or 10 USD1 (1000000, 5000000, or 10000000 in minor units)` },
        { status: 422 }
      )
    }

    // Validate validBefore
    const now = Math.floor(Date.now() / 1000)
    if (parseInt(validBefore) <= now) {
      return NextResponse.json(
        { error: 'Challenge expired. Please request a new challenge.' },
        { status: 422 }
      )
    }

    // Execute transferWithAuthorization
    const walletClient = getWalletClient()
    const hash = await walletClient.writeContract({
      address: USD1_TOKEN,
      abi: eip3009Abi,
      functionName: 'transferWithAuthorization',
      args: [
        from as `0x${string}`,
        to as `0x${string}`,
        BigInt(value),
        BigInt(validAfter),
        BigInt(validBefore),
        nonce as `0x${string}`,
        v,
        r as `0x${string}`,
        s as `0x${string}`,
      ],
      chain: null,
    })

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash })

    // Calculate PONG allocation based on actual value transferred
    const allocationPONG = (parseInt(value) / 1_000_000) * PONG_PER_USD1

    return NextResponse.json(
      {
        status: 'ok',
        txHash: hash,
        amountMinor: value,
        allocationPONG,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Settlement error:', error)

    // Handle specific errors
    if (error.message?.includes('signature')) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Settlement failed', details: error.message },
      { status: 400 }
    )
  }
}
