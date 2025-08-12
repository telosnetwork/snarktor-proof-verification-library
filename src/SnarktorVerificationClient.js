/**
 * SNARKtor Verification Client Library
 * 
 * A JavaScript client library for verifying proof inclusion within SNARKtor aggregated proofs.
 * This library does NOT submit proofs to any EVM - it only verifies that proofs exist within
 * SNARKtor aggregated proofs.
 */

const { ethers } = require('ethers');

class SnarktorVerificationClient {
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
     * Get details of a base proof (if data is available)
     * @param {string} proofHash - Hash of the proof
     */
    async getBaseProof(proofHash) {
        try {
            return await this.contract.getBaseProof(proofHash);
        } catch (error) {
            if (error.message.includes("Base proof data not available")) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Get details of an aggregated proof (if data is available)
     * @param {string} aggregatedHash - Hash of the aggregated proof
     */
    async getAggregatedProof(aggregatedHash) {
        try {
            return await this.contract.getAggregatedProof(aggregatedHash);
        } catch (error) {
            if (error.message.includes("Aggregated proof data not available")) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Check if base proof data is available
     * @param {string} proofHash - Hash of the proof
     */
    async isBaseProofAvailable(proofHash) {
        return await this.contract.isBaseProofAvailable(proofHash);
    }

    /**
     * Check if aggregated proof data is available
     * @param {string} aggregatedHash - Hash of the aggregated proof
     */
    async isAggregatedProofAvailable(aggregatedHash) {
        return await this.contract.isAggregatedProofAvailable(aggregatedHash);
    }

    /**
     * Parse generic proof data from various formats for verification
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
     * Generate proof hash for verification purposes
     * @param {*} proofData - Proof data in any supported format
     * @param {*} publicInputs - Public inputs (optional)
     * @param {*} verificationKey - Verification key (optional)
     */
    static generateProofHash(proofData, publicInputs = null, verificationKey = null) {
        const parsed = this.parseGenericProof(proofData);
        
        // Generate hashes for public inputs and verification key
        const publicInputHash = publicInputs 
            ? ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(publicInputs)))
            : ethers.utils.keccak256(ethers.utils.toUtf8Bytes('default_public_input'));
            
        const verificationKeyHash = verificationKey
            ? ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(verificationKey)))
            : ethers.utils.keccak256(ethers.utils.toUtf8Bytes('default_verification_key'));
        
        return {
            proofHash: parsed.proofHash,
            publicInputHash: publicInputHash,
            verificationKeyHash: verificationKeyHash,
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
     * Verify merkle proof (client-side verification)
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
     * Listen for verification events
     */
    onProofInclusionVerified(callback) {
        this.contract.on('ProofInclusionVerified', callback);
    }

    onMerkleRootValidated(callback) {
        this.contract.on('MerkleRootValidated', callback);
    }

    /**
     * Get contract ABI (verification functions only)
     */
    getABI() {
        return [
            // Events
            "event ProofInclusionVerified(bytes32 indexed baseProofHash, bytes32 indexed aggregatedHash, bool verified)",
            "event MerkleRootValidated(bytes32 indexed merkleRoot, bool isValid)",
            
            // Read-only functions
            "function verifyProofInclusion(bytes32 _baseProofHash, bytes32 _aggregatedHash, tuple(bytes32[] path, uint256 index, bytes32 leaf) calldata _merkleProof) external returns (bool)",
            "function verifyMerkleRoot(bytes32 _merkleRoot, bytes32[] calldata _proofs) external returns (bool)",
            "function getBaseProof(bytes32 _proofHash) external view returns (tuple(bytes32 proofHash, bytes32 publicInput, bytes32 verificationKey, bool exists))",
            "function getAggregatedProof(bytes32 _aggregatedHash) external view returns (tuple(bytes32 aggregatedHash, bytes32 merkleRoot, bytes32[] includedProofs, bool exists))",
            "function isBaseProofAvailable(bytes32 _proofHash) external view returns (bool)",
            "function isAggregatedProofAvailable(bytes32 _aggregatedHash) external view returns (bool)",
            
            // Data provider functions (for adding verification data)
            "function addBaseProofData(bytes32 _proofHash, bytes32 _publicInput, bytes32 _verificationKey) external",
            "function addAggregatedProofData(bytes32 _aggregatedHash, bytes32 _merkleRoot, bytes32[] calldata _includedProofs) external"
        ];
    }
}

module.exports = { SnarktorVerificationClient };