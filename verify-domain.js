#!/usr/bin/env node
/**
 * DOMAIN_SEPARATOR Verification Script
 *
 * This script verifies that the USD1 token contract's DOMAIN_SEPARATOR
 * matches what your code is configured to use for EIP-2612 Permit signatures.
 *
 * Run this anytime to verify your configuration is correct.
 */

const { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { bsc } = require('viem/chains');

// Configuration
const USD1_TOKEN = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
const CHAIN_ID = 56;
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org';

// Your code's configuration
const YOUR_CONFIG = {
  name: 'World Liberty Financial USD',
  version: '1',
  chainId: 56,
  verifyingContract: USD1_TOKEN,
};

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

function computeDomainSeparator(name, version, chainId, verifyingContract) {
  // EIP-712 domain typehash
  const DOMAIN_TYPEHASH = keccak256(
    Buffer.from('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  );

  // Hash the name and version
  const nameHash = keccak256(Buffer.from(name));
  const versionHash = keccak256(Buffer.from(version));

  // Encode and hash according to EIP-712
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, bytes32, bytes32, uint256, address'),
    [DOMAIN_TYPEHASH, nameHash, versionHash, BigInt(chainId), verifyingContract]
  );

  return keccak256(encoded);
}

async function verify() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         DOMAIN_SEPARATOR VERIFICATION FOR USD1 TOKEN (BSC)               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // Read from contract
    console.log('📡 Querying contract at:', USD1_TOKEN);
    console.log('🌐 Network: BNB Smart Chain (Chain ID 56)');
    console.log('🔗 RPC:', RPC_URL);
    console.log();

    const [contractName, contractDomainSeparator] = await Promise.all([
      publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: USD1_TOKEN,
        abi: usd1Abi,
        functionName: 'DOMAIN_SEPARATOR',
      }),
    ]);

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('ON-CHAIN VALUES (AUTHORITATIVE SOURCE)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log();
    console.log('Token Name:', '"' + contractName + '"');
    console.log('DOMAIN_SEPARATOR:', contractDomainSeparator);
    console.log();

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('YOUR CODE CONFIGURATION');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log();
    console.log('Domain Configuration:');
    console.log('  name:', JSON.stringify(YOUR_CONFIG.name));
    console.log('  version:', JSON.stringify(YOUR_CONFIG.version));
    console.log('  chainId:', YOUR_CONFIG.chainId);
    console.log('  verifyingContract:', YOUR_CONFIG.verifyingContract);
    console.log();

    // Compute what your config produces
    const computedSeparator = computeDomainSeparator(
      YOUR_CONFIG.name,
      YOUR_CONFIG.version,
      YOUR_CONFIG.chainId,
      YOUR_CONFIG.verifyingContract
    );

    console.log('Computed DOMAIN_SEPARATOR:', computedSeparator);
    console.log();

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('VERIFICATION RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log();

    const nameMatch = contractName === YOUR_CONFIG.name;
    const separatorMatch = contractDomainSeparator.toLowerCase() === computedSeparator.toLowerCase();

    console.log('Name Match:', nameMatch ? '✅ PASS' : '❌ FAIL');
    console.log('  Contract:', '"' + contractName + '"');
    console.log('  Your Code:', '"' + YOUR_CONFIG.name + '"');
    console.log();

    console.log('DOMAIN_SEPARATOR Match:', separatorMatch ? '✅ PASS' : '❌ FAIL');
    console.log('  On-Chain:', contractDomainSeparator);
    console.log('  Computed:', computedSeparator);
    console.log();

    if (nameMatch && separatorMatch) {
      console.log('╔════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                         ✅ CONFIGURATION CORRECT                          ║');
      console.log('║                                                                            ║');
      console.log('║  Your domain parameters match the on-chain contract configuration!        ║');
      console.log('║  EIP-2612 Permit signatures will be valid.                                ║');
      console.log('╚════════════════════════════════════════════════════════════════════════════╝');
      console.log();
      process.exit(0);
    } else {
      console.log('╔════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                         ❌ CONFIGURATION ERROR                            ║');
      console.log('║                                                                            ║');
      console.log('║  Your domain parameters DO NOT match the contract!                        ║');
      console.log('║  ALL permit signatures will be INVALID until this is fixed.               ║');
      console.log('║                                                                            ║');
      console.log('║  Update YOUR_CONFIG in this script to match the on-chain values.          ║');
      console.log('╚════════════════════════════════════════════════════════════════════════════╝');
      console.log();
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error();
    console.error('Details:', error);
    process.exit(1);
  }
}

// Run verification
verify();
