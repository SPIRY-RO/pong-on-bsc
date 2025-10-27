import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0xC0c241ba9A61303aa9A038788C68574172D3934e' as `0x${string}`
const USD1_DECIMALS = 18

// TIER 2: 5 USD1 → 20,000 PONG (MOST POPULAR)
const TIER_AMOUNT = 5
const PRICE_MINOR = '5000000000000000000' // 5 USD1 with 18 decimals
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
  console.log(`[/pong5:${requestId}] ===== PROCESSING X-PAYMENT =====`)

  try {
    // Decode payment payload
    const payment = decodeXPayment(xPaymentHeader)
    console.log(`[/pong5:${requestId}] Payment network:`, payment.network)
    console.log(`[/pong5:${requestId}] Payment scheme:`, payment.scheme)

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

    console.log(`[/pong5:${requestId}] EIP-2612 Permit:`, {
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

    console.log(`[/pong5:${requestId}] ===== EXECUTING PERMIT() =====`)

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

    console.log(`[/pong5:${requestId}] Permit tx sent:`, permitHash)
    await publicClient.waitForTransactionReceipt({ hash: permitHash })
    console.log(`[/pong5:${requestId}] Permit confirmed!`)

    console.log(`[/pong5:${requestId}] ===== EXECUTING TRANSFERFROM() =====`)

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

    console.log(`[/pong5:${requestId}] Transfer tx sent:`, transferHash)
    await publicClient.waitForTransactionReceipt({ hash: transferHash })
    console.log(`[/pong5:${requestId}] Transfer confirmed!`)

    console.log(`[/pong5:${requestId}] ===== SETTLEMENT COMPLETE =====`)
    console.log(`[/pong5:${requestId}] PONG allocated: ${PONG_ALLOCATION}`)

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
    console.error(`[/pong5:${requestId}] Settlement error:`, error.message)
    return NextResponse.json(
      { error: 'Settlement failed', details: error.shortMessage || error.message },
      { status: 400 }
    )
  }
}

// GET /pong5 → 402 PaymentRequirements (x402 protocol)
export async function GET() {
  const paymentRequirements = {
    x402Version: 1,
    scheme: 'exact',
    network: 'bsc',
    asset: USD1_TOKEN,
    payTo: TREASURY,
    amount: PRICE_MINOR,
    resource: '/pong5',
    description: `${PONG_ALLOCATION.toLocaleString()} PONG tokens - Tier ${TIER_AMOUNT} (MOST POPULAR)`,
    extra: {
      name: TOKEN_NAME_FALLBACK,
      version: TOKEN_VERSION_FALLBACK,
      chainId: 56,
    }
  }

  return NextResponse.json(paymentRequirements, { status: 402 })
}

// POST /pong5 → Process EIP-2612 Permit payment
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`\\n[/pong5:${requestId}] ===== NEW REQUEST =====`)
  console.log(`[/pong5:${requestId}] Tier: ${TIER_AMOUNT} USD1 → ${PONG_ALLOCATION} PONG`)
  console.log(`[/pong5:${requestId}] Timestamp:`, new Date().toISOString())

  try {
    // Check for X-PAYMENT header (x402 protocol)
    const xPaymentHeader = req.headers.get('X-PAYMENT')

    if (xPaymentHeader) {
      console.log(`[/pong5:${requestId}] X-PAYMENT header detected - processing payment`)
      return await handlePaymentSettlement(requestId, xPaymentHeader)
    }

    // No X-PAYMENT header - return EIP-2612 Permit challenge
    const body = await req.json()
    const { owner } = body

    console.log(`[/pong5:${requestId}] No X-PAYMENT header - generating challenge`)
    console.log(`[/pong5:${requestId}] Owner:`, owner)

    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return NextResponse.json(
        { error: 'Invalid owner address' },
        { status: 400 }
      )
    }

    // Get facilitator address (spender in permit)
    const facilitator = getWalletClient().account.address
    console.log(`[/pong5:${requestId}] Facilitator address:`, facilitator)

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

      console.log(`[/pong5:${requestId}] ✅✅✅ EIP-5267 eip712Domain() SUCCESS:`)
      console.log(`[/pong5:${requestId}]   Name: "${tokenName}"`)
      console.log(`[/pong5:${requestId}]   Version: "${tokenVersion}"`)
      console.log(`[/pong5:${requestId}]   ChainId: ${domainChainId}`)
      console.log(`[/pong5:${requestId}]   VerifyingContract: ${domain[4]}`)
    } catch (e: any) {
      console.error(`[/pong5:${requestId}] ❌ eip712Domain() failed:`, e.message)
      console.log(`[/pong5:${requestId}] Falling back to individual reads...`)

      // Fallback to individual reads
      try {
        tokenName = await publicClient.readContract({
          address: USD1_TOKEN,
          abi: usd1Abi,
          functionName: 'name',
        })
        console.log(`[/pong5:${requestId}] ✅ name():`, tokenName)
      } catch {
        console.log(`[/pong5:${requestId}] ⚠️  Using fallback name:`, TOKEN_NAME_FALLBACK)
      }

      try {
        tokenVersion = await publicClient.readContract({
          address: USD1_TOKEN,
          abi: usd1Abi,
          functionName: 'version',
        })
        console.log(`[/pong5:${requestId}] ✅ version():`, tokenVersion)
      } catch {
        console.log(`[/pong5:${requestId}] ⚠️  Using fallback version:`, TOKEN_VERSION_FALLBACK)
      }
    }

    // Read DOMAIN_SEPARATOR for verification
    try {
      const domainSeparator = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      })
      console.log(`[/pong5:${requestId}] DOMAIN_SEPARATOR from contract:`, domainSeparator)
    } catch (e: any) {
      console.log(`[/pong5:${requestId}] DOMAIN_SEPARATOR not available`)
    }

    // Read current nonce for the user from contract
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [owner as `0x${string}`],
    })

    console.log(`[/pong5:${requestId}] User nonce from contract:`, nonce.toString())

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

    console.log(`[/pong5:${requestId}] ===== EIP-2612 PERMIT DETAILS =====`)
    console.log(`[/pong5:${requestId}] Domain:`, {
      name: tokenName,
      version: tokenVersion,
      chainId: domainChainId,
      verifyingContract: USD1_TOKEN,
    })
    console.log(`[/pong5:${requestId}] Values:`, {
      owner,
      spender: facilitator,
      value: PRICE_MINOR,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    })

    console.log(`[/pong5:${requestId}] ===== SENDING 402 RESPONSE =====\\n`)

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
