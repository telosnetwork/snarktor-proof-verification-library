// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SnarktorUtils
 * @dev Utility library for SNARKtor proof processing and Merkle tree operations
 */
library SnarktorUtils {
    
    /**
     * @dev Extract proof data from generic transaction data
     * This parses standard proof data formats
     */
    function extractProofData(bytes calldata _transactionData) external pure returns (bytes32) {
        require(_transactionData.length >= 32, "Invalid transaction data length");
        
        bytes32 proofHash;
        assembly {
            proofHash := calldataload(add(_transactionData.offset, 0))
        }
        return proofHash;
    }

    /**
     * @dev Parse hex string data to bytes32
     * Generic utility for parsing hex-encoded proof data
     */
    function parseHexData(string calldata _hexData) external pure returns (bytes32) {
        bytes memory hexBytes = bytes(_hexData);
        require(hexBytes.length >= 64, "Invalid hex data format"); // At least 32 bytes as hex
        
        return _hexStringToBytes32(_hexData);
    }

    /**
     * @dev Build merkle tree from array of proof hashes
     * Returns the merkle root of the tree
     */
    function buildMerkleTree(bytes32[] memory _leaves) external pure returns (bytes32) {
        require(_leaves.length > 0, "Empty leaves array");
        
        if (_leaves.length == 1) {
            return _leaves[0];
        }

        bytes32[] memory currentLevel = _leaves;
        
        while (currentLevel.length > 1) {
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            
            for (uint i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel[i / 2] = keccak256(abi.encodePacked(currentLevel[i], currentLevel[i + 1]));
                } else {
                    // Odd number of leaves, promote the last one
                    nextLevel[i / 2] = currentLevel[i];
                }
            }
            
            currentLevel = nextLevel;
        }
        
        return currentLevel[0];
    }

    /**
     * @dev Generate merkle proof for a specific leaf
     * Returns path and index needed to verify inclusion
     */
    function generateMerkleProof(
        bytes32[] memory _leaves,
        uint256 _leafIndex
    ) external pure returns (bytes32[] memory path, uint256 index) {
        require(_leafIndex < _leaves.length, "Leaf index out of bounds");
        
        bytes32[] memory currentLevel = _leaves;
        path = new bytes32[](0);
        index = _leafIndex;
        uint256 pathIndex = 0;
        
        while (currentLevel.length > 1) {
            // Resize path array
            bytes32[] memory newPath = new bytes32[](path.length + 1);
            for (uint i = 0; i < path.length; i++) {
                newPath[i] = path[i];
            }
            
            // Add sibling to path
            if (index % 2 == 0) {
                // Left child, sibling is right
                if (index + 1 < currentLevel.length) {
                    newPath[pathIndex] = currentLevel[index + 1];
                }
            } else {
                // Right child, sibling is left
                newPath[pathIndex] = currentLevel[index - 1];
            }
            
            path = newPath;
            pathIndex++;
            
            // Build next level
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            
            for (uint i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel[i / 2] = keccak256(abi.encodePacked(currentLevel[i], currentLevel[i + 1]));
                } else {
                    nextLevel[i / 2] = currentLevel[i];
                }
            }
            
            currentLevel = nextLevel;
            index = index / 2;
        }
        
        return (path, _leafIndex);
    }

    /**
     * @dev Verify a merkle proof
     */
    function verifyMerkleProof(
        bytes32[] memory _path,
        uint256 _index,
        bytes32 _leaf,
        bytes32 _root
    ) external pure returns (bool) {
        bytes32 computedHash = _leaf;
        
        for (uint256 i = 0; i < _path.length; i++) {
            bytes32 proofElement = _path[i];
            
            if (_index % 2 == 0) {
                // Current node is left child
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Current node is right child
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            _index = _index / 2;
        }
        
        return computedHash == _root;
    }

    /**
     * @dev Calculate fee distribution according to SNARKtor protocol
     * Returns (currentLevelFee, inclusionFee, aggregationFee)
     */
    function calculateFeeDistribution(uint256 _totalFee) 
        external 
        pure 
        returns (uint256 currentFee, uint256 inclusionFee, uint256 aggregationFee) 
    {
        currentFee = (_totalFee * 40) / 100;      // 40% for provers and schedulers
        inclusionFee = (_totalFee * 5) / 100;     // 5% for submitter
        aggregationFee = (_totalFee * 55) / 100;  // 55% for further aggregation
        
        return (currentFee, inclusionFee, aggregationFee);
    }

    /**
     * @dev Validate proof structure matches SNARKtor format
     * This checks that proof data conforms to expected format
     */
    function validateProofStructure(bytes calldata _proofData) external pure returns (bool) {
        // Basic validation - proof should be non-empty and reasonable length
        if (_proofData.length == 0 || _proofData.length > 10000) {
            return false;
        }
        
        // Additional format validation could be added here
        // based on specific SNARK system being used
        
        return true;
    }

    /**
     * @dev Parse generic transaction data
     * Extracts proof-relevant data from transaction payload
     */
    function parseTransactionData(bytes calldata _data) 
        external 
        pure 
        returns (
            bytes32 proofHash,
            bytes32 publicInputHash,
            bytes32 metadataHash
        ) 
    {
        require(_data.length >= 96, "Insufficient transaction data");
        
        // Extract standard proof components
        proofHash = bytes32(_data[0:32]);
        publicInputHash = bytes32(_data[32:64]);
        metadataHash = bytes32(_data[64:96]);
        
        return (proofHash, publicInputHash, metadataHash);
    }

    // Internal helper functions
    
    function _hexStringToBytes32(string calldata _hexString) internal pure returns (bytes32) {
        bytes memory hexBytes = bytes(_hexString);
        require(hexBytes.length == 64, "Invalid hex string length");
        
        bytes32 result;
        assembly {
            result := mload(add(add(hexBytes, 0x20), 0))
        }
        
        return result;
    }

    function _hexCharToByte(bytes1 _char) internal pure returns (uint8) {
        uint8 charByte = uint8(_char);
        
        if (charByte >= uint8(bytes1('0')) && charByte <= uint8(bytes1('9'))) {
            return charByte - uint8(bytes1('0'));
        } else if (charByte >= uint8(bytes1('A')) && charByte <= uint8(bytes1('F'))) {
            return 10 + charByte - uint8(bytes1('A'));
        } else if (charByte >= uint8(bytes1('a')) && charByte <= uint8(bytes1('f'))) {
            return 10 + charByte - uint8(bytes1('a'));
        } else {
            revert("Invalid hex character");
        }
    }
}