import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'
import { getAddress, type Hex } from 'viem'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0xC0c241ba9A61303aa9A038788C68574172D3934e' as `0x${string}`
const USD1_DECIMALS = 18

// Configurable via env
const PRICE_MINOR = process.env.PRICE_MINOR || '10000000000000000000' // 10 USD1 with 18 decimals
const PONG_PER_USD1 = parseInt(process.env.PONG_PER_USD1 || '4000')

export async function POST(req: NextRequest) {
  const settlementId = Math.random().toString(36).substring(7)
  console.log(`\n[Settle:${settlementId}] ===== NEW SETTLEMENT =====`)

  try {
    const body = await req.json()
    const { owner, spender, value, nonce, deadline, signature } = body

    console.log(`[Settle:${settlementId}] EIP-2612 Permit received:`, {
      owner,
      spender,
      value,
      nonce,
      deadline,
      signature: signature?.slice(0, 20) + '...' + signature?.slice(-10),
    })

    // Validation
    if (!owner || !spender || !value || nonce === undefined || !deadline || !signature) {
      console.error(`[Settle:${settlementId}] Missing fields`)
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Split signature into v, r, s (exactly as x402-permit does)
    const sig = signature.slice(2) // Remove 0x prefix
    const r = `0x${sig.slice(0, 64)}` as `0x${string}`
    const s = `0x${sig.slice(64, 128)}` as `0x${string}`
    let v = parseInt(sig.slice(128, 130), 16)

    // Handle legacy v values (normalize 0/1 to 27/28)
    if (v < 27) {
      v += 27
    }

    console.log(`[Settle:${settlementId}] Signature components:`, {
      v,
      r: r.slice(0, 10) + '...',
      s: s.slice(0, 10) + '...',
    })

    // Validate value - must be 1, 5, or 10 USD1 (in minor units with 18 decimals)
    const validValues = [
      '1000000000000000000',  // 1 USD1
      '5000000000000000000',  // 5 USD1
      '10000000000000000000', // 10 USD1
    ]
    if (!validValues.includes(value)) {
      console.error(`[Settle:${settlementId}] Invalid value:`, value)
      return NextResponse.json(
        { error: `Invalid value. Expected 1, 5, or 10 USD1 (with 18 decimals)` },
        { status: 422 }
      )
    }

    // Validate deadline
    const now = Math.floor(Date.now() / 1000)
    if (parseInt(deadline) <= now) {
      console.error(`[Settle:${settlementId}] Permit expired`)
      return NextResponse.json(
        { error: 'Permit expired. Please request a new challenge.' },
        { status: 422 }
      )
    }

    console.log(`[Settle:${settlementId}] All validations passed`)

    // Get wallet client
    const walletClient = getWalletClient()
    const facilitator = walletClient.account.address

    console.log(`[Settle:${settlementId}] Facilitator:`, facilitator)
    console.log(`[Settle:${settlementId}] Treasury:`, TREASURY)

    // Validate spender is facilitator
    if (spender.toLowerCase() !== facilitator.toLowerCase()) {
      console.error(`[Settle:${settlementId}] Invalid spender - Expected ${facilitator}, got ${spender}`)
      return NextResponse.json(
        { error: 'Invalid spender address' },
        { status: 422 }
      )
    }

    // CRITICAL: Verify signature locally BEFORE submitting to blockchain (x402-permit pattern)
    // This catches signature issues early and provides better error messages
    console.log(`[Settle:${settlementId}] ===== VERIFYING SIGNATURE LOCALLY =====`)

    // Read token name and version for EIP-712 domain
    // MUST match exactly what was used in challenge generation!
    let tokenName: string
    let tokenVersion = '1' // USD1 doesn't have version(), always use "1"

    try {
      tokenName = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'name',
      }) as string
      console.log(`[Settle:${settlementId}] ✅ name() from contract: "${tokenName}"`)
    } catch (e: any) {
      // Fallback if name() fails
      tokenName = 'World Liberty Financial USD'
      console.log(`[Settle:${settlementId}] ⚠️ name() failed, using fallback: "${tokenName}"`)
    }

    console.log(`[Settle:${settlementId}] Token: ${tokenName} v${tokenVersion}`)

    // Verify current nonce from contract
    const currentNonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [owner as `0x${string}`],
    })
    console.log(`[Settle:${settlementId}] Current nonce from contract: ${currentNonce.toString()}`)
    console.log(`[Settle:${settlementId}] Nonce from signature: ${nonce}`)

    if (currentNonce.toString() !== nonce.toString()) {
      console.error(`[Settle:${settlementId}] ❌ NONCE MISMATCH!`)
      console.error(`[Settle:${settlementId}]   Expected: ${currentNonce.toString()}`)
      console.error(`[Settle:${settlementId}]   Got: ${nonce}`)
      return NextResponse.json(
        { error: 'Nonce mismatch - please request a new challenge' },
        { status: 422 }
      )
    }

    console.log(`[Settle:${settlementId}] ✅ Nonce matches!`)

    // Construct EIP-712 typed data for signature verification (x402-permit pattern)
    const permitTypedData = {
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      domain: {
        name: tokenName,
        version: tokenVersion,
        chainId: 56,
        verifyingContract: getAddress(USD1_TOKEN),
      },
      primaryType: 'Permit' as const,
      message: {
        owner: getAddress(owner),
        spender: getAddress(spender),
        value: BigInt(value),
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
      },
    }

    console.log(`[Settle:${settlementId}] ===== VERIFICATION DATA =====`)
    console.log(`[Settle:${settlementId}] Domain:`)
    console.log(`[Settle:${settlementId}]   name: "${permitTypedData.domain.name}"`)
    console.log(`[Settle:${settlementId}]   version: "${permitTypedData.domain.version}"`)
    console.log(`[Settle:${settlementId}]   chainId: ${permitTypedData.domain.chainId}`)
    console.log(`[Settle:${settlementId}]   verifyingContract: ${permitTypedData.domain.verifyingContract}`)
    console.log(`[Settle:${settlementId}] Message:`)
    console.log(`[Settle:${settlementId}]   owner: ${permitTypedData.message.owner}`)
    console.log(`[Settle:${settlementId}]   spender: ${permitTypedData.message.spender}`)
    console.log(`[Settle:${settlementId}]   value: ${permitTypedData.message.value.toString()}`)
    console.log(`[Settle:${settlementId}]   nonce: ${permitTypedData.message.nonce.toString()}`)
    console.log(`[Settle:${settlementId}]   deadline: ${permitTypedData.message.deadline.toString()}`)
    console.log(`[Settle:${settlementId}] Signature: ${signature}`)

    // Verify signature using viem's verifyTypedData (x402-permit pattern)
    try {
      const isValid = await publicClient.verifyTypedData({
        address: getAddress(owner) as `0x${string}`,
        ...permitTypedData,
        signature: signature as Hex,
      })

      if (!isValid) {
        console.error(`[Settle:${settlementId}] ❌ SIGNATURE VERIFICATION FAILED!`)
        console.error(`[Settle:${settlementId}]   Expected signer: ${getAddress(owner)}`)
        console.error(`[Settle:${settlementId}]   Signature: ${signature}`)
        console.error(`[Settle:${settlementId}]`)
        console.error(`[Settle:${settlementId}] 🔍 DEBUGGING TIPS:`)
        console.error(`[Settle:${settlementId}]   1. Check the challenge logs to see what domain was sent to frontend`)
        console.error(`[Settle:${settlementId}]   2. Domain name MUST be: "${tokenName}"`)
        console.error(`[Settle:${settlementId}]   3. Domain version MUST be: "${tokenVersion}"`)
        console.error(`[Settle:${settlementId}]   4. All addresses must be checksummed (getAddress())`)
        console.error(`[Settle:${settlementId}]   5. Run: node test-signature-recovery.js ${owner} ${spender} ${value} ${nonce} ${deadline} ${signature}`)
        return NextResponse.json(
          {
            error: 'Invalid signature or unauthorized signer',
            details: 'Signature verification failed - the signature does not match the owner address'
          },
          { status: 422 }
        )
      }

      console.log(`[Settle:${settlementId}] ✅ Signature verified successfully!`)
    } catch (verifyError: any) {
      console.error(`[Settle:${settlementId}] ❌ Signature verification error:`, verifyError.message)
      console.error(`[Settle:${settlementId}] Stack:`, verifyError.stack)
      return NextResponse.json(
        {
          error: 'Signature verification failed',
          details: verifyError.message
        },
        { status: 422 }
      )
    }

    // Get facilitator nonce for parallel transaction submission
    const facilitatorNonce = await publicClient.getTransactionCount({
      address: walletClient.account.address,
    })

    console.log(`[Settle:${settlementId}] ===== EXECUTING PERMIT() + TRANSFERFROM() IN PARALLEL =====`)
    console.log(`[Settle:${settlementId}] Facilitator nonce: ${facilitatorNonce}`)

    // Log EXACT values being sent to permit()
    console.log(`[Settle:${settlementId}] permit() args:`)
    console.log(`[Settle:${settlementId}]   owner: ${owner}`)
    console.log(`[Settle:${settlementId}]   spender: ${spender}`)
    console.log(`[Settle:${settlementId}]   value: ${value} => BigInt: ${BigInt(value).toString()}`)
    console.log(`[Settle:${settlementId}]   deadline: ${deadline} => BigInt: ${BigInt(deadline).toString()}`)
    console.log(`[Settle:${settlementId}]   v: ${v}`)
    console.log(`[Settle:${settlementId}]   r: ${r}`)
    console.log(`[Settle:${settlementId}]   s: ${s}`)

    // Send both transactions in parallel (x402-permit pattern)
    // Use getAddress() for proper address normalization (checksumming)
    const [permitHash, transferHash] = await Promise.all([
      // Transaction 1: permit()
      walletClient.writeContract({
        address: getAddress(USD1_TOKEN) as `0x${string}`,
        abi: usd1Abi,
        functionName: 'permit',
        args: [
          getAddress(owner) as `0x${string}`,
          getAddress(spender) as `0x${string}`,
          BigInt(value),
          BigInt(deadline),
          v,
          r as `0x${string}`,
          s as `0x${string}`,
        ] as const,
        chain: null,
        nonce: facilitatorNonce,
      }),
      // Transaction 2: transferFrom()
      walletClient.writeContract({
        address: getAddress(USD1_TOKEN) as `0x${string}`,
        abi: usd1Abi,
        functionName: 'transferFrom',
        args: [
          getAddress(owner) as `0x${string}`,
          getAddress(TREASURY) as `0x${string}`,
          BigInt(value),
        ] as const,
        chain: null,
        nonce: facilitatorNonce + 1,
      }),
    ])

    console.log(`[Settle:${settlementId}] Permit tx sent:`, permitHash)
    console.log(`[Settle:${settlementId}] Transfer tx sent:`, transferHash)

    // Wait for both transactions in parallel
    const [permitReceipt, transferReceipt] = await Promise.all([
      publicClient.waitForTransactionReceipt({ hash: permitHash }),
      publicClient.waitForTransactionReceipt({ hash: transferHash }),
    ])

    console.log(`[Settle:${settlementId}] Permit confirmed!`)
    console.log(`[Settle:${settlementId}] Transfer confirmed!`)

    if (transferReceipt.status !== 'success') {
      console.error(`[Settle:${settlementId}] ❌ Transfer failed!`)
      return NextResponse.json(
        { error: 'Transfer transaction failed' },
        { status: 400 }
      )
    }

    // Calculate PONG allocation based on actual value transferred (18 decimals)
    const allocationPONG = (Number(BigInt(value) / BigInt(10 ** 18))) * PONG_PER_USD1

    console.log(`[Settle:${settlementId}] ===== SETTLEMENT COMPLETE =====`)
    console.log(`[Settle:${settlementId}] Permit tx: ${permitHash}`)
    console.log(`[Settle:${settlementId}] Transfer tx: ${transferHash}`)
    console.log(`[Settle:${settlementId}] PONG allocated: ${allocationPONG}`)

    return NextResponse.json(
      {
        status: 'ok',
        txHash: transferHash,
        permitHash,
        amountMinor: value,
        allocationPONG,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Settle] Error:', error)
    console.error('[Settle] Error details:', {
      message: error.message,
      cause: error.cause,
      shortMessage: error.shortMessage,
      details: error.details,
      metaMessages: error.metaMessages,
    })

    // Handle specific errors
    if (error.message?.includes('signature') || error.message?.includes('invalid signer')) {
      return NextResponse.json(
        { error: 'Invalid signature or unauthorized signer', details: error.shortMessage || error.message },
        { status: 422 }
      )
    }

    if (error.message?.includes('nonce')) {
      return NextResponse.json(
        { error: 'Nonce already used or invalid', details: error.shortMessage || error.message },
        { status: 422 }
      )
    }

    if (error.message?.includes('insufficient')) {
      return NextResponse.json(
        { error: 'Insufficient balance or gas', details: error.shortMessage || error.message },
        { status: 400 }
      )
    }

    if (error.message?.includes('execution reverted')) {
      return NextResponse.json(
        { error: 'Contract execution reverted', details: error.shortMessage || error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Settlement failed', details: error.shortMessage || error.message },
      { status: 400 }
    )
  }
}
