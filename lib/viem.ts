import { createPublicClient, createWalletClient, http, type WalletClient, type Chain, type Transport, type Account } from 'viem'
import { bsc } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org'
const FACILITATOR_PK = process.env.FACILITATOR_PK

export const publicClient = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
})

type WalletClientType = WalletClient<Transport, Chain, Account>
let _walletClient: WalletClientType | null = null

export const getWalletClient = (): WalletClientType => {
  if (!FACILITATOR_PK) {
    throw new Error('FACILITATOR_PK env not set')
  }

  if (!_walletClient) {
    const account = privateKeyToAccount(FACILITATOR_PK as `0x${string}`)
    _walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(RPC_URL),
    })
  }

  return _walletClient
}
