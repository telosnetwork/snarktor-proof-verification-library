/**
 * SNARKtor Proof Verification Integration Example
 * 
 * This example demonstrates how to verify that individual proofs are included
 * within SNARKtor aggregated proofs. This is a verification-only example - 
 * no proofs are submitted to any blockchain.
 */

const { SnarktorVerificationClient } = require('../src/SnarktorVerificationClient');
const { ethers } = require('ethers');

// Mock data for demonstration
const MOCK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
const MOCK_RPC_URL = 'https://testnet.telos.net/evm';

async function demonstrateProofVerification() {
    console.log('🔍 SNARKtor Proof Verification Demo');
    console.log('=====================================\n');

    // Initialize verification client (no private key needed)
    const client = new SnarktorVerificationClient(MOCK_RPC_URL, MOCK_CONTRACT_ADDRESS);

    // Example 1: Groth16 Proof Verification
    console.log('1. Groth16 Proof Verification');
    console.log('------------------------------');
    
    const groth16Proof = {
        pi_a: ['0x1234567890abcdef', '0xfedcba0987654321'],
        pi_b: [
            ['0xabcdef1234567890', '0x0987654321fedcba'],
            ['0x1111222233334444', '0x5555666677778888']
        ],
        pi_c: ['0x9999aaaabbbbcccc', '0xddddeeeeffffaaaa']
    };

    const publicInputs = [1, 2, 3, 4, 5];
    const verificationKey = { alpha: '0xalpha...', beta: '0xbeta...' };

    // Generate proof hash for verification
    const groth16Info = SnarktorVerificationClient.generateProofHash(
        groth16Proof,
        publicInputs,
        verificationKey
    );

    console.log(`Generated proof hash: ${groth16Info.proofHash}`);
    console.log(`Public input hash: ${groth16Info.publicInputHash}`);
    console.log(`Verification key hash: ${groth16Info.verificationKeyHash}\n`);

    // Example 2: PLONK Proof Verification
    console.log('2. PLONK Proof Verification');
    console.log('----------------------------');

    const plonkProof = {
        commitments: ['0xcommit1234567890', '0xcommitabcdef1234'],
        evaluations: ['0xeval1111222233', '0xeval4444555566'],
        opening_proof: '0xopening7777888899'
    };

    const plonkInfo = SnarktorVerificationClient.generateProofHash(
        plonkProof,
        publicInputs,
        verificationKey
    );

    console.log(`PLONK proof hash: ${plonkInfo.proofHash}\n`);

    // Example 3: STARK Proof Verification
    console.log('3. STARK Proof Verification');
    console.log('----------------------------');

    const starkProof = {
        trace_commitment: '0xstark_trace_commitment_data',
        composition_commitment: '0xstark_composition_commitment',
        fri_proof: '0xstark_fri_proof_data'
    };

    const starkInfo = SnarktorVerificationClient.generateProofHash(starkProof);
    console.log(`STARK proof hash: ${starkInfo.proofHash}\n`);

    // Example 4: Building Merkle Tree for Proof Inclusion
    console.log('4. Merkle Tree Construction and Verification');
    console.log('---------------------------------------------');

    const proofHashes = [
        groth16Info.proofHash,
        plonkInfo.proofHash,
        starkInfo.proofHash,
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222'
    ];

    console.log('Proof hashes to be aggregated:');
    proofHashes.forEach((hash, index) => {
        console.log(`  ${index}: ${hash}`);
    });

    // Build Merkle tree
    const merkleRoot = SnarktorVerificationClient.buildMerkleTree(proofHashes);
    console.log(`\nMerkle root: ${merkleRoot}`);

    // Generate inclusion proof for Groth16 proof (index 0)
    const merkleProof = SnarktorVerificationClient.generateMerkleProof(proofHashes, 0);
    console.log('\nMerkle inclusion proof for Groth16 proof:');
    console.log(`  Leaf index: ${merkleProof.index}`);
    console.log(`  Leaf hash: ${merkleProof.leaf}`);
    console.log(`  Proof path: [${merkleProof.path.join(', ')}]`);

    // Verify inclusion proof client-side
    const isValidClientSide = SnarktorVerificationClient.verifyMerkleProof(
        merkleProof.path,
        merkleProof.index,
        merkleProof.leaf,
        merkleRoot
    );

    console.log(`\nClient-side verification result: ${isValidClientSide ? '✅ VALID' : '❌ INVALID'}\n`);

    // Example 5: Proof Structure Validation
    console.log('5. Proof Structure Validation');
    console.log('------------------------------');

    // Test various proof formats
    const testProofs = [
        { name: 'Groth16 JSON', data: groth16Proof },
        { name: 'PLONK JSON', data: plonkProof },
        { name: 'Hex String', data: '0x123456789abcdef' },
        { name: 'Buffer', data: Buffer.from('proof data', 'utf8') }
    ];

    testProofs.forEach(test => {
        const validation = SnarktorVerificationClient.validateProofStructure(test.data);
        console.log(`${test.name}: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
        if (validation.isValid) {
            console.log(`  Hash: ${validation.proofHash}`);
            console.log(`  Size: ${validation.size} characters`);
        } else {
            console.log(`  Error: ${validation.error}`);
        }
    });

    console.log('\n🔍 Verification Demo Complete!');
    console.log('\nKey takeaways:');
    console.log('• This library only verifies proof inclusion - no blockchain submission');
    console.log('• Multiple proof formats are supported (Groth16, PLONK, STARKs, etc.)');
    console.log('• Merkle tree operations can be performed client-side');
    console.log('• All verification operations are read-only and secure');
}

// Demonstrate mock aggregated proof verification
async function demonstrateAggregatedProofVerification() {
    console.log('\n📋 Mock Aggregated Proof Verification');
    console.log('======================================\n');

    // This would typically come from SNARKtor or a data provider
    const mockAggregatedProofHash = '0xabc123def456789abc123def456789abc123def456789abc123def456789abc123';
    
    // Mock individual proof that we want to verify is included
    const individualProofHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    // Mock Merkle proof showing inclusion
    const mockMerkleProof = {
        path: [
            '0x2222222222222222222222222222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333333333333333333333333333'
        ],
        index: 0,
        leaf: individualProofHash
    };

    console.log('Verification scenario:');
    console.log(`Individual proof: ${individualProofHash}`);
    console.log(`Aggregated proof: ${mockAggregatedProofHash}`);
    console.log(`Merkle proof path: [${mockMerkleProof.path.join(', ')}]`);
    console.log(`Proof index: ${mockMerkleProof.index}\n`);

    // Note: In a real scenario, you would call:
    // const client = new SnarktorVerificationClient(rpcUrl, contractAddress);
    // const isIncluded = await client.verifyProofInclusion(individualProofHash, mockAggregatedProofHash, mockMerkleProof);
    
    console.log('⚠️  Note: This is a mock demonstration.');
    console.log('📡 In practice, you would:');
    console.log('   1. Connect to a real RPC provider');
    console.log('   2. Use a deployed verification contract');
    console.log('   3. Have actual SNARKtor aggregated proof data');
    console.log('   4. Call client.verifyProofInclusion() for real verification\n');
}

// Run the demonstration
async function main() {
    try {
        await demonstrateProofVerification();
        await demonstrateAggregatedProofVerification();
    } catch (error) {
        console.error('Demo error:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = {
    demonstrateProofVerification,
    demonstrateAggregatedProofVerification
};