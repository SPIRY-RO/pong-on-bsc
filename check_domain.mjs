import { keccak256, encodeAbiParameters, toHex } from 'viem';

const name = "World Liberty Financial USD";
const chainId = 56;
const verifyingContract = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
const expectedDomain = "0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba";

// EIP-712 domain type hash
const EIP712_DOMAIN_TYPEHASH = keccak256(
  toHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
);

function computeDomainSeparator(version) {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' }
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(toHex(name)),
        keccak256(toHex(version)),
        BigInt(chainId),
        verifyingContract
      ]
    )
  );
  return domainSeparator;
}

// Try different version strings
const versionsToTry = ["1", "2", "v1", "V1", "", "1.0", "0"];

console.log("Testing versions to match DOMAIN_SEPARATOR...\n");
console.log(`Expected: ${expectedDomain}\n`);

for (const version of versionsToTry) {
  const domainSeparator = computeDomainSeparator(version);
  const match = domainSeparator.toLowerCase() === expectedDomain.toLowerCase();

  console.log(`Version "${version}": ${domainSeparator} ${match ? "✅ MATCH!" : ""}`);
}
