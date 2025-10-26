import { createPublicClient, createWalletClient, http } from 'viem'
import { bsc } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org'
const FACILITATOR_PK = process.env.FACILITATOR_PK

if (!FACILITATOR_PK) {
  throw new Error('FACILITATOR_PK env not set')
}

export const publicClient = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
})

const account = privateKeyToAccount(FACILITATOR_PK as `0x${string}`)

export const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http(RPC_URL),
})
