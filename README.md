# SNARKtor Proof Verification Library

A verification-only library that validates inclusion of individual proofs within SNARKtor aggregated proofs. This library **does not** submit proofs to any EVM blockchain - it only verifies that specific proofs exist within SNARKtor aggregated proofs according to the SNARKtor whitepaper.

## Overview

The SNARKtor protocol enables decentralized recursive proof aggregation, allowing multiple individual zero-knowledge proofs from any proving system to be combined into a single aggregated proof. This verification library provides the tools to:

- Verify that individual proofs are included in SNARKtor aggregated proofs
- Validate Merkle trees used in the proof aggregation structure  
- Parse and handle various proof formats for verification
- Support verification of proofs from multiple proving systems (Groth16, PLONK, STARKs, etc.)

**Important**: This library is designed for verification only. It does not submit proofs to Telos EVM or any other blockchain.

## Architecture

The library consists of several key components:

### Smart Contract

- **SnarktorVerifier.sol** - Verification contract that validates proof inclusion within aggregated proofs

### Client Library

- **SnarktorVerificationClient.js** - JavaScript client for verification operations
- **verification-examples.js** - Example integrations showing proof inclusion verification

### Key Features

- **Universal Proof Support**: Verify inclusion of proofs from any ZK proving system (Groth16, PLONK, STARKs, Bulletproofs, etc.)
- **Flexible Input Formats**: Handle proofs as hex strings, JSON objects, or binary buffers
- **Aggregated Proof Verification**: Verify that individual proofs are included in SNARKtor aggregated proofs
- **Merkle Tree Operations**: Build and verify Merkle trees for proof inclusion
- **Read-Only Operations**: All functions are verification-only, no blockchain state changes
- **Client-Side Verification**: Most operations can be performed without blockchain interaction

## Installation

```bash
npm install
```

## Usage

### Basic Verification Example

```javascript
const { SnarktorVerificationClient } = require('./src/SnarktorVerificationClient');

// Initialize verification client (read-only)
const client = new SnarktorVerificationClient(
    'https://your-evm-provider.com',
    contractAddress  // No private key needed for verification
);

// Generate proof hash from your proof data
const proofData = { /* Groth16, PLONK, STARK, etc. */ };
const proofInfo = SnarktorVerificationClient.generateProofHash(
    proofData,
    publicInputs,
    verificationKey
);

// Verify that your proof is included in a SNARKtor aggregated proof
const isIncluded = await client.verifyProofInclusion(
    proofInfo.proofHash,
    aggregatedProofHash,
    merkleProof
);

console.log(`Proof included in aggregation: ${isIncluded}`);
```

### Client-Side Verification

```javascript
// Build merkle tree from proof hashes
const proofHashes = ['0x123...', '0x456...', '0x789...'];
const merkleRoot = SnarktorVerificationClient.buildMerkleTree(proofHashes);

// Generate inclusion proof for specific proof
const merkleProof = SnarktorVerificationClient.generateMerkleProof(proofHashes, 1);

// Verify merkle proof client-side (no blockchain call needed)
const isValid = SnarktorVerificationClient.verifyMerkleProof(
    merkleProof.path,
    merkleProof.index,
    merkleProof.leaf,
    merkleRoot
);
```

### Multiple Proving Systems Support

The library supports verification of proofs from various systems:

```javascript
// Groth16 proof verification
const groth16Proof = {
    pi_a: ['0x123', '0x456'],
    pi_b: [['0x789', '0x012'], ['0x345', '0x678']],
    pi_c: ['0x901', '0x234']
};

// PLONK proof verification
const plonkProof = {
    commitments: ['0xabc', '0xdef'],
    evaluations: ['0x111', '0x222'],
    opening_proof: '0x333'
};

// STARK proof verification
const starkProof = {
    trace_commitment: '0xstark1',
    composition_commitment: '0xstark2',
    fri_proof: '0xstark3'
};

// All can be verified using the same interface
const groth16Hash = SnarktorVerificationClient.generateProofHash(groth16Proof, inputs, vk);
const plonkHash = SnarktorVerificationClient.generateProofHash(plonkProof, inputs, vk);
const starkHash = SnarktorVerificationClient.generateProofHash(starkProof, inputs, vk);
```

## SNARKtor Protocol Verification

