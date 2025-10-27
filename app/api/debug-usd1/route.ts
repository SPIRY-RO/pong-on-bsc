import { NextResponse } from 'next/server'
import { publicClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'

const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`

export async function GET() {
  try {
    // Read all EIP-2612 related info from USD1 contract
    const name = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'name',
    })

    let version = 'FAILED'
    try {
      version = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'version',
      })
    } catch (e: any) {
      version = `ERROR: ${e.message}`
    }

    let domainSeparator = 'FAILED'
    try {
      domainSeparator = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      })
    } catch (e: any) {
      domainSeparator = `ERROR: ${e.message}`
    }

    // Test nonce for a random address
    const testAddress = '0x0000000000000000000000000000000000000001'
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [testAddress as `0x${string}`],
    })

    return NextResponse.json({
      contract: USD1_TOKEN,
      name,
      version,
      domainSeparator,
      testNonce: nonce.toString(),
      chainId: 56,
      eip2612Domain: {
        name,
        version,
        chainId: 56,
        verifyingContract: USD1_TOKEN,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, details: error.toString() },
      { status: 500 }
    )
  }
}
