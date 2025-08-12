// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SnarktorVerifier
 * @dev A verification-only library that validates inclusion of proofs within SNARKtor aggregated proofs
 * This contract does NOT handle proof submission to EVM - it only verifies proof inclusion
 */
contract SnarktorVerifier {
    // Events for verification activities only
    event ProofInclusionVerified(bytes32 indexed baseProofHash, bytes32 indexed aggregatedHash, bool verified);
    event MerkleRootValidated(bytes32 indexed merkleRoot, bool isValid);

    // Structs for verification data (read-only)
    struct BaseProof {
        bytes32 proofHash;        // Hash of the original proof
        bytes32 publicInput;      // Public input hash
        bytes32 verificationKey;  // Verification key hash
        bool exists;              // Whether this proof data is available
    }

    struct AggregatedProof {
        bytes32 aggregatedHash;   // Hash of the aggregated proof
        bytes32 merkleRoot;       // Root of the proof tree
        bytes32[] includedProofs; // Hashes of proofs included in aggregation
        bool exists;              // Whether this aggregated proof data is available
    }

    struct MerkleProof {
        bytes32[] path;           // Merkle path for inclusion proof
        uint256 index;            // Position in the tree
        bytes32 leaf;             // Leaf value being proven
    }

    // Storage for verification data (populated externally or through data feeds)
    mapping(bytes32 => BaseProof) public baseProofs;
    mapping(bytes32 => AggregatedProof) public aggregatedProofs;

    /**
     * @dev Add base proof data for verification purposes (called by authorized data providers)
     * @param _proofHash Hash of the proof
     * @param _publicInput Public input hash
     * @param _verificationKey Verification key hash
     */
    function addBaseProofData(
        bytes32 _proofHash,
        bytes32 _publicInput,
        bytes32 _verificationKey
    ) external {
        // In production, this would have access controls for authorized data providers
        baseProofs[_proofHash] = BaseProof({
            proofHash: _proofHash,
            publicInput: _publicInput,
            verificationKey: _verificationKey,
            exists: true
        });
    }

    /**
     * @dev Add aggregated proof data for verification purposes (called by authorized data providers)
     * @param _aggregatedHash Hash of the aggregated proof
     * @param _merkleRoot Merkle root of the proof tree
     * @param _includedProofs Array of proof hashes included in the aggregation
     */
    function addAggregatedProofData(
        bytes32 _aggregatedHash,
        bytes32 _merkleRoot,
        bytes32[] calldata _includedProofs
    ) external {
        // In production, this would have access controls for authorized data providers
        aggregatedProofs[_aggregatedHash] = AggregatedProof({
            aggregatedHash: _aggregatedHash,
            merkleRoot: _merkleRoot,
            includedProofs: _includedProofs,
            exists: true
        });
    }

    /**
     * @dev Verify that a specific base proof is included in an aggregated proof
     * @param _baseProofHash Hash of the base proof to verify
     * @param _aggregatedHash Hash of the aggregated proof
     * @param _merkleProof Merkle proof for inclusion
     * @return bool True if the proof is included
     */
    function verifyProofInclusion(
        bytes32 _baseProofHash,
        bytes32 _aggregatedHash,
        MerkleProof calldata _merkleProof
    ) external returns (bool) {
        require(aggregatedProofs[_aggregatedHash].exists, "Aggregated proof data not available");
        require(baseProofs[_baseProofHash].exists, "Base proof data not available");
        
        AggregatedProof memory aggregated = aggregatedProofs[_aggregatedHash];
        
        // Verify the merkle proof
        bool verified = _verifyMerkleProof(_merkleProof.path, _merkleProof.index, _baseProofHash, aggregated.merkleRoot);
        
        emit ProofInclusionVerified(_baseProofHash, _aggregatedHash, verified);
        return verified;
    }

    /**
     * @dev Verify that a merkle root is valid for a given set of proofs
     * @param _merkleRoot The merkle root to verify
     * @param _proofs Array of proof hashes
     * @return bool True if the merkle root is valid
     */
    function verifyMerkleRoot(bytes32 _merkleRoot, bytes32[] calldata _proofs) external returns (bool) {
        if (_proofs.length == 0) {
            emit MerkleRootValidated(_merkleRoot, false);
            return false;
        }
        
        if (_proofs.length == 1) {
            bool isValid = _merkleRoot == _proofs[0];
            emit MerkleRootValidated(_merkleRoot, isValid);
            return isValid;
        }

        // Build merkle tree bottom-up
        bytes32[] memory currentLevel = _proofs;
        
        while (currentLevel.length > 1) {
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            
            for (uint i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel[i / 2] = keccak256(abi.encodePacked(currentLevel[i], currentLevel[i + 1]));
                } else {
                    nextLevel[i / 2] = currentLevel[i];
                }
            }
            
            currentLevel = nextLevel;
        }
        
        bool isValid = currentLevel[0] == _merkleRoot;
        emit MerkleRootValidated(_merkleRoot, isValid);
        return isValid;
    }

    /**
     * @dev Get details of a base proof
     */
    function getBaseProof(bytes32 _proofHash) external view returns (BaseProof memory) {
        require(baseProofs[_proofHash].exists, "Base proof data not available");
        return baseProofs[_proofHash];
    }

    /**
     * @dev Get details of an aggregated proof
     */
    function getAggregatedProof(bytes32 _aggregatedHash) external view returns (AggregatedProof memory) {
        require(aggregatedProofs[_aggregatedHash].exists, "Aggregated proof data not available");
        return aggregatedProofs[_aggregatedHash];
    }

    /**
     * @dev Check if base proof data is available
     */
    function isBaseProofAvailable(bytes32 _proofHash) external view returns (bool) {
        return baseProofs[_proofHash].exists;
    }

    /**
     * @dev Check if aggregated proof data is available
     */
    function isAggregatedProofAvailable(bytes32 _aggregatedHash) external view returns (bool) {
        return aggregatedProofs[_aggregatedHash].exists;
    }

    // Internal functions

    function _verifyMerkleProof(
        bytes32[] memory _path,
        uint256 _index,
        bytes32 _leaf,
        bytes32 _root
    ) internal pure returns (bool) {
        bytes32 computedHash = _leaf;
        
        for (uint256 i = 0; i < _path.length; i++) {
            bytes32 proofElement = _path[i];
            
            if (_index % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            _index = _index / 2;
        }
        
        return computedHash == _root;
    }

}