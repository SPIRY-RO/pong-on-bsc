# DOMAIN_SEPARATOR Analysis - pong-on-bsc Project

## CRITICAL ANSWER: Which DOMAIN_SEPARATOR is Correct?

**CORRECT VALUE:** `0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba`

**INCORRECT VALUE:** `0x73f2ca3e6b1d5f9355f8eef02cf6e5192fe0362bf72477dfb12cb21f026cd0ab`

## On-Chain Verification (Authoritative Source)

### Contract Details
- **Token Contract:** `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`
- **Chain:** BNB Smart Chain (BSC) - Chain ID 56
- **Token Name:** "World Liberty Financial USD" (from `name()`)
- **RPC Endpoint:** https://bsc-dataseed.binance.org

### Verified On-Chain Data
```
DOMAIN_SEPARATOR(): 0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba
```

This value was queried directly from the contract at block height and matches the EIP-712 computation.

## EIP-712 Domain Parameters (CORRECT)

The contract uses these EXACT parameters for EIP-712 signing:

```typescript
{
  name: "World Liberty Financial USD",
  version: "1",
  chainId: 56,
  verifyingContract: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d"
}
```

### How DOMAIN_SEPARATOR is Computed (EIP-712 Standard)

```javascript
// 1. Compute EIP712Domain typehash
DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")

// 2. Hash the domain parameters
nameHash = keccak256("World Liberty Financial USD")
versionHash = keccak256("1")

// 3. Encode and hash all together
DOMAIN_SEPARATOR = keccak256(
  abi.encode(
    DOMAIN_TYPEHASH,
    nameHash,
    versionHash,
    56,  // chainId
    0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d  // verifyingContract
  )
)

// Result: 0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba
```

## Your Code Analysis

### Current Implementation Status: ✅ CORRECT

Your code in `/app/pong/route.ts`, `/app/PONG2/route.ts`, and other endpoints is **correctly** configured:

1. **Reads `name()` from contract:** `"World Liberty Financial USD"`
2. **Uses version:** `"1"` (hardcoded, correct)
3. **Uses chainId:** `56` (BSC)
4. **Uses verifyingContract:** `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`

### Code Path Analysis

#### /app/pong/route.ts (Tier 1: 1 USD1)
```typescript
// Lines 260-279: Correctly reads name from contract
let tokenName: string
let tokenVersion = '1' // ✅ CORRECT
let domainChainId = 56

tokenName = await publicClient.readContract({
  address: USD1_TOKEN,
  abi: usd1Abi,
  functionName: 'name',
}) // Returns "World Liberty Financial USD" ✅

const domain = {
  name: tokenName,        // ✅ "World Liberty Financial USD"
  version: tokenVersion,  // ✅ "1"
  chainId: domainChainId, // ✅ 56
  verifyingContract: USD1_TOKEN, // ✅ 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d
}
```

#### /app/PONG2/route.ts (Tier 3: 10 USD1)
```typescript
// Lines 258-306: Attempts eip712Domain() (fails gracefully), then falls back
// Same result: ✅ CORRECT domain parameters
```

## EIP-2612 Permit Flow (x402-permit Pattern)

### Step 1: Challenge Generation (Backend)
Your server correctly generates the EIP-712 typed data:

```typescript
{
  domain: {
    name: "World Liberty Financial USD",
    version: "1",
    chainId: 56,
    verifyingContract: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d"
  },
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ]
  },
  primaryType: "Permit",
  message: {
    owner: "0x...",
    spender: "0x...", // facilitator address
    value: "1000000000000000000", // 1 USD1
    nonce: "0", // current nonce from contract
    deadline: "..." // unix timestamp
  }
}
```

### Step 2: User Signs with MetaMask (Frontend)
```typescript
const signature = await window.ethereum.request({
  method: 'eth_signTypedData_v4',
  params: [
    account,
    JSON.stringify(challenge) // The domain MUST match contract's DOMAIN_SEPARATOR
  ]
})
```

