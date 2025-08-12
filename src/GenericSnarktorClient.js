/**
 * Generic SNARKtor Client Library
 * 
 * A JavaScript client library for interacting with the SNARKtor proof verification
 * system on any EVM-compatible blockchain. This library provides methods for submitting
 * any type of zero-knowledge proof, verifying inclusions, and managing the aggregation process.
 */

const { ethers } = require('ethers');

class GenericSnarktorClient {
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
     * Submit any base proof for aggregation
     * @param {string|Buffer} proofData - The raw proof data
     * @param {string} publicInput - Hash of public inputs
     * @param {string} verificationKey - Hash of verification key
     * @param {BigNumber} fee - Fee for aggregation
     * @param {Object} options - Transaction options
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
     * @param {string|Buffer} aggregatedProofData - The aggregated proof data
     * @param {string} merkleRoot - Merkle root of the proof tree
     * @param {Array} provenData - Array of base proofs that were aggregated
     * @param {Array} disabledNodes - Array of previously submitted subtree roots
     * @param {Object} options - Transaction options
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
     * @param {string} baseProofHash - Hash of the base proof
     * @param {string} aggregatedHash - Hash of the aggregated proof
     * @param {Object} merkleProof - Merkle inclusion proof
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
     * @param {string} merkleRoot - The merkle root to verify
     * @param {Array<string>} proofs - Array of proof hashes
     */
    async verifyMerkleRoot(merkleRoot, proofs) {
        return await this.contract.verifyMerkleRoot(merkleRoot, proofs);
    }

    /**
     * Get details of a base proof
     * @param {string} proofHash - Hash of the proof
     */
    async getBaseProof(proofHash) {
        return await this.contract.getBaseProof(proofHash);
    }

    /**
     * Get details of an aggregated proof
     * @param {string} aggregatedHash - Hash of the aggregated proof
     */
    async getAggregatedProof(aggregatedHash) {
        return await this.contract.getAggregatedProof(aggregatedHash);
    }

    /**
     * Check if a proof has been submitted
     * @param {string} proofHash - Hash of the proof
     */
    async isProofSubmitted(proofHash) {
        return await this.contract.isProofSubmitted(proofHash);
    }

    /**
     * Deposit funds for aggregation fees
     * @param {BigNumber} amount - Amount to deposit
     * @param {Object} options - Transaction options
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
     * @param {BigNumber} amount - Amount to withdraw
     * @param {Object} options - Transaction options
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
     * @param {string} address - User address (optional)
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
     * @param {string} address - User address (optional)
     */
    async getUserNonce(address = null) {
        const userAddress = address || this.wallet?.address;
        if (!userAddress) {
            throw new Error('Address required');
        }
        
        return await this.contract.userNonces(userAddress);
    }

    /**
     * Parse generic proof data from various formats
     * @param {Object} proofData - Proof data in various formats
     */
    static parseGenericProof(proofData) {
        // Handle different proof formats
        if (typeof proofData === 'string') {
            // Hex string
            return {
                proofHash: ethers.utils.keccak256(proofData),
                rawData: proofData
            };
        } else if (Buffer.isBuffer(proofData)) {
            // Buffer
            return {
                proofHash: ethers.utils.keccak256(proofData),
                rawData: ethers.utils.hexlify(proofData)
            };
        } else if (proofData && typeof proofData === 'object') {
            // JSON object - extract proof components
            const components = [];
            
            // Try to extract common proof fields
            if (proofData.proof) components.push(proofData.proof);
            if (proofData.publicSignals) components.push(JSON.stringify(proofData.publicSignals));
            if (proofData.vk) components.push(JSON.stringify(proofData.vk));
            
            // If no standard fields, use the entire object
            if (components.length === 0) {
                components.push(JSON.stringify(proofData));
            }
            
            const combined = components.join('');
            return {
                proofHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combined)),
                rawData: combined,
                structured: proofData
            };
        }
        
        throw new Error('Unsupported proof data format');
    }

    /**
     * Create a standardized proof submission from various input formats
     * @param {*} proofData - Proof data in any supported format
     * @param {*} publicInputs - Public inputs (optional)
     * @param {*} verificationKey - Verification key (optional)
     * @param {BigNumber} fee - Aggregation fee
     */
    static standardizeProofSubmission(proofData, publicInputs = null, verificationKey = null, fee) {
        const parsed = this.parseGenericProof(proofData);
        
        // Generate hashes for public inputs and verification key
        const publicInputHash = publicInputs 
            ? ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(publicInputs)))
            : ethers.utils.keccak256(ethers.utils.toUtf8Bytes('default_public_input'));
            
        const verificationKeyHash = verificationKey
            ? ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(verificationKey)))
            : ethers.utils.keccak256(ethers.utils.toUtf8Bytes('default_verification_key'));
        
        return {
            proofData: parsed.rawData,
            proofHash: parsed.proofHash,
            publicInput: publicInputHash,
            verificationKey: verificationKeyHash,
            fee: fee,
            originalData: parsed.structured || proofData
        };
    }

    /**
     * Build merkle tree from proof hashes
     * @param {Array<string>} proofHashes - Array of proof hashes
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
     * @param {Array<string>} proofHashes - Array of proof hashes
     * @param {number} leafIndex - Index of the leaf to prove
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
     * @param {Array<string>} path - Merkle path
     * @param {number} index - Leaf index
     * @param {string} leaf - Leaf hash
     * @param {string} root - Root hash
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
     * Validate proof structure for SNARKtor compatibility
     * @param {*} proofData - Proof data to validate
     */
    static validateProofStructure(proofData) {
        try {
            const parsed = this.parseGenericProof(proofData);
            return {
                isValid: true,
                proofHash: parsed.proofHash,
                size: parsed.rawData.length
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
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

module.exports = { GenericSnarktorClient };