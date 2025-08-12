/**
 * SNARKtor Client Library
 * 
 * A JavaScript client library for interacting with the SNARKtor proof verification
 * system on Telos EVM. This library provides easy-to-use methods for submitting
 * proofs, verifying inclusions, and managing the aggregation process.
 */

const { ethers } = require('ethers');

class SnarktorClient {
    constructor(providerUrl, contractAddress, privateKey = null) {
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.contractAddress = contractAddress;
        
        if (privateKey) {
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            this.contract = new ethers.Contract(contractAddress, this.getABI(), this.wallet);
        } else {
            this.contract = new ethers.Contract(contractAddress, this.getABI(), this.provider);
        }
    }

    /**
     * Submit a base proof for aggregation
     */
    async submitBaseProof(proofData, publicInput, verificationKey, fee, options = {}) {
        if (!this.wallet) {
            throw new Error('Wallet required for submitting proofs');
        }

        const nonce = await this.contract.userNonces(this.wallet.address);
        const message = ethers.utils.solidityKeccak256(
            ['uint256', 'uint256', 'bytes32', 'bytes32'],
            [fee, nonce, publicInput, verificationKey]
        );
        
        const signature = await this.wallet.signMessage(ethers.utils.arrayify(message));
        
        const tx = await this.contract.submitBaseProof(
            proofData,
            publicInput,
            verificationKey,
            fee,
            signature,
            {
                value: fee,
                ...options
            }
        );
        
        return await tx.wait();
    }

    /**
     * Submit an aggregated proof from SNARKtor
     */
    async submitAggregatedProof(aggregatedProofData, merkleRoot, provenData, disabledNodes, options = {}) {
        if (!this.wallet) {
            throw new Error('Wallet required for submitting proofs');
        }

        const tx = await this.contract.submitAggregatedProof(
            aggregatedProofData,
            merkleRoot,
            provenData,
            disabledNodes,
            options
        );
        
        return await tx.wait();
    }

    /**
     * Verify that a base proof is included in an aggregated proof
     */
    async verifyProofInclusion(baseProofHash, aggregatedHash, merkleProof) {
        return await this.contract.verifyProofInclusion(
            baseProofHash,
            aggregatedHash,
            merkleProof
        );
    }

    /**
     * Verify a merkle root against a set of proofs
     */
    async verifyMerkleRoot(merkleRoot, proofs) {
        return await this.contract.verifyMerkleRoot(merkleRoot, proofs);
    }

    /**
     * Get details of a base proof
     */
    async getBaseProof(proofHash) {
        return await this.contract.getBaseProof(proofHash);
    }

    /**
     * Get details of an aggregated proof
     */
    async getAggregatedProof(aggregatedHash) {
        return await this.contract.getAggregatedProof(aggregatedHash);
    }

    /**
     * Check if a proof has been submitted
     */
    async isProofSubmitted(proofHash) {
        return await this.contract.isProofSubmitted(proofHash);
    }

    /**
     * Deposit funds for aggregation fees
     */
    async deposit(amount, options = {}) {
        if (!this.wallet) {
            throw new Error('Wallet required for deposits');
        }

        const tx = await this.contract.deposit({
            value: amount,
            ...options
        });
        
        return await tx.wait();
    }

    /**
     * Withdraw unused funds
     */
    async withdraw(amount, options = {}) {
        if (!this.wallet) {
            throw new Error('Wallet required for withdrawals');
        }

        const tx = await this.contract.withdraw(amount, options);
        return await tx.wait();
    }

    /**
     * Get user balance
     */
    async getUserBalance(address = null) {
        const userAddress = address || this.wallet?.address;
        if (!userAddress) {
            throw new Error('Address required');
        }
        
        return await this.contract.userBalances(userAddress);
    }

    /**
     * Get user nonce
     */
    async getUserNonce(address = null) {
        const userAddress = address || this.wallet?.address;
        if (!userAddress) {
            throw new Error('Address required');
        }
        
        return await this.contract.userNonces(userAddress);
    }

    /**
     * Parse Telos transaction data to extract SNARKtor receipt
     */
    static parseTelosTransaction(transactionData) {
        // Extract snarktor_receipt_data from the transaction
        if (transactionData.actions && transactionData.actions.length > 0) {
            const action = transactionData.actions[0];
            if (action.act && action.act.data && action.act.data.snarktor_receipt_data) {
                return {
                    receiptData: '0x' + action.act.data.snarktor_receipt_data,
                    gameName: action.act.data.game_name,
                    player: action.act.data.player_one || action.act.data.player_two,
                    initialState: action.act.data.initial_state_data,
                    roundCommit: action.act.data.round_commit_data,
                    shotX: action.act.data.shot_x,
                    shotY: action.act.data.shot_y
                };
            }
        }
        
        throw new Error('Invalid Telos transaction format');
    }

