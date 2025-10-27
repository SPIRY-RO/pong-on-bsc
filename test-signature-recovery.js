/**
 * Signature Recovery Test
 *
 * This script helps debug EIP-2612 permit signature issues by:
 * 1. Computing the digest that the contract will use
 * 2. Recovering the signer address from the signature
 * 3. Comparing it with the expected owner address
 *
 * Usage:
 * node test-signature-recovery.js <owner> <spender> <value> <nonce> <deadline> <signature>
 */

const { ethers } = require('ethers')

// USD1 Token configuration on BSC
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d'
const CHAIN_ID = 56

// EIP-712 Domain (MUST match exactly what contract uses)
const domain = {
  name: 'World Liberty Financial USD',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: USD1_TOKEN,
}

// Permit type definition
const types = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

async function testSignatureRecovery(owner, spender, value, nonce, deadline, signature) {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('               SIGNATURE RECOVERY TEST')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('📋 Input Parameters:')
  console.log(`   Owner:    ${owner}`)
  console.log(`   Spender:  ${spender}`)
  console.log(`   Value:    ${value}`)
  console.log(`   Nonce:    ${nonce}`)
  console.log(`   Deadline: ${deadline}`)
  console.log(`   Signature: ${signature}\n`)

  // Validate signature format
  if (!signature.startsWith('0x')) {
    console.error('❌ ERROR: Signature must start with 0x')
    return
  }

  if (signature.length !== 132) {
    console.error(`❌ ERROR: Signature must be 132 characters (0x + 130 hex), got ${signature.length}`)
    return
  }

  // Split signature into v, r, s
  const sig = signature.slice(2)
  const r = '0x' + sig.slice(0, 64)
  const s = '0x' + sig.slice(64, 128)
  let v = parseInt(sig.slice(128, 130), 16)

  console.log('🔧 Signature Components:')
  console.log(`   r: ${r}`)
  console.log(`   s: ${s}`)
  console.log(`   v: ${v} (raw)\n`)

  // Normalize v to 27 or 28
  if (v < 27) {
    v += 27
    console.log(`   v: ${v} (normalized to 27/28)\n`)
  }

  // Construct the permit message
  const message = {
    owner,
    spender,
    value,
    nonce,
    deadline,
  }

  console.log('📝 EIP-712 Domain:')
  console.log(`   name: "${domain.name}"`)
  console.log(`   version: "${domain.version}"`)
  console.log(`   chainId: ${domain.chainId}`)
  console.log(`   verifyingContract: ${domain.verifyingContract}\n`)

  console.log('📝 Permit Message:')
  console.log(`   owner: ${message.owner}`)
  console.log(`   spender: ${message.spender}`)
  console.log(`   value: ${message.value}`)
  console.log(`   nonce: ${message.nonce}`)
  console.log(`   deadline: ${message.deadline}\n`)

  try {
    // Compute EIP-712 digest (this is what MetaMask signed)
    const digest = ethers.TypedDataEncoder.hash(domain, types, message)
    console.log('🔐 EIP-712 Digest:')
    console.log(`   ${digest}\n`)

    // Recover signer from signature
    const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature)

    console.log('✅ Recovered Address:')
    console.log(`   ${recoveredAddress}\n`)

    // Compare with expected owner
    const match = recoveredAddress.toLowerCase() === owner.toLowerCase()

    console.log('═══════════════════════════════════════════════════════════════')
    if (match) {
      console.log('✅ SUCCESS: Signature is VALID!')
      console.log(`   Recovered address matches owner: ${owner}`)
    } else {
      console.log('❌ FAILURE: Signature is INVALID!')
      console.log(`   Expected:  ${owner}`)
      console.log(`   Recovered: ${recoveredAddress}`)
      console.log('\n🔍 Possible causes:')
      console.log('   1. User signed with different domain parameters')
      console.log('   2. Nonce changed between signing and now')
      console.log('   3. Wrong owner/spender/value/deadline was signed')
      console.log('   4. Signature was corrupted during transmission')
    }
    console.log('═══════════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ ERROR during signature recovery:', error.message)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('\n📖 Usage:')
  console.log('   node test-signature-recovery.js <owner> <spender> <value> <nonce> <deadline> <signature>\n')
  console.log('📝 Example:')
  console.log('   node test-signature-recovery.js \\')
  console.log('     0x1234...abcd \\  # owner')
  console.log('     0x5678...ef01 \\  # spender')
  console.log('     1000000000000000000 \\  # value (1 USD1 with 18 decimals)')
  console.log('     0 \\  # nonce')
  console.log('     1700000000 \\  # deadline')
  console.log('     0x1234...5678  # signature (132 chars)\n')
  process.exit(0)
}

if (args.length !== 6) {
  console.error('❌ ERROR: Expected 6 arguments, got', args.length)
  console.log('\nRun without arguments to see usage')
  process.exit(1)
}

const [owner, spender, value, nonce, deadline, signature] = args

testSignatureRecovery(owner, spender, value, nonce, deadline, signature)
