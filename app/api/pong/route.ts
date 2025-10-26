import { NextRequest, NextResponse } from 'next/server'
import { publicClient } from '@/lib/viem'
import { eip3009Abi } from '@/lib/eip3009Abi'
import { randomBytes } from 'crypto'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0xC0c241ba9A61303aa9A038788C68574172D3934e' as `0x${string}`
const USD1_DECIMALS = 18
const TOKEN_NAME = 'USD1'
const TOKEN_VERSION = '1'

// Configurable via env
const PRICE_MINOR = process.env.PRICE_MINOR || '10000000000000000000' // 10 USD1 with 18 decimals
const CHALLENGE_MINUTES = parseInt(process.env.CHALLENGE_MINUTES || '15')
const PONG_PER_USD1 = parseInt(process.env.PONG_PER_USD1 || '4000')

// GET /api/pong → 402 descriptor
export async function GET() {
  const descriptor = {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'bsc',
        maxAmountRequired: PRICE_MINOR,
        asset: USD1_TOKEN,
        payTo: TREASURY,
      },
    ],
    product: 'PONG',
    note: `Pay 10 USD1 (EIP-3009) to receive ${(Number(BigInt(PRICE_MINOR) / BigInt(10 ** 18))) * PONG_PER_USD1} PONG allocation (handled off-chain)`,
  }

  return NextResponse.json(descriptor, { status: 402 })
}

// POST /api/pong → 402 EIP-3009 challenge
export async function POST(req: NextRequest) {
  try {
    // Check env vars first
    if (!TREASURY || !USD1_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing TREASURY or USD1_TOKEN env vars' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { owner, amount } = body

    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return NextResponse.json(
        { error: 'Invalid owner address' },
        { status: 400 }
      )
    }

    // Validate amount - must be 1, 5, or 10
    const validAmounts = [1, 5, 10]
    const tierAmount = amount || 10 // Default to 10 for backwards compatibility

    if (!validAmounts.includes(tierAmount)) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be 1, 5, or 10 USD1' },
        { status: 400 }
      )
    }

    // Calculate price in minor units (18 decimals for USD1)
    const priceMinor = (BigInt(tierAmount) * BigInt(10 ** 18)).toString()

    console.log('[Challenge] Tier amount:', tierAmount, 'Price minor:', priceMinor)

    // Try to read token name, fallback to env
    let tokenName = TOKEN_NAME
    try {
      tokenName = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: eip3009Abi,
        functionName: 'name',
      })
    } catch {
      // Fallback to env
    }

    // Generate challenge
    const validAfter = 0
    const validBefore = Math.floor(Date.now() / 1000) + CHALLENGE_MINUTES * 60
    const nonce = `0x${randomBytes(32).toString('hex')}`

    const domain = {
      name: tokenName,
      version: TOKEN_VERSION,
      chainId: 56,
      verifyingContract: USD1_TOKEN,
    }

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    }

    const values = {
      from: owner,
      to: TREASURY,
      value: priceMinor,
      validAfter,
      validBefore,
      nonce,
    }

    console.log('[Challenge] Response values:', {
      from: owner,
      to: TREASURY,
      value: priceMinor,
      validAfter,
      validBefore,
      nonce: nonce.slice(0, 10) + '...'
    })

    return NextResponse.json(
      {
        domain,
        types,
        values,
        primaryType: 'TransferWithAuthorization',
      },
      { status: 402 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', details: (error as Error).message },
      { status: 400 }
    )
  }
}
