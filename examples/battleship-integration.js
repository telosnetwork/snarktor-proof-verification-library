/**
 * Battleship Game Integration Example
 * 
 * This example demonstrates how to use the SNARKtor library to verify
 * battleship game proofs that have been aggregated by SNARKtor.
 */

const { SnarktorClient } = require('../src/SnarktorClient');
const fs = require('fs');
const path = require('path');

class BattleshipIntegration {
    constructor(providerUrl, contractAddress, privateKey) {
        this.client = new SnarktorClient(providerUrl, contractAddress, privateKey);
    }

    /**
     * Process a battleship game transaction from Telos
     */
    async processBattleshipTransaction(transactionFile) {
        console.log(`Processing transaction: ${transactionFile}`);
        
        // Read the transaction data
        const transactionData = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', transactionFile), 'utf8')
        );

        try {
            // Parse the Telos transaction
            const parsed = SnarktorClient.parseTelosTransaction(transactionData);
            console.log('Parsed transaction data:', {
                receiptData: parsed.receiptData,
                gameName: parsed.gameName,
                player: parsed.player,
                hasInitialState: !!parsed.initialState,
                hasRoundCommit: !!parsed.roundCommit
            });

            // Create a proof hash from the receipt data
            const proofHash = ethers.utils.keccak256(parsed.receiptData);
            
            // Check if proof is already submitted
            const isSubmitted = await this.client.isProofSubmitted(proofHash);
            console.log(`Proof already submitted: ${isSubmitted}`);

            if (!isSubmitted) {
                // Submit the base proof for aggregation
                const fee = ethers.utils.parseEther('0.01'); // 0.01 TLOS
                const publicInput = ethers.utils.keccak256(
                    ethers.utils.toUtf8Bytes(parsed.gameName || '')
                );
                const verificationKey = ethers.utils.keccak256(
                    ethers.utils.toUtf8Bytes('battleship_vk')
                );

                console.log('Submitting base proof...');
                const receipt = await this.client.submitBaseProof(
                    parsed.receiptData,
                    publicInput,
                    verificationKey,
                    fee
                );
                
                console.log('Base proof submitted:', receipt.transactionHash);
            }

            return {
                proofHash,
                parsed,
                isSubmitted
            };

        } catch (error) {
            console.error('Error processing transaction:', error.message);
            throw error;
        }
    }

    /**
     * Demonstrate proof aggregation verification
     */
    async demonstrateAggregation(proofHashes) {
        console.log('\n=== Demonstrating Proof Aggregation ===');
        
        // Build merkle tree from proof hashes
        const merkleRoot = SnarktorClient.buildMerkleTree(proofHashes);
        console.log('Calculated Merkle Root:', merkleRoot);

        // Generate merkle proofs for each proof
        for (let i = 0; i < proofHashes.length; i++) {
            const merkleProof = SnarktorClient.generateMerkleProof(proofHashes, i);
            console.log(`Merkle proof for proof ${i}:`, {
                leaf: merkleProof.leaf,
                index: merkleProof.index,
                pathLength: merkleProof.path.length
            });

            // Verify the proof locally
            const isValid = SnarktorClient.verifyMerkleProof(
                merkleProof.path,
                merkleProof.index,
                merkleProof.leaf,
                merkleRoot
            );
            console.log(`Local verification result: ${isValid}`);
        }

        // Verify merkle root on-chain
        const isValidRoot = await this.client.verifyMerkleRoot(merkleRoot, proofHashes);
        console.log(`On-chain root verification: ${isValidRoot}`);
    }

    /**
     * Simulate aggregated proof submission
     */
    async simulateAggregatedSubmission(proofHashes) {
        console.log('\n=== Simulating Aggregated Proof Submission ===');

        // Build the aggregated proof data
        const merkleRoot = SnarktorClient.buildMerkleTree(proofHashes);
        const aggregatedProofData = ethers.utils.toUtf8Bytes('mock_aggregated_proof_data');
        
        // Get base proofs for each hash
        const provenData = [];
        for (const hash of proofHashes) {
            try {
                const baseProof = await this.client.getBaseProof(hash);
                if (baseProof.user !== '0x0000000000000000000000000000000000000000') {
                    provenData.push(baseProof);
                }
            } catch (error) {
                console.log(`Proof ${hash} not found, creating mock data`);
                // Create mock data for demonstration
                provenData.push({
                    proofHash: hash,
                    user: this.client.wallet.address,
                    fee: ethers.utils.parseEther('0.01'),
                    nonce: 1,
                    publicInput: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
                    verificationKey: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test_vk')),
                    signature: '0x' + '00'.repeat(65)
                });
            }
        }

        console.log(`Preparing to submit aggregated proof for ${provenData.length} base proofs`);
        console.log('Merkle root:', merkleRoot);

        // In a real scenario, this would be submitted by an authorized aggregator
        // For demonstration, we'll show the structure
        return {
            aggregatedProofData,
            merkleRoot,
            provenData,
            disabledNodes: [] // No disabled nodes in this example
        };
    }

    /**
     * Verify proof inclusion in aggregated proof
     */
    async verifyProofInAggregatedProof(baseProofHash, aggregatedHash, proofHashes) {
        console.log('\n=== Verifying Proof Inclusion ===');

        // Find the index of the base proof
        const leafIndex = proofHashes.findIndex(hash => hash === baseProofHash);
        if (leafIndex === -1) {
            throw new Error('Base proof not found in proof set');
        }

        // Generate merkle proof
        const merkleProof = SnarktorClient.generateMerkleProof(proofHashes, leafIndex);
        
        // Verify inclusion on-chain
        const isIncluded = await this.client.verifyProofInclusion(
            baseProofHash,
            aggregatedHash,
            merkleProof
        );

        console.log('Proof inclusion verification result:', isIncluded);
        return isIncluded;
    }

    /**
     * Run complete integration example
     */
    async runExample() {
        console.log('=== SNARKtor Battleship Integration Example ===\n');

        const transactionFiles = [
            'newgame.json',
            'joingame.json', 
            'turn1.json',
            'turn2.json'
        ];

        const processedProofs = [];

        // Process each battleship transaction
        for (const file of transactionFiles) {
            try {
                const result = await this.processBattleshipTransaction(file);
                processedProofs.push(result);
                console.log('---');
            } catch (error) {
                console.error(`Failed to process ${file}:`, error.message);
            }
        }

        if (processedProofs.length === 0) {
            console.error('No proofs were processed successfully');
            return;
        }

        // Extract proof hashes
        const proofHashes = processedProofs.map(p => p.proofHash);
        console.log(`\nProcessed ${proofHashes.length} proofs`);

        // Demonstrate merkle tree operations
        await this.demonstrateAggregation(proofHashes);

        // Simulate aggregated proof submission
        const aggregatedData = await this.simulateAggregatedSubmission(proofHashes);
        console.log('Aggregated proof structure prepared');

        console.log('\n=== Integration Example Complete ===');
        return {
            processedProofs,
            proofHashes,
            aggregatedData
        };
    }
}

// Export for use in other scripts
module.exports = { BattleshipIntegration };

// Run example if called directly
if (require.main === module) {
    async function main() {
        // Configuration - update these values for your setup
        const config = {
            providerUrl: 'https://testnet.telos.net/evm', // Telos testnet
            contractAddress: '0x1234567890123456789012345678901234567890', // Replace with deployed contract
            privateKey: process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'
        };

        const integration = new BattleshipIntegration(
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