    /**
     * Build merkle tree from proof hashes
     */
    static buildMerkleTree(proofHashes) {
        if (proofHashes.length === 0) {
            throw new Error('Empty proofs array');
        }
        
        if (proofHashes.length === 1) {
            return proofHashes[0];
        }

        let currentLevel = [...proofHashes];
        
        while (currentLevel.length > 1) {
            const nextLevel = [];
            
            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    const combined = ethers.utils.solidityKeccak256(
                        ['bytes32', 'bytes32'],
                        [currentLevel[i], currentLevel[i + 1]]
                    );
                    nextLevel.push(combined);
                } else {
                    // Odd number, promote the last element
                    nextLevel.push(currentLevel[i]);
                }
            }
            
            currentLevel = nextLevel;
        }
        
        return currentLevel[0];
    }

    /**
     * Generate merkle proof for a specific leaf
     */
    static generateMerkleProof(proofHashes, leafIndex) {
        if (leafIndex >= proofHashes.length) {
            throw new Error('Leaf index out of bounds');
        }

        const path = [];
        let currentLevel = [...proofHashes];
        let index = leafIndex;
        
        while (currentLevel.length > 1) {
            // Add sibling to path
            if (index % 2 === 0) {
                // Left child, sibling is right
                if (index + 1 < currentLevel.length) {
                    path.push(currentLevel[index + 1]);
                }
            } else {
                // Right child, sibling is left
                path.push(currentLevel[index - 1]);
            }
            
            // Build next level
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    const combined = ethers.utils.solidityKeccak256(
                        ['bytes32', 'bytes32'],
                        [currentLevel[i], currentLevel[i + 1]]
                    );
                    nextLevel.push(combined);
                } else {
                    nextLevel.push(currentLevel[i]);
                }
            }
            
            currentLevel = nextLevel;
            index = Math.floor(index / 2);
        }
        
        return {
            path,
            index: leafIndex,
            leaf: proofHashes[leafIndex]
        };
    }

    /**
     * Verify merkle proof
     */
    static verifyMerkleProof(path, index, leaf, root) {
        let computedHash = leaf;
        
        for (let i = 0; i < path.length; i++) {
            const proofElement = path[i];
            
            if (index % 2 === 0) {
                computedHash = ethers.utils.solidityKeccak256(
                    ['bytes32', 'bytes32'],
                    [computedHash, proofElement]
                );
            } else {
                computedHash = ethers.utils.solidityKeccak256(
                    ['bytes32', 'bytes32'],
                    [proofElement, computedHash]
                );
            }
            
            index = Math.floor(index / 2);
        }
        
        return computedHash === root;
    }

    /**
     * Listen for events
     */
    onProofVerified(callback) {
        this.contract.on('ProofVerified', callback);
    }

    onAggregatedProofSubmitted(callback) {
        this.contract.on('AggregatedProofSubmitted', callback);
    }

    onMerkleRootValidated(callback) {
        this.contract.on('MerkleRootValidated', callback);
    }

    /**
     * Get contract ABI
     */
    getABI() {
        return [
            // Events
            "event ProofVerified(bytes32 indexed proofHash, address indexed submitter, uint256 timestamp)",
            "event AggregatedProofSubmitted(bytes32 indexed aggregatedHash, uint256 baseProofCount)",
            "event MerkleRootValidated(bytes32 indexed merkleRoot, bytes32[] includedProofs)",
            
            // Functions
            "function submitBaseProof(bytes calldata _proofData, bytes32 _publicInput, bytes32 _verificationKey, uint256 _fee, bytes calldata _signature) external payable",
            "function submitAggregatedProof(bytes calldata _aggregatedProofData, bytes32 _merkleRoot, tuple(bytes32 proofHash, address user, uint256 fee, uint256 nonce, bytes32 publicInput, bytes32 verificationKey, bytes signature)[] calldata _provenData, bytes32[] calldata _disabledNodes) external",
            "function verifyProofInclusion(bytes32 _baseProofHash, bytes32 _aggregatedHash, tuple(bytes32[] path, uint256 index, bytes32 leaf) calldata _merkleProof) external view returns (bool)",
            "function verifyMerkleRoot(bytes32 _merkleRoot, bytes32[] calldata _proofs) external pure returns (bool)",
            "function getBaseProof(bytes32 _proofHash) external view returns (tuple(bytes32 proofHash, address user, uint256 fee, uint256 nonce, bytes32 publicInput, bytes32 verificationKey, bytes signature))",
            "function getAggregatedProof(bytes32 _aggregatedHash) external view returns (tuple(bytes32 aggregatedHash, bytes32 merkleRoot, bytes32[] disabledNodes, tuple(bytes32 proofHash, address user, uint256 fee, uint256 nonce, bytes32 publicInput, bytes32 verificationKey, bytes signature)[] provenData, uint256 totalFee, address submitter, uint256 timestamp))",
            "function isProofSubmitted(bytes32 _proofHash) external view returns (bool)",
            "function deposit() external payable",
            "function withdraw(uint256 _amount) external",
            "function userBalances(address) external view returns (uint256)",
            "function userNonces(address) external view returns (uint256)"
        ];
    }
}

module.exports = { SnarktorClient };