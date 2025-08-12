/**
 * Generic Proof Integration Example
 * 
 * This example demonstrates how to use the SNARKtor library to verify
 * any type of zero-knowledge proof that has been aggregated by SNARKtor.
 */

const { GenericSnarktorClient } = require('../src/GenericSnarktorClient');
const { ethers } = require('ethers');

class GenericProofIntegration {
    constructor(providerUrl, contractAddress, privateKey) {
        this.client = new GenericSnarktorClient(providerUrl, contractAddress, privateKey);
    }

    /**
     * Submit various types of proofs to demonstrate flexibility
     */
    async submitVariousProofTypes() {
        console.log('=== Submitting Various Proof Types ===\n');

        const fee = ethers.utils.parseEther('0.01');
        const submittedProofs = [];

        // 1. Raw hex string proof
        console.log('1. Submitting raw hex proof...');
        const hexProof = '0x' + Buffer.from('example_groth16_proof_data').toString('hex');
        const standardized1 = GenericSnarktorClient.standardizeProofSubmission(
            hexProof,
            ['input1', 'input2'],
            { alpha: 'vk_alpha', beta: 'vk_beta' },
            fee
        );
        
        try {
            const receipt1 = await this.client.submitBaseProof(
                standardized1.proofData,
                standardized1.publicInput,
                standardized1.verificationKey,
                standardized1.fee
            );
            console.log('✓ Raw hex proof submitted:', receipt1.transactionHash);
            submittedProofs.push(standardized1);
        } catch (error) {
            console.log('✗ Raw hex proof failed:', error.message);
        }

        // 2. JSON structured proof (like Circom/snarkjs output)
        console.log('\n2. Submitting JSON structured proof...');
        const jsonProof = {
            proof: {
                pi_a: ["123", "456", "1"],
                pi_b: [["789", "012"], ["345", "678"], ["1", "0"]],
                pi_c: ["901", "234", "1"]
            },
            publicSignals: ["signal1", "signal2"]
        };
        
        const standardized2 = GenericSnarktorClient.standardizeProofSubmission(
            jsonProof,
            jsonProof.publicSignals,
            null,
            fee
        );
        
        try {
            const receipt2 = await this.client.submitBaseProof(
                standardized2.proofData,
                standardized2.publicInput,
                standardized2.verificationKey,
                standardized2.fee
            );
            console.log('✓ JSON proof submitted:', receipt2.transactionHash);
            submittedProofs.push(standardized2);
        } catch (error) {
            console.log('✗ JSON proof failed:', error.message);
        }

        // 3. Buffer-based proof
        console.log('\n3. Submitting buffer proof...');
        const bufferProof = Buffer.from('stark_proof_example_data', 'utf8');
        const standardized3 = GenericSnarktorClient.standardizeProofSubmission(
            bufferProof,
            { commitment: 'merkle_root_xyz' },
            { field: 'BN254' },
            fee
        );
        
        try {
            const receipt3 = await this.client.submitBaseProof(
                standardized3.proofData,
                standardized3.publicInput,
                standardized3.verificationKey,
                standardized3.fee
            );
            console.log('✓ Buffer proof submitted:', receipt3.transactionHash);
            submittedProofs.push(standardized3);
        } catch (error) {
            console.log('✗ Buffer proof failed:', error.message);
        }

        // 4. Custom application proof
        console.log('\n4. Submitting custom application proof...');
        const customProof = {
            proofSystem: 'Plonk',
            proof: 'custom_plonk_proof_data_12345',
            publicInputs: {
                userBalance: '1000',
                timestamp: Date.now(),
                action: 'transfer'
            },
            metadata: {
                version: '1.0',
                circuit: 'balance_check'
            }
        };
        
        const standardized4 = GenericSnarktorClient.standardizeProofSubmission(
            customProof,
            customProof.publicInputs,
            { system: customProof.proofSystem },
            fee
        );
        
        try {
            const receipt4 = await this.client.submitBaseProof(
                standardized4.proofData,
                standardized4.publicInput,
                standardized4.verificationKey,
                standardized4.fee
            );
            console.log('✓ Custom proof submitted:', receipt4.transactionHash);
            submittedProofs.push(standardized4);
        } catch (error) {
            console.log('✗ Custom proof failed:', error.message);
        }

        return submittedProofs;
    }

    /**
     * Demonstrate proof validation
     */
    async demonstrateProofValidation(proofs) {
        console.log('\n=== Proof Validation Examples ===\n');

        for (let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            console.log(`Validating proof ${i + 1}:`);
            
            // Validate structure
            const validation = GenericSnarktorClient.validateProofStructure(proof.originalData);
            console.log('  Structure valid:', validation.isValid);
            console.log('  Proof hash:', validation.proofHash);
            console.log('  Data size:', validation.size, 'characters');
            
            // Check if submitted on-chain
            const isSubmitted = await this.client.isProofSubmitted(proof.proofHash);
            console.log('  Submitted on-chain:', isSubmitted);
            
            if (isSubmitted) {
                const onChainProof = await this.client.getBaseProof(proof.proofHash);
                console.log('  Fee paid:', ethers.utils.formatEther(onChainProof.fee), 'ETH');
                console.log('  User nonce:', onChainProof.nonce.toString());
            }
            
            console.log('---');
        }
    }