This library implements verification aspects of the SNARKtor protocol:

### Proof Structure Verification
- **Base Proofs**: Individual proofs that were aggregated by SNARKtor
- **Aggregated Proofs**: SNARKtor-generated proofs containing multiple base proofs
- **Merkle Inclusion**: Cryptographic proof that a base proof exists in an aggregated proof

### Merkle Trees
The library uses Merkle trees to verify inclusion of base proofs in aggregated proofs:
- Build trees from proof hashes
- Generate inclusion proofs
- Verify proofs both on-chain and client-side

## API Reference

### SnarktorVerifier Contract

#### Verification Functions

- `verifyProofInclusion(baseHash, aggregatedHash, merkleProof)` - Verify that a base proof is included in an aggregated proof
- `verifyMerkleRoot(merkleRoot, proofs)` - Verify Merkle root against proof set
- `getBaseProof(proofHash)` - Get base proof details (if available)
- `getAggregatedProof(aggregatedHash)` - Get aggregated proof details (if available)
- `isBaseProofAvailable(proofHash)` - Check if base proof data is available
- `isAggregatedProofAvailable(aggregatedHash)` - Check if aggregated proof data is available

#### Data Provider Functions (for authorized sources)

- `addBaseProofData(proofHash, publicInput, verificationKey)` - Add base proof verification data
- `addAggregatedProofData(aggregatedHash, merkleRoot, includedProofs)` - Add aggregated proof verification data

#### Events

- `ProofInclusionVerified(baseProofHash, aggregatedHash, verified)` - Proof inclusion verification result
- `MerkleRootValidated(merkleRoot, isValid)` - Merkle root validation result

### SnarktorVerificationClient

#### Verification Methods

- `verifyProofInclusion(baseHash, aggregatedHash, merkleProof)` - Verify proof inclusion
- `verifyMerkleRoot(merkleRoot, proofs)` - Verify Merkle root
- `getBaseProof(proofHash)` - Get proof details (returns null if not available)
- `isBaseProofAvailable(proofHash)` - Check data availability
- `isAggregatedProofAvailable(aggregatedHash)` - Check data availability

#### Static Utility Methods

- `parseGenericProof(proofData)` - Parse any proof format
- `generateProofHash(proofData, inputs, vk)` - Generate proof hash for verification
- `validateProofStructure(proofData)` - Validate proof structure
- `buildMerkleTree(proofHashes)` - Build Merkle tree
- `generateMerkleProof(proofs, index)` - Generate inclusion proof
- `verifyMerkleProof(path, index, leaf, root)` - Verify inclusion proof (client-side)

## Testing

Run the test suite:

```bash
npx hardhat test
```

The test suite includes:
- Proof inclusion verification for multiple proof types
- Merkle tree operations and validation
- Generic proof parsing and validation
- Client-side verification utilities
- Data availability checks

## Examples

### Running the Verification Example

```bash
node examples/verification-integration.js
```

This example demonstrates:
1. Verifying inclusion of proofs from different proving systems (Groth16, PLONK, STARKs, Bulletproofs)
2. Parsing various proof formats (hex, JSON, buffers)
3. Building Merkle trees from proof hashes
4. Verifying proof inclusion in SNARKtor aggregated proofs
5. Client-side verification without blockchain calls

### Supported Proof Systems

The library supports verification of proofs from:
- **Groth16**: Most common SNARK system
- **PLONK**: Universal setup SNARK
- **STARKs**: Post-quantum secure proofs
- **Bulletproofs**: Range proofs and confidential transactions
- **Custom formats**: Any JSON or binary proof structure

## Configuration

The library supports configuration through environment variables:

- `RPC_URL` - EVM-compatible RPC endpoint for verification
- `CONTRACT_ADDRESS` - Deployed verification contract address

## Security Considerations

- All verification operations are read-only
- Merkle proofs are validated both on-chain and client-side
- No private keys or sensitive data are required for verification
- Proof data integrity is maintained through cryptographic hashing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## References

- [SNARKtor Whitepaper](./SNARKtor-Whitepaper.pdf)
- [Telos EVM Documentation](https://docs.telos.net/)
- [Hardhat Framework](https://hardhat.org/)

## Support

For questions or issues, please open an issue on the GitHub repository or contact the development team.