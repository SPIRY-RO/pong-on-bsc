import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0xC0c241ba9A61303aa9A038788C68574172D3934e' as `0x${string}`
const USD1_DECIMALS = 18

// TIER 3: 10 USD1 → 40,000 PONG
const TIER_AMOUNT = 10
const PRICE_MINOR = '10000000000000000000' // 10 USD1 with 18 decimals
const PONG_PER_USD1 = 4000
const PONG_ALLOCATION = TIER_AMOUNT * PONG_PER_USD1

// Will be read from contract dynamically
const TOKEN_NAME_FALLBACK = 'USD1'
const TOKEN_VERSION_FALLBACK = '1'

// Configurable via env
const CHALLENGE_MINUTES = parseInt(process.env.CHALLENGE_MINUTES || '15')

// GET /PONG2 → 402 descriptor
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
    note: `Pay ${TIER_AMOUNT} USD1 (EIP-2612 Permit) to receive ${PONG_ALLOCATION.toLocaleString()} PONG`,
  }

  return NextResponse.json(descriptor, { status: 402 })
}

// POST /PONG2 → 402 EIP-2612 Permit challenge
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`\\n[/PONG2:${requestId}] ===== NEW REQUEST =====`)
  console.log(`[/PONG2:${requestId}] Tier: ${TIER_AMOUNT} USD1 → ${PONG_ALLOCATION} PONG`)
  console.log(`[/PONG2:${requestId}] Timestamp:`, new Date().toISOString())

  try {
    const body = await req.json()
    const { owner } = body

    console.log(`[/PONG2:${requestId}] Owner:`, owner)

    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return NextResponse.json(
        { error: 'Invalid owner address' },
        { status: 400 }
      )
    }

    // Get facilitator address (spender in permit)
    const facilitator = getWalletClient().account.address
    console.log(`[/PONG2:${requestId}] Facilitator address:`, facilitator)

    // Try to read EIP-5267 eip712Domain() first - this is the MOST RELIABLE way!
    let tokenName = TOKEN_NAME_FALLBACK
    let tokenVersion = TOKEN_VERSION_FALLBACK
    let domainChainId = 56

    try {
      const domain = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'eip712Domain',
      })

      // EIP-5267 returns: [fields, name, version, chainId, verifyingContract, salt, extensions]
      tokenName = domain[1] // name
      tokenVersion = domain[2] // version
      domainChainId = Number(domain[3]) // chainId

      console.log(`[/PONG2:${requestId}] ✅✅✅ EIP-5267 eip712Domain() SUCCESS:`)
      console.log(`[/PONG2:${requestId}]   Name: "${tokenName}"`)
      console.log(`[/PONG2:${requestId}]   Version: "${tokenVersion}"`)
      console.log(`[/PONG2:${requestId}]   ChainId: ${domainChainId}`)
      console.log(`[/PONG2:${requestId}]   VerifyingContract: ${domain[4]}`)
    } catch (e: any) {
      console.error(`[/PONG2:${requestId}] ❌ eip712Domain() failed:`, e.message)
      console.log(`[/PONG2:${requestId}] Falling back to individual reads...`)

      // Fallback to individual reads
      try {
        tokenName = await publicClient.readContract({
          address: USD1_TOKEN,
          abi: usd1Abi,
          functionName: 'name',
        })
        console.log(`[/PONG2:${requestId}] ✅ name():`, tokenName)
      } catch {
        console.log(`[/PONG2:${requestId}] ⚠️  Using fallback name:`, TOKEN_NAME_FALLBACK)
      }

      try {
        tokenVersion = await publicClient.readContract({
          address: USD1_TOKEN,
          abi: usd1Abi,
          functionName: 'version',
        })
        console.log(`[/PONG2:${requestId}] ✅ version():`, tokenVersion)
      } catch {
        console.log(`[/PONG2:${requestId}] ⚠️  Using fallback version:`, TOKEN_VERSION_FALLBACK)
      }
    }

    // Read DOMAIN_SEPARATOR for verification
    try {
      const domainSeparator = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      })
      console.log(`[/PONG2:${requestId}] DOMAIN_SEPARATOR from contract:`, domainSeparator)
    } catch (e: any) {
      console.log(`[/PONG2:${requestId}] DOMAIN_SEPARATOR not available`)
    }

    // Read current nonce for the user from contract
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [owner as `0x${string}`],
    })

    console.log(`[/PONG2:${requestId}] User nonce from contract:`, nonce.toString())

    // Generate EIP-2612 Permit challenge
    const deadline = Math.floor(Date.now() / 1000) + CHALLENGE_MINUTES * 60

    const domain = {
      name: tokenName,
      version: tokenVersion,
      chainId: domainChainId,
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
      value: PRICE_MINOR, // String representation of uint256
      nonce: nonce.toString(), // String representation of uint256
      deadline: deadline.toString(), // String representation of uint256
    }

    console.log(`[/PONG2:${requestId}] ===== EIP-2612 PERMIT DETAILS =====`)
    console.log(`[/PONG2:${requestId}] Domain:`, {
      name: tokenName,
      version: tokenVersion,
      chainId: domainChainId,
      verifyingContract: USD1_TOKEN,
    })
    console.log(`[/PONG2:${requestId}] Values:`, {
      owner,
      spender: facilitator,
      value: PRICE_MINOR,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    })

    console.log(`[/PONG2:${requestId}] ===== SENDING 402 RESPONSE =====\\n`)

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