    /**
     * Simulate aggregated proof verification
     */
    async simulateAggregatedVerification(proofs) {
        console.log('\n=== Aggregated Proof Simulation ===\n');

        if (proofs.length === 0) {
            console.log('No proofs to aggregate');
            return;
        }

        // Extract proof hashes
        const proofHashes = proofs.map(p => p.proofHash);
        console.log(`Aggregating ${proofHashes.length} proofs...`);

        // Build merkle tree
        const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);
        console.log('Merkle root calculated:', merkleRoot);

        // Verify merkle root on-chain
        const isValidRoot = await this.client.verifyMerkleRoot(merkleRoot, proofHashes);
        console.log('On-chain root verification:', isValidRoot);

        // Generate and verify inclusion proofs
        for (let i = 0; i < proofHashes.length; i++) {
            const merkleProof = GenericSnarktorClient.generateMerkleProof(proofHashes, i);
            const isValidInclusion = GenericSnarktorClient.verifyMerkleProof(
                merkleProof.path,
                merkleProof.index,
                merkleProof.leaf,
                merkleRoot
            );
            
            console.log(`Proof ${i + 1} inclusion valid:`, isValidInclusion);
        }

        return {
            merkleRoot,
            proofHashes,
            proofCount: proofs.length
        };
    }

    /**
     * Demonstrate different proof system compatibility
     */
    async demonstrateProofSystemCompatibility() {
        console.log('\n=== Proof System Compatibility ===\n');

        const proofSystems = [
            {
                name: 'Groth16',
                example: {
                    pi_a: ['0x123', '0x456'],
                    pi_b: [['0x789', '0x012'], ['0x345', '0x678']],
                    pi_c: ['0x901', '0x234'],
                    curve: 'bn128'
                }
            },
            {
                name: 'PLONK',
                example: {
                    commitments: ['0xabc', '0xdef'],
                    evaluations: ['0x111', '0x222'],
                    opening_proof: '0x333'
                }
            },
            {
                name: 'STARK',
                example: {
                    trace_commitment: '0xstark1',
                    composition_commitment: '0xstark2',
                    fri_proof: '0xstark3',
                    queries: ['0xq1', '0xq2']
                }
            },
            {
                name: 'Bulletproofs',
                example: {
                    A: '0xbullet1',
                    S: '0xbullet2',
                    T1: '0xbullet3',
                    T2: '0xbullet4',
                    taux: '0xbullet5',
                    mu: '0xbullet6',
                    IPP: {
                        L: ['0xL1', '0xL2'],
                        R: ['0xR1', '0xR2'],
                        a: '0xa',
                        b: '0xb'
                    }
                }
            }
        ];

        for (const system of proofSystems) {
            console.log(`${system.name} proof compatibility:`);
            
            const validation = GenericSnarktorClient.validateProofStructure(system.example);
            console.log('  ✓ Structure validation:', validation.isValid);
            console.log('  ✓ Generated hash:', validation.proofHash);
            console.log('  ✓ Data size:', validation.size, 'chars');
            
            const standardized = GenericSnarktorClient.standardizeProofSubmission(
                system.example,
                { system: system.name },
                { curve: 'generic' },
                ethers.utils.parseEther('0.001')
            );
            console.log('  ✓ Standardization successful');
            console.log('---');
        }
    }

    /**
     * Run complete generic integration example
     */
    async runExample() {
        console.log('=== Generic SNARKtor Integration Example ===\n');

        try {
            // Demonstrate proof system compatibility
            await this.demonstrateProofSystemCompatibility();

            // Submit various proof types
            const submittedProofs = await this.submitVariousProofTypes();

            // Validate proofs
            await this.demonstrateProofValidation(submittedProofs);

            // Simulate aggregated verification
            const aggregatedResult = await this.simulateAggregatedVerification(submittedProofs);

            console.log('\n=== Integration Complete ===');
            console.log(`Successfully processed ${submittedProofs.length} proofs`);
            if (aggregatedResult) {
                console.log(`Aggregated into merkle root: ${aggregatedResult.merkleRoot}`);
            }

            return {
                submittedProofs,
                aggregatedResult
            };

        } catch (error) {
            console.error('Integration example failed:', error);
            throw error;
        }
    }
}

// Export for use in other scripts
module.exports = { GenericProofIntegration };

// Run example if called directly
if (require.main === module) {
    async function main() {
        // Configuration - update these values for your setup
        const config = {
            providerUrl: 'https://testnet.telos.net/evm', // Or any EVM-compatible chain
            contractAddress: '0x1234567890123456789012345678901234567890', // Replace with deployed contract
            privateKey: process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'
        };

        console.log('Using configuration:');
        console.log('  Provider:', config.providerUrl);
        console.log('  Contract:', config.contractAddress);
        console.log('  Wallet:', config.privateKey ? 'Provided' : 'Not provided');
        console.log('---\n');

        const integration = new GenericProofIntegration(
            config.providerUrl,
            config.contractAddress,
            config.privateKey
        );

        try {
            await integration.runExample();
        } catch (error) {
            console.error('Integration example failed:', error);
            process.exit(1);
        }
    }

    main();
}