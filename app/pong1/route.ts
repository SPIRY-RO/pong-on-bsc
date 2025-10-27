import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'
import { getAddress } from 'viem'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0x8676532800bEF0c69F8Af0A989dBf3943B1b408A' as `0x${string}`
const USD1_DECIMALS = 18

// TIER 1: 1 USD1 → 4,000 PONG
const TIER_AMOUNT = 1
const PRICE_MINOR = '1000000000000000000' // 1 USD1 with 18 decimals
const PONG_PER_USD1 = 4000
const PONG_ALLOCATION = TIER_AMOUNT * PONG_PER_USD1

// Will be read from contract dynamically
const TOKEN_NAME_FALLBACK = 'World Liberty Financial USD'
const TOKEN_VERSION_FALLBACK = '1'

// Configurable via env
const CHALLENGE_MINUTES = parseInt(process.env.CHALLENGE_MINUTES || '15')

// Helper: Decode base64 X-PAYMENT header
function decodeXPayment(xPaymentHeader: string) {
  const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
  return JSON.parse(decoded)
}

// Helper: Split signature into v, r, s
function splitSignature(signature: string): { v: number; r: string; s: string } {
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature
  const r = '0x' + sig.slice(0, 64)
  const s = '0x' + sig.slice(64, 128)
  const v = parseInt(sig.slice(128, 130), 16)
  return { v, r, s }
}

// Handler for X-PAYMENT settlement
async function handlePaymentSettlement(requestId: string, xPaymentHeader: string) {
  console.log(`[/pong1:${requestId}] ===== PROCESSING X-PAYMENT =====`)

  try {
    // Decode payment payload
    const payment = decodeXPayment(xPaymentHeader)
    console.log(`[/pong1:${requestId}] Payment network:`, payment.network)
    console.log(`[/pong1:${requestId}] Payment scheme:`, payment.scheme)

    // Validate x402 version
    if (payment.x402Version !== 1) {
      return NextResponse.json(
        { error: 'Unsupported x402 version' },
        { status: 400 }
      )
    }

    // Validate network
    if (payment.network !== 'bsc') {
      return NextResponse.json(
        { error: 'Invalid network. Expected: bsc' },
        { status: 422 }
      )
    }

    // Validate scheme
    if (payment.scheme !== 'exact') {
      return NextResponse.json(
        { error: 'Invalid scheme. Expected: exact' },
        { status: 422 }
      )
    }

    // Validate authorization type
    if (payment.payload.authorizationType !== 'permit') {
      return NextResponse.json(
        { error: 'Invalid authorization type. Expected: permit' },
        { status: 422 }
      )
    }

    const { signature, authorization } = payment.payload
    const { owner, spender, value, deadline, nonce } = authorization

    console.log(`[/pong1:${requestId}] EIP-2612 Permit:`, {
      owner,
      spender,
      value,
      deadline,
      nonce,
    })

    // Validate value matches tier
    if (value !== PRICE_MINOR) {
      return NextResponse.json(
        { error: `Invalid value. Expected: ${PRICE_MINOR}` },
        { status: 422 }
      )
    }

    // Validate deadline
    const now = Math.floor(Date.now() / 1000)
    if (parseInt(deadline) <= now) {
      return NextResponse.json(
        { error: 'Permit expired' },
        { status: 422 }
      )
    }

    // Get facilitator wallet
    const walletClient = getWalletClient()
    const facilitator = walletClient.account.address

    // Validate spender is facilitator
    if (spender.toLowerCase() !== facilitator.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid spender address' },
        { status: 422 }
      )
    }

    // Split signature into v, r, s
    const { v, r, s } = splitSignature(signature)

    console.log(`[/pong1:${requestId}] ===== EXECUTING PERMIT() =====`)

    // Step 1: Execute permit()
    const permitHash = await walletClient.writeContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'permit',
      args: [
        owner as `0x${string}`,
        spender as `0x${string}`,
        BigInt(value),
        BigInt(deadline),
        v,
        r as `0x${string}`,
        s as `0x${string}`,
      ] as const,
      chain: null,
    })

    console.log(`[/pong1:${requestId}] Permit tx sent:`, permitHash)
    await publicClient.waitForTransactionReceipt({ hash: permitHash })
    console.log(`[/pong1:${requestId}] Permit confirmed!`)

    console.log(`[/pong1:${requestId}] ===== EXECUTING TRANSFERFROM() =====`)

    // Step 2: Execute transferFrom()
    const transferHash = await walletClient.writeContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'transferFrom',
      args: [
        owner as `0x${string}`,
        TREASURY,
        BigInt(value),
      ] as const,
      chain: null,
    })

    console.log(`[/pong1:${requestId}] Transfer tx sent:`, transferHash)
    await publicClient.waitForTransactionReceipt({ hash: transferHash })
    console.log(`[/pong1:${requestId}] Transfer confirmed!`)

    console.log(`[/pong1:${requestId}] ===== SETTLEMENT COMPLETE =====`)
    console.log(`[/pong1:${requestId}] PONG allocated: ${PONG_ALLOCATION}`)

    // Encode X-PAYMENT-RESPONSE header
    const paymentResponse = {
      success: true,
      transaction: transferHash,
      network: 'bsc',
      payer: owner,
      amountMinor: value,
      allocationPONG: PONG_ALLOCATION,
    }
    const xPaymentResponse = Buffer.from(JSON.stringify(paymentResponse)).toString('base64')

    // Return success with X-PAYMENT-RESPONSE header
    return NextResponse.json(
      {
        status: 'ok',
        txHash: transferHash,
        permitHash,
        amountMinor: value,
        allocationPONG: PONG_ALLOCATION,
      },
      {
        status: 201,
        headers: {
          'X-PAYMENT-RESPONSE': xPaymentResponse,
        },
      }
    )
  } catch (error: any) {
    console.error(`[/pong1:${requestId}] Settlement error:`, error.message)
    return NextResponse.json(
      { error: 'Settlement failed', details: error.shortMessage || error.message },
      { status: 400 }
    )
  }
}

