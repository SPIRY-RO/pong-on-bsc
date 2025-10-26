# PONG on BSC

A Vercel-ready Next.js app implementing x402 paywall with EIP-3009 (gasless transfers) on BNB Chain. Pay 10 USD1 to receive 40,000 PONG allocation (handled off-chain).

## Features

- **x402 Protocol**: Standard HTTP 402 payment descriptor and challenge flow
- **EIP-3009**: TransferWithAuthorization for gasless payments (payer only signs, facilitator submits)
- **Dark Minimal UI**: Inspired by peng.observer aesthetic
- **Stateless**: No database, no persistence—pure API logic
- **Production-ready**: Vercel deployment with TypeScript + viem

## Architecture

```
GET  /api/pong         → 402 payment descriptor (x402 format)
POST /api/pong         → 402 EIP-3009 typed-data challenge
POST /api/pong/settle  → 201 execute transfer, return txHash + allocation
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

**Required variables:**

- `FACILITATOR_PK`: Private key of wallet that will submit transactions (must have BNB for gas)
- `TREASURY`: Address to receive USD1 payments
- `USD1_TOKEN`: EIP-3009 compliant token contract address on BNB Chain
- `RPC_URL`: BNB Chain RPC endpoint (default: https://bsc-dataseed.binance.org)

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel

1. Push to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard (Settings → Environment Variables)
4. Deploy

```bash
vercel --prod
```

## API Examples

### Get payment descriptor

```bash
curl -i https://your-site.vercel.app/api/pong
```

Response (402):

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "bsc",
      "maxAmountRequired": "10000000",
      "asset": "0xYourUSD1TokenAddress",
      "payTo": "0xYourTreasury"
    }
  ],
  "product": "PONG",
  "note": "Pay 10 USD1 (EIP-3009) to receive 40,000 PONG allocation (handled off-chain)"
}
```

### Request challenge

```bash
curl -X POST https://your-site.vercel.app/api/pong \
  -H "Content-Type: application/json" \
  -d '{"owner":"0xYourWalletAddress"}'
```

Response (402):

```json
{
  "domain": {
    "name": "USD1",
    "version": "1",
    "chainId": 56,
    "verifyingContract": "0xTokenAddress"
  },
  "types": {
    "TransferWithAuthorization": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" }
    ]
  },
  "values": {
    "from": "0xYourWalletAddress",
    "to": "0xTreasury",
    "value": "10000000",
    "validAfter": 0,
    "validBefore": 1234567890,
    "nonce": "0xrandomhex..."
  },
  "primaryType": "TransferWithAuthorization"
}
```

### Settle payment

```bash
curl -X POST https://your-site.vercel.app/api/pong/settle \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xYourAddress",
    "to": "0xTreasury",
    "value": "10000000",
    "validAfter": 0,
    "validBefore": 1234567890,
    "nonce": "0xhex...",
    "v": 27,
    "r": "0xhex...",
    "s": "0xhex..."
  }'
```

Response (201):

```json
{
  "status": "ok",
  "txHash": "0xtransactionhash...",
  "amountMinor": "10000000",
  "allocationPONG": 40000
}
```

## Security

- `FACILITATOR_PK` must be kept secret (server-side only)
- Facilitator wallet needs BNB for gas
- User signatures are validated on-chain via EIP-3009
- Challenge expires in 15 minutes (configurable via `CHALLENGE_MINUTES`)
- No private keys in browser—user only signs typed data

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- viem (Ethereum library)
- BNB Chain (chainId 56)
- EIP-3009 (TransferWithAuthorization)

## License

MIT
