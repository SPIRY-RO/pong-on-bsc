const { createPublicClient, http } = require('viem');
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

async function verify() {
  console.log('========================================');
  console.log('RPC VERIFICATION - USD1 EIP-2612 Permit');
  console.log('========================================\n');

  const client = createPublicClient({
    chain: bsc,
    transport: http(RPC_URL),
  });

  console.log('Contract:', USD1_TOKEN);
  console.log('Chain: BNB Smart Chain (BSC)');
  console.log('Chain ID: 56');
  console.log('RPC:', RPC_URL);
  console.log('');

  try {
    // Read DOMAIN_SEPARATOR
    console.log('[1/5] Reading DOMAIN_SEPARATOR...');
    const domainSeparator = await client.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'DOMAIN_SEPARATOR',
    });
    console.log('✅ DOMAIN_SEPARATOR:', domainSeparator);
    console.log('');

    // Read name
    console.log('[2/5] Reading name()...');
    const name = await client.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'name',
    });
    console.log('✅ name:', name);
    console.log('');

    // Try to read version
    console.log('[3/5] Reading version()...');
    try {
      const version = await client.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'version',
      });
      console.log('✅ version:', version);
    } catch (e) {
      console.log('⚠️  version() not available');
      console.log('   Using default: "1"');
    }
    console.log('');

    // Try to read eip712Domain
    console.log('[4/5] Reading eip712Domain() (EIP-5267)...');
    try {
      const domain = await client.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'eip712Domain',
      });
      console.log('✅ eip712Domain:');
      console.log('   name:', domain[1]);
      console.log('   version:', domain[2]);
      console.log('   chainId:', domain[3].toString());
      console.log('   verifyingContract:', domain[4]);
    } catch (e) {
      console.log('⚠️  eip712Domain() not available');
    }
    console.log('');

    // Test nonces function
    console.log('[5/5] Testing nonces() function...');
    const testAddress = '0x0000000000000000000000000000000000000001';
    const nonce = await client.readContract({
      address: USD1_TOKEN,
      abi: usd1Abi,
      functionName: 'nonces',
      args: [testAddress],
    });
    console.log('✅ nonces() works! Test nonce:', nonce.toString());
    console.log('');

    console.log('========================================');
    console.log('VERIFICATION SUMMARY');
    console.log('========================================');
    console.log('Expected DOMAIN_SEPARATOR:');
    console.log('0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba');
    console.log('');
    console.log('Actual DOMAIN_SEPARATOR:');
    console.log(domainSeparator);
    console.log('');
    
    const expected = '0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba';
    if (domainSeparator.toLowerCase() === expected.toLowerCase()) {
      console.log('✅ ✅ ✅ DOMAIN_SEPARATOR MATCHES! ✅ ✅ ✅');
      console.log('');
      console.log('Your implementation is using the correct DOMAIN_SEPARATOR!');
    } else {
      console.log('❌ ❌ ❌ DOMAIN_SEPARATOR MISMATCH! ❌ ❌ ❌');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verify();