// GET /pong1 → 402 PaymentRequirements (x402 protocol) - TIER 1
export async function GET() {
  const paymentRequirements = {
    x402Version: 1,
    scheme: 'exact',
    network: 'bsc',
    asset: USD1_TOKEN,
    payTo: TREASURY,
    amount: PRICE_MINOR,
    resource: '/PONG1',
    description: `${PONG_ALLOCATION.toLocaleString()} PONG tokens - Tier ${TIER_AMOUNT}`,
    extra: {
      name: 'World Liberty Financial USD',
      version: '1',
      chainId: 56,
    }
  }

  return NextResponse.json(paymentRequirements, { status: 402 })
}

// POST /pong1 → Process EIP-2612 Permit payment (TIER 1)
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`\\n[/pong1:${requestId}] ===== NEW REQUEST =====`)
  console.log(`[/pong1:${requestId}] Tier: ${TIER_AMOUNT} USD1 → ${PONG_ALLOCATION} PONG`)
  console.log(`[/pong1:${requestId}] Timestamp:`, new Date().toISOString())

  try {
    // Check for X-PAYMENT header (x402 protocol)
    const xPaymentHeader = req.headers.get('X-PAYMENT')

    if (xPaymentHeader) {
      console.log(`[/pong1:${requestId}] X-PAYMENT header detected - processing payment`)
      return await handlePaymentSettlement(requestId, xPaymentHeader)
    }

    // No X-PAYMENT header - return EIP-2612 Permit challenge
    const body = await req.json()
    const { owner } = body

    console.log(`[/pong1:${requestId}] No X-PAYMENT header - generating challenge`)
    console.log(`[/pong1:${requestId}] Owner from request:`, owner)

    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return NextResponse.json(
        { error: 'Invalid owner address' },
        { status: 400 }
      )
    }

    // Get facilitator address (spender in permit)
    const facilitator = getWalletClient().account.address
    console.log(`[/pong1:${requestId}] Facilitator address (spender):`, facilitator)
    console.log(`[/pong1:${requestId}] 🔍 CRITICAL CHECK:`)
    console.log(`[/pong1:${requestId}]   Owner (user):  ${owner}`)
    console.log(`[/pong1:${requestId}]   Spender (facilitator): ${facilitator}`)
    console.log(`[/pong1:${requestId}]   These MUST be different!`)

    // Read name from contract - CRITICAL for EIP-712 domain
    let tokenName: string
    let tokenVersion = '1' // USD1 doesn't have version(), use default
    let domainChainId = 56

    try {
      // Read name() from contract - this is what contract uses for domain separator
      tokenName = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'name',
      })
      console.log(`[/pong1:${requestId}] ✅ name() from contract:`, tokenName)
    } catch (e: any) {
      console.error(`[/pong1:${requestId}] ❌ name() failed:`, e.message)
      tokenName = TOKEN_NAME_FALLBACK
      console.log(`[/pong1:${requestId}] Using fallback name:`, tokenName)
    }

    // USD1 doesn't implement version(), but permit() uses "1" by default
    console.log(`[/pong1:${requestId}] Using version: "${tokenVersion}"`)

    // Read DOMAIN_SEPARATOR for verification
    try {
      const domainSeparator = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      })
      console.log(`[/pong1:${requestId}] DOMAIN_SEPARATOR from contract:`, domainSeparator)
    } catch (e: any) {
      console.log(`[/pong1:${requestId}] DOMAIN_SEPARATOR not available`)
    }

    // Read current nonce for the user from contract
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [owner as `0x${string}`],
    })

    console.log(`[/pong1:${requestId}] User nonce from contract:`, nonce.toString())

    // Generate EIP-2612 Permit challenge
    const deadline = Math.floor(Date.now() / 1000) + CHALLENGE_MINUTES * 60

    // x402-permit pattern: Use getAddress() for address normalization (checksumming)
    const domain = {
      name: tokenName,
      version: tokenVersion,
      chainId: domainChainId,
      verifyingContract: getAddress(USD1_TOKEN),
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
    // Use BigInt for uint256 values so MetaMask encodes them correctly
    // Use getAddress() for proper address normalization (x402-permit pattern)
    const values = {
      owner: getAddress(owner) as `0x${string}`,
      spender: getAddress(facilitator) as `0x${string}`,
      value: BigInt(PRICE_MINOR), // uint256 as BigInt
      nonce: nonce, // uint256 as BigInt (already bigint from contract read)
      deadline: BigInt(deadline), // uint256 as BigInt
    }

    console.log(`[/pong1:${requestId}] ===== EIP-2612 PERMIT CHALLENGE =====`)
    console.log(`[/pong1:${requestId}] Domain (being sent to frontend):`)
    console.log(`[/pong1:${requestId}]   name: "${tokenName}"`)
    console.log(`[/pong1:${requestId}]   version: "${tokenVersion}"`)
    console.log(`[/pong1:${requestId}]   chainId: ${domainChainId}`)
    console.log(`[/pong1:${requestId}]   verifyingContract: ${getAddress(USD1_TOKEN)}`)
    console.log(`[/pong1:${requestId}] Values (being sent to frontend):`)
    console.log(`[/pong1:${requestId}]   owner: ${values.owner}`)
    console.log(`[/pong1:${requestId}]   spender: ${values.spender}`)
    console.log(`[/pong1:${requestId}]   value: ${values.value.toString()}`)
    console.log(`[/pong1:${requestId}]   nonce: ${values.nonce.toString()}`)
    console.log(`[/pong1:${requestId}]   deadline: ${values.deadline.toString()}`)

    console.log(`[/pong1:${requestId}] ===== SENDING 402 RESPONSE =====\\n`)

    // Convert BigInt to string for JSON serialization
    // Frontend will receive strings and pass to MetaMask as-is
    // MetaMask will encode based on types (uint256)
    const valuesForJSON = {
      owner: values.owner,
      spender: values.spender,
      value: values.value.toString(),
      nonce: values.nonce.toString(),
      deadline: values.deadline.toString(),
    }

    return NextResponse.json(
      {
        domain,
        types,
        values: valuesForJSON,
        primaryType: 'Permit',
      },
      { status: 402 }
    )
  } catch (error) {
    console.error('[/pong1] Challenge generation error:', error)
    console.error('[/pong1] Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
    })
    return NextResponse.json(
      { error: 'Invalid request', details: (error as Error).message },
      { status: 400 }
    )
  }
}
