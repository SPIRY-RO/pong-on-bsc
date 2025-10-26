import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/eip3009Abi'

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
    note: `Pay 10 USD1 (EIP-2612 Permit) to receive ${(Number(BigInt(PRICE_MINOR) / BigInt(10 ** 18))) * PONG_PER_USD1} PONG allocation (handled off-chain)`,
  }

  return NextResponse.json(descriptor, { status: 402 })
}

// POST /api/pong → 402 EIP-3009 challenge
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`\n[Challenge:${requestId}] ===== NEW REQUEST =====`)
  console.log(`[Challenge:${requestId}] Timestamp:`, new Date().toISOString())

  try {
    // Check env vars first
    if (!TREASURY || !USD1_TOKEN) {
      console.error(`[Challenge:${requestId}] Missing env vars`)
      return NextResponse.json(
        { error: 'Server configuration error: Missing TREASURY or USD1_TOKEN env vars' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { owner, amount } = body

    console.log(`[Challenge:${requestId}] Owner:`, owner)
    console.log(`[Challenge:${requestId}] Amount:`, amount)

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

    // Get facilitator address (spender in permit)
    const facilitator = getWalletClient().account.address

    console.log(`[Challenge:${requestId}] Facilitator address:`, facilitator)

    // Read token name and version from contract
    let tokenName = TOKEN_NAME
    let tokenVersion = TOKEN_VERSION

    try {
      tokenName = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'name',
      })
      console.log(`[Challenge:${requestId}] Token name from contract:`, tokenName)
    } catch (e) {
      console.warn(`[Challenge:${requestId}] Failed to read name, using fallback:`, TOKEN_NAME)
    }

    try {
      tokenVersion = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'version',
      })
      console.log(`[Challenge:${requestId}] Token version from contract:`, tokenVersion)
    } catch (e) {
      console.warn(`[Challenge:${requestId}] Failed to read version, using fallback:`, TOKEN_VERSION)
    }

    // Read DOMAIN_SEPARATOR for verification
    try {
      const domainSeparator = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      })
      console.log(`[Challenge:${requestId}] DOMAIN_SEPARATOR from contract:`, domainSeparator)
    } catch (e) {
      console.warn(`[Challenge:${requestId}] Failed to read DOMAIN_SEPARATOR`)
    }

    // Read current nonce for the user from contract
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [owner as `0x${string}`],
    })

    console.log(`[Challenge:${requestId}] User nonce from contract:`, nonce.toString())

    // Generate EIP-2612 Permit challenge
    const deadline = Math.floor(Date.now() / 1000) + CHALLENGE_MINUTES * 60

    const domain = {
      name: tokenName,
      version: tokenVersion,
      chainId: 56,
      verifyingContract: USD1_TOKEN,
    }

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    }

    // CRITICAL: Values must match EXACTLY what the contract expects
    const values = {
      owner: owner as `0x${string}`,
      spender: facilitator as `0x${string}`,
      value: priceMinor, // String representation of uint256
      nonce: nonce.toString(), // String representation of uint256
      deadline: deadline.toString(), // String representation of uint256
    }

    console.log(`[Challenge:${requestId}] ===== EIP-2612 PERMIT DETAILS =====`)
    console.log(`[Challenge:${requestId}] Domain:`, {
      name: tokenName,
      version: tokenVersion,
      chainId: 56,
      verifyingContract: USD1_TOKEN,
    })
    console.log(`[Challenge:${requestId}] Values:`, {
      owner,
      spender: facilitator,
      value: priceMinor,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    })

    console.log(`[Challenge:${requestId}] ===== SENDING 402 RESPONSE =====\n`)

    return NextResponse.json(
      {
        domain,
        types,
        values,
        primaryType: 'Permit',
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
