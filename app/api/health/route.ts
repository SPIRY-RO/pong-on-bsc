import { NextResponse } from 'next/server'

export async function GET() {
  const config = {
    status: 'ok',
    env: {
      TREASURY: process.env.TREASURY ? '✅ Set' : '❌ Missing',
      USD1_TOKEN: process.env.USD1_TOKEN ? '✅ Set' : '❌ Missing',
      FACILITATOR_PK: process.env.FACILITATOR_PK ? '✅ Set' : '❌ Missing',
      RPC_URL: process.env.RPC_URL ? '✅ Set' : '⚠️  Using default',
      PRICE_MINOR: process.env.PRICE_MINOR || '10000000 (default)',
      TOKEN_NAME: process.env.TOKEN_NAME || 'USD1 (default)',
      CHALLENGE_MINUTES: process.env.CHALLENGE_MINUTES || '15 (default)',
      PONG_PER_USD1: process.env.PONG_PER_USD1 || '4000 (default)',
    },
    ready: !!(process.env.TREASURY && process.env.USD1_TOKEN && process.env.FACILITATOR_PK),
  }

  return NextResponse.json(config)
}
