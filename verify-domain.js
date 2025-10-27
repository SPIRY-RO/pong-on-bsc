// Verification script to check USD1 contract EIP-712 domain configuration
// Run with: node verify-domain.js

const { createPublicClient, http, keccak256, encodePacked, toHex } = require('viem');
const { bsc } = require('viem/chains');

const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
const RPC_URL = 'https://bsc-dataseed.binance.org';

const usd1Abi = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { internalType: 'bytes1', name: 'fields', type: 'bytes1' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'version', type: 'string' },
      { internalType: 'uint256', name: 'chainId', type: 'uint256' },
      { internalType: 'address', name: 'verifyingContract', type: 'address' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'uint256[]', name: 'extensions', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
});

async function verifyDomain() {
  console.log('='.repeat(80));
  console.log('USD1 TOKEN EIP-712 DOMAIN VERIFICATION');
  console.log('='.repeat(80));
  console.log(`Contract: ${USD1_TOKEN}`);
  console.log(`Network: BNB Chain (chainId: 56)`);
  console.log();

  // Test 1: Try EIP-5267 eip712Domain() - the most reliable method
  console.log('TEST 1: EIP-5267 eip712Domain()');
  console.log('-'.repeat(80));
  try {
    const domain = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'eip712Domain',
    });

    console.log('✅ SUCCESS - Contract implements EIP-5267');
    console.log(`Fields: ${domain[0]}`);
    console.log(`Name: "${domain[1]}"`);
    console.log(`Version: "${domain[2]}"`);
    console.log(`ChainId: ${domain[3]}`);
    console.log(`VerifyingContract: ${domain[4]}`);
    console.log(`Salt: ${domain[5]}`);
    console.log(`Extensions: ${domain[6]}`);
    console.log();
  } catch (error) {
    console.log('❌ FAILED - Contract does not implement EIP-5267');
    console.log(`Error: ${error.message}`);
    console.log();
  }

  // Test 2: Read name()
  console.log('TEST 2: name()');
  console.log('-'.repeat(80));
  try {
    const name = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'name',
    });
    console.log(`✅ name() = "${name}"`);
    console.log();
  } catch (error) {
    console.log('❌ name() failed:', error.message);
    console.log();
  }

  // Test 3: Read version()
  console.log('TEST 3: version()');
  console.log('-'.repeat(80));
  try {
    const version = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'version',
    });
    console.log(`✅ version() = "${version}"`);
    console.log();
  } catch (error) {
    console.log('❌ version() failed (this is OK for some EIP-2612 implementations)');
    console.log('   Fallback to version "1"');
    console.log();
  }

  // Test 4: Read DOMAIN_SEPARATOR
  console.log('TEST 4: DOMAIN_SEPARATOR()');
  console.log('-'.repeat(80));
  try {
    const domainSeparator = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'DOMAIN_SEPARATOR',
    });
    console.log(`✅ DOMAIN_SEPARATOR = ${domainSeparator}`);
    console.log();
  } catch (error) {
    console.log('❌ DOMAIN_SEPARATOR() failed:', error.message);
    console.log();
  }

  // Test 5: Read nonce for test address
  console.log('TEST 5: nonces()');
  console.log('-'.repeat(80));
  const testAddress = '0x0000000000000000000000000000000000000001';
  try {
    const nonce = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [testAddress],
    });
    console.log(`✅ nonces(${testAddress}) = ${nonce.toString()}`);
    console.log();
  } catch (error) {
    console.log('❌ nonces() failed:', error.message);
    console.log();
  }

  // Test 6: Compute expected DOMAIN_SEPARATOR for EIP-2612
  console.log('TEST 6: Compute Expected Domain Separator for EIP-2612');
  console.log('-'.repeat(80));

  // Standard EIP-712 domain type hash
  const DOMAIN_TYPEHASH = keccak256(
    toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  );
  console.log(`DOMAIN_TYPEHASH: ${DOMAIN_TYPEHASH}`);

  // Get name from contract (we'll use what we read earlier)
  let nameFromContract = 'World Liberty Financial USD'; // Default
  try {
    nameFromContract = await publicClient.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'name',
    });
  } catch (e) {
    console.log('Using fallback name');
  }

  console.log(`Using name: "${nameFromContract}"`);
  console.log(`Using version: "1"`);
  console.log(`Using chainId: 56`);
  console.log(`Using verifyingContract: ${USD1_TOKEN}`);

  console.log();
  console.log('='.repeat(80));
  console.log('RECOMMENDATION FOR YOUR CODE:');
  console.log('='.repeat(80));
  console.log('1. Always try eip712Domain() FIRST (EIP-5267) - most reliable');
  console.log('2. If that fails, fall back to name() + version() individual reads');
  console.log('3. Use version "1" if version() is not available');
  console.log('4. The domain separator MUST match exactly what the contract uses');
  console.log('5. MetaMask will compute the domain separator from your domain object');
  console.log();
}

verifyDomain().catch(console.error);
