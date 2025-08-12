// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISnarktorVerifier
 * @dev Interface for the SNARKtor proof verification library
 */
interface ISnarktorVerifier {
    // Structs
    struct BaseProof {
        bytes32 proofHash;        
        address user;             
        uint256 fee;              
        uint256 nonce;            
        bytes32 publicInput;      
        bytes32 verificationKey;  
        bytes signature;          
    }

    struct AggregatedProof {
        bytes32 aggregatedHash;   
        bytes32 merkleRoot;       
        bytes32[] disabledNodes;  
        BaseProof[] provenData;   
        uint256 totalFee;         
        address submitter;        
        uint256 timestamp;        
    }

    struct MerkleProof {
        bytes32[] path;           
        uint256 index;            
        bytes32 leaf;             
    }

    // Events
    event ProofVerified(bytes32 indexed proofHash, address indexed submitter, uint256 timestamp);
    event AggregatedProofSubmitted(bytes32 indexed aggregatedHash, uint256 baseProofCount);
    event MerkleRootValidated(bytes32 indexed merkleRoot, bytes32[] includedProofs);

    // Core Functions
    function submitBaseProof(
        bytes calldata _proofData,
        bytes32 _publicInput,
        bytes32 _verificationKey,
        uint256 _fee,
        bytes calldata _signature
    ) external payable;

    function submitAggregatedProof(
        bytes calldata _aggregatedProofData,
        bytes32 _merkleRoot,
        BaseProof[] calldata _provenData,
        bytes32[] calldata _disabledNodes
    ) external;

    function verifyProofInclusion(
        bytes32 _baseProofHash,
        bytes32 _aggregatedHash,
        MerkleProof calldata _merkleProof
    ) external view returns (bool);

    function verifyMerkleRoot(bytes32 _merkleRoot, bytes32[] calldata _proofs) external pure returns (bool);

    // Getter Functions
    function getBaseProof(bytes32 _proofHash) external view returns (BaseProof memory);
    function getAggregatedProof(bytes32 _aggregatedHash) external view returns (AggregatedProof memory);
    function isProofSubmitted(bytes32 _proofHash) external view returns (bool);

    // Balance Management
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
    function userBalances(address _user) external view returns (uint256);
    function userNonces(address _user) external view returns (uint256);
}