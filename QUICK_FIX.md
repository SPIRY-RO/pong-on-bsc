# Quick Fix: Transaction Ordering Issue

## Problem

In `/Users/spiry/Documents/GitHub/pong-on-bsc/app/settle/route.ts` (lines 141-172), both `permit()` and `transferFrom()` transactions are submitted in parallel:

```typescript
const [permitHash, transferHash] = await Promise.all([
  walletClient.writeContract({ functionName: 'permit', nonce: facilitatorNonce }),
  walletClient.writeContract({ functionName: 'transferFrom', nonce: facilitatorNonce + 1 }),
])
```

**Risk:** The `transferFrom()` might be mined BEFORE `permit()`, causing it to fail (no allowance yet).

## Solution

Replace the parallel execution with sequential execution:

```typescript
// Step 1: Execute permit() first
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

console.log(`[Settle:${settlementId}] Permit tx sent:`, permitHash)
await publicClient.waitForTransactionReceipt({ hash: permitHash })
console.log(`[Settle:${settlementId}] Permit confirmed!`)

// Step 2: Execute transferFrom() after permit is confirmed
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

console.log(`[Settle:${settlementId}] Transfer tx sent:`, transferHash)
await publicClient.waitForTransactionReceipt({ hash: transferHash })
console.log(`[Settle:${settlementId}] Transfer confirmed!`)
```

## Benefits

1. **Guaranteed Order:** `transferFrom()` will ALWAYS execute after `permit()` is confirmed
2. **No Failed Transactions:** Won't pay gas for failed `transferFrom()` due to missing allowance
3. **Simpler Logic:** No need to manage nonces manually
4. **More Reliable:** Works under all network conditions

## Performance Note

This adds ~3-5 seconds to settlement time (waiting for permit confirmation), but:
- Prevents transaction failures
- Saves gas from failed transactions
- More predictable user experience

The settlement flow already takes time for:
1. User signing (5-10 seconds)
2. Transaction submission (1-2 seconds)
3. Block confirmation (3-5 seconds)

Adding 3-5 seconds is acceptable for reliability.

## Implementation

See lines 122-163 in the updated settle/route.ts. Remove lines 141-172 and replace with the sequential approach shown above.
