import { NextResponse } from 'next/server'
import { publicClient, getWalletClient } from '@/lib/viem'
import { usd1Abi } from '@/lib/usd1Abi'

// USD1 Token & Treasury (immutable, official addresses on BSC)
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' as `0x${string}`
const TREASURY = '0x8676532800bEF0c69F8Af0A989dBf3943B1b408A' as `0x${string}`

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      TREASURY: TREASURY || 'MISSING',
      USD1_TOKEN: USD1_TOKEN || 'MISSING',
      FACILITATOR_PK: process.env.FACILITATOR_PK ? 'SET' : 'MISSING',
      RPC_URL: process.env.RPC_URL || 'default (bsc-dataseed)',
    },
    checks: {},
  }

  try {
    // Check if contract exists
    const code = await publicClient.getBytecode({ address: USD1_TOKEN })
    diagnostics.checks.contractExists = !!code && code !== '0x'
    diagnostics.checks.contractBytecodeLength = code?.length || 0

    // Try to read token name
    try {
      const name = await publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'name',
      })
      diagnostics.checks.tokenName = name
      diagnostics.checks.canReadContract = true
    } catch (error: any) {
      diagnostics.checks.canReadContract = false
      diagnostics.checks.readError = error.message
    }

    // Check facilitator balance
    try {
      const walletClient = getWalletClient()
      const facilitatorAddress = walletClient.account.address
      const balance = await publicClient.getBalance({ address: facilitatorAddress })
      diagnostics.checks.facilitatorAddress = facilitatorAddress
      diagnostics.checks.facilitatorBalance = balance.toString()
      diagnostics.checks.facilitatorBalanceBNB = (Number(balance) / 1e18).toFixed(4) + ' BNB'
      diagnostics.checks.hasGas = balance > BigInt(0)
    } catch (error: any) {
      diagnostics.checks.facilitatorError = error.message
    }

    // Check treasury address
    diagnostics.checks.treasuryAddress = TREASURY
    try {
      const treasuryBalance = await publicClient.getBalance({ address: TREASURY })
      diagnostics.checks.treasuryBalance = (Number(treasuryBalance) / 1e18).toFixed(4) + ' BNB'
    } catch (error: any) {
      diagnostics.checks.treasuryError = error.message
    }

    // Overall status
    diagnostics.ready =
      diagnostics.checks.contractExists &&
      diagnostics.checks.canReadContract &&
      diagnostics.checks.hasGas

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error: any) {
    diagnostics.error = error.message
    diagnostics.ready = false
    return NextResponse.json(diagnostics, { status: 500 })
  }
}