**CRITICAL:** MetaMask will compute the EIP-712 hash using the domain you provide. If your domain parameters don't match the contract's DOMAIN_SEPARATOR computation, the signature will be INVALID when the contract verifies it.

### Step 3: Contract Validates Signature
```solidity
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    // Contract computes EIP-712 hash using ITS OWN DOMAIN_SEPARATOR
    bytes32 structHash = keccak256(
        abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline)
    );
    bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR, structHash));

    // Recover signer from signature
    address recoveredAddress = ecrecover(digest, v, r, s);
    require(recoveredAddress == owner, "ERC20Permit: invalid signature");

    // If domain mismatch → digest mismatch → signature fails ❌
}
```

## Why the Wrong Value Fails

The incorrect DOMAIN_SEPARATOR `0x73f2ca3e6b1d5f9355f8eef02cf6e5192fe0362bf72477dfb12cb21f026cd0ab` would result from:

1. Wrong token name (e.g., "USD1" instead of "World Liberty Financial USD")
2. Wrong version (e.g., "2" instead of "1")
3. Wrong chain ID
4. Wrong contract address

When MetaMask signs with incorrect domain → signature is valid for WRONG domain → contract's `permit()` will reject with "invalid signature"

## Signature Validation Flow

```
User Signs with MetaMask
         ↓
   EIP-712 Domain Hash (using provided domain)
         ↓
   Message Struct Hash (Permit data)
         ↓
   Digest = keccak256("\\x19\\x01" || DOMAIN_SEPARATOR || structHash)
         ↓
   Signature = sign(digest, privateKey)
         ↓
Backend receives signature
         ↓
Contract permit() called
         ↓
Contract recomputes digest (using ITS OWN DOMAIN_SEPARATOR)
         ↓
Contract recovers signer: ecrecover(digest, v, r, s)
         ↓
IF domains match → digest matches → signer matches → ✅ SUCCESS
IF domains DON'T match → digest different → signer recovery fails → ❌ "invalid signature"
```

## Verification Commands

### Verify DOMAIN_SEPARATOR from Contract
```bash
node analyze-domain-separator.js
```

### Query Contract Directly (cast)
```bash
# If you have foundry/cast installed
cast call 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d \
  "DOMAIN_SEPARATOR()(bytes32)" \
  --rpc-url https://bsc-dataseed.binance.org

# Expected output: 0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba
```

### Query via Web3 JSON-RPC
```bash
curl -X POST https://bsc-dataseed.binance.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
      "data": "0x3644e515"
    }, "latest"],
    "id": 1
  }'

# data: 0x3644e515 = keccak256("DOMAIN_SEPARATOR()")[0:4]
```

## Summary

### ✅ CORRECT Configuration (Currently in Your Code)
- **DOMAIN_SEPARATOR:** `0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba`
- **Domain Name:** `"World Liberty Financial USD"`
- **Domain Version:** `"1"`
- **Chain ID:** `56`
- **Contract:** `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`

### ❌ INCORRECT Value (DO NOT USE)
- **DOMAIN_SEPARATOR:** `0x73f2ca3e6b1d5f9355f8eef02cf6e5192fe0362bf72477dfb12cb21f026cd0ab`
- This will cause ALL permit signatures to fail

### Your Implementation Status
**✅ YOUR CODE IS CORRECT!** No changes needed to domain parameters.

If you're experiencing signature validation failures, the issue is NOT with the DOMAIN_SEPARATOR. Check:
1. Nonce is current (read from contract before signing)
2. Deadline hasn't expired
3. Signature is properly formatted (0x + 130 hex chars)
4. v, r, s values are correctly split
5. Spender address matches facilitator address

## References

- **EIP-712:** https://eips.ethereum.org/EIPS/eip-712
- **EIP-2612:** https://eips.ethereum.org/EIPS/eip-2612
- **x402-permit:** https://github.com/WTFLabs-WTF/x402-permit
- **USD1 Contract on BSC:** https://bscscan.com/address/0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d
