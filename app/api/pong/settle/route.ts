import { NextRequest, NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { eip3009Abi } from '@/lib/eip3009Abi'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0xC0c241ba9A61303aa9A038788C68574172D3934e' as `0x${string}`
const USD1_DECIMALS = 18

// Configurable via env
const PRICE_MINOR = process.env.PRICE_MINOR || '10000000000000000000' // 10 USD1 with 18 decimals
const PONG_PER_USD1 = parseInt(process.env.PONG_PER_USD1 || '4000')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = body

    console.log('[Settle] Received request:', { from, to, value, validAfter, validBefore, nonce: nonce?.slice(0, 10), v, r: r?.slice(0, 10), s: s?.slice(0, 10) })

    // Validation
    if (!from || !to || !value || validAfter === undefined || !validBefore || !nonce || !v || !r || !s) {
      console.error('[Settle] Missing fields:', { from: !!from, to: !!to, value: !!value, validAfter, validBefore: !!validBefore, nonce: !!nonce, v, r: !!r, s: !!s })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate to address
    if (to.toLowerCase() !== TREASURY.toLowerCase()) {
      console.error('[Settle] Invalid to address:', { to, expected: TREASURY })
      return NextResponse.json(
        { error: `Invalid 'to' address. Expected ${TREASURY}` },
        { status: 422 }
      )
    }

    // Validate value - must be 1, 5, or 10 USD1 (in minor units with 18 decimals)
    const validValues = [
      '1000000000000000000',  // 1 USD1
      '5000000000000000000',  // 5 USD1
      '10000000000000000000', // 10 USD1
    ]
    if (!validValues.includes(value)) {
      console.error('[Settle] Invalid value:', { value, validValues })
      return NextResponse.json(
        { error: `Invalid value. Expected 1, 5, or 10 USD1 (with 18 decimals)` },
        { status: 422 }
      )
    }

    // Validate validBefore
    const now = Math.floor(Date.now() / 1000)
    if (parseInt(validBefore) <= now) {
      console.error('[Settle] Challenge expired:', { validBefore, now })
      return NextResponse.json(
        { error: 'Challenge expired. Please request a new challenge.' },
        { status: 422 }
      )
    }

    console.log('[Settle] All validations passed, executing transferWithAuthorization...')
    console.log('[Settle] Token:', USD1_TOKEN, 'Treasury:', TREASURY)

    // Execute transferWithAuthorization
    const walletClient = getWalletClient()

    console.log('[Settle] Transaction args:', {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce: nonce.slice(0, 10) + '...',
      v,
      r: r.slice(0, 10) + '...',
      s: s.slice(0, 10) + '...',
    })

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
      ] as const,
      chain: null,
    })

    console.log('[Settle] Transaction sent:', hash)

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash })

    // Calculate PONG allocation based on actual value transferred (18 decimals)
    const allocationPONG = (Number(BigInt(value) / BigInt(10 ** 18))) * PONG_PER_USD1

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
