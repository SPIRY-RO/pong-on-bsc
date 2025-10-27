// CRITICAL ANALYSIS: Find what domain parameters produce the on-chain DOMAIN_SEPARATOR
const { createPublicClient, http, keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } = require('viem');
const { bsc } = require('viem/chains');

const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
const RPC_URL = 'https://bsc-dataseed.binance.org';

// Expected from contract
const EXPECTED_DOMAIN_SEPARATOR = '0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba';

// User provided (WRONG!)
const USER_PROVIDED = '0x73f2ca3e6b1d5f9355f8eef02cf6e5192fe0362bf72477dfb12cb21f026cd0ab';

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
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
});

function computeDomainSeparator(name, version, chainId, verifyingContract) {
  // EIP-712 domain typehash
  const DOMAIN_TYPEHASH = keccak256(
    Buffer.from('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  );

  // Hash the name
  const nameHash = keccak256(Buffer.from(name));

  // Hash the version
  const versionHash = keccak256(Buffer.from(version));

  // Encode and hash according to EIP-712
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, bytes32, bytes32, uint256, address'),
    [DOMAIN_TYPEHASH, nameHash, versionHash, BigInt(chainId), verifyingContract]
  );

  return keccak256(encoded);
}

async function analyze() {
  console.log('='.repeat(100));
  console.log('CRITICAL DOMAIN_SEPARATOR ANALYSIS');
  console.log('='.repeat(100));
  console.log();

  // Read actual values from contract
  const contractName = await publicClient.readContract({
    address: USD1_TOKEN,
    abi: usd1Abi,
    functionName: 'name',
  });

  const contractDomainSeparator = await publicClient.readContract({
    address: USD1_TOKEN,
    abi: usd1Abi,
    functionName: 'DOMAIN_SEPARATOR',
  });

  console.log('ON-CHAIN VALUES:');
  console.log('-'.repeat(100));
  console.log(`Token Name: "${contractName}"`);
  console.log(`DOMAIN_SEPARATOR: ${contractDomainSeparator}`);
  console.log();

  console.log('USER PROVIDED VALUE:');
  console.log('-'.repeat(100));
  console.log(`User DOMAIN_SEPARATOR: ${USER_PROVIDED}`);
  console.log(`Match: ${contractDomainSeparator === USER_PROVIDED ? '✅ YES' : '❌ NO - CRITICAL MISMATCH!'}`);
  console.log();

  console.log('TESTING DIFFERENT DOMAIN CONFIGURATIONS:');
  console.log('='.repeat(100));
  console.log();

  // Test configurations
  const testConfigs = [
    { name: contractName, version: '1', chainId: 56, label: 'Standard EIP-2612 (name from contract, version "1")' },
    { name: contractName, version: '2', chainId: 56, label: 'Version "2"' },
    { name: 'USD1', version: '1', chainId: 56, label: 'Short name "USD1"' },
    { name: 'World Liberty Financial', version: '1', chainId: 56, label: 'Name without "USD"' },
    { name: 'WLFI USD', version: '1', chainId: 56, label: 'Alternative name' },
  ];

  for (const config of testConfigs) {
    const computed = computeDomainSeparator(
      config.name,
      config.version,
      config.chainId,
      USD1_TOKEN
    );

    const match = computed.toLowerCase() === contractDomainSeparator.toLowerCase();

    console.log(`Config: ${config.label}`);
    console.log(`  Name: "${config.name}"`);
    console.log(`  Version: "${config.version}"`);
    console.log(`  ChainId: ${config.chainId}`);
    console.log(`  VerifyingContract: ${USD1_TOKEN}`);
    console.log(`  Computed: ${computed}`);
    console.log(`  Match: ${match ? '✅✅✅ CORRECT!' : '❌ Wrong'}`);
    console.log();
  }

  console.log('='.repeat(100));
  console.log('CRITICAL FINDINGS:');
  console.log('='.repeat(100));
  console.log('1. The user-provided DOMAIN_SEPARATOR is INCORRECT');
  console.log('2. Your code MUST use the domain parameters that produce the on-chain DOMAIN_SEPARATOR');
  console.log('3. The domain object sent to MetaMask MUST match what the contract expects');
  console.log('4. If domain mismatch, ALL signatures will be INVALID');
  console.log();
  console.log('CORRECT DOMAIN FOR METAMASK:');
  console.log('{');
  console.log(`  name: "${contractName}",`);
  console.log('  version: "1",  // (or whatever version produces the correct separator)');
  console.log('  chainId: 56,');
  console.log(`  verifyingContract: "${USD1_TOKEN}"`);
  console.log('}');
  console.log();
}

analyze().catch(console.error);
