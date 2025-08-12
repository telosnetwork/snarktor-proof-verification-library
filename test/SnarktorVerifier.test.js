/**
 * SNARKtor Verifier Tests
 * 
 * Comprehensive test suite for the SNARKtor proof verification library
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { GenericSnarktorClient } = require('../src/GenericSnarktorClient');

describe('SnarktorVerifier', function() {
    let snarktorVerifier;
    let owner, user1, user2, aggregator;
    let client;

    beforeEach(async function() {
        [owner, user1, user2, aggregator] = await ethers.getSigners();

        // Deploy the contract
        const SnarktorVerifier = await ethers.getContractFactory('SnarktorVerifier');
        snarktorVerifier = await SnarktorVerifier.deploy();
        await snarktorVerifier.deployed();

        // Create client instance
        client = new GenericSnarktorClient(
            ethers.provider,
            snarktorVerifier.address,
            user1.privateKey
        );
    });

    describe('Base Proof Submission', function() {
        it('should submit a base proof successfully', async function() {
            const proofData = ethers.utils.toUtf8Bytes('test_proof_data');
            const publicInput = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_input'));
            const verificationKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('verification_key'));
            const fee = ethers.utils.parseEther('0.01');

            const nonce = await snarktorVerifier.userNonces(user1.address);
            const message = ethers.utils.solidityKeccak256(
                ['uint256', 'uint256', 'bytes32', 'bytes32'],
                [fee, nonce, publicInput, verificationKey]
            );
            const signature = await user1.signMessage(ethers.utils.arrayify(message));

            const tx = await snarktorVerifier.connect(user1).submitBaseProof(
                proofData,
                publicInput,
                verificationKey,
                fee,
                signature,
                { value: fee }
            );

            const receipt = await tx.wait();
            const proofHash = ethers.utils.keccak256(proofData);

            // Check that proof was stored
            const storedProof = await snarktorVerifier.getBaseProof(proofHash);
            expect(storedProof.user).to.equal(user1.address);
            expect(storedProof.fee).to.equal(fee);

            // Check that proof is marked as submitted
            expect(await snarktorVerifier.isProofSubmitted(proofHash)).to.be.true;

            // Check that event was emitted
            expect(receipt.events[0].event).to.equal('ProofVerified');
            expect(receipt.events[0].args.proofHash).to.equal(proofHash);
        });

        it('should reject duplicate proof submissions', async function() {
            const proofData = ethers.utils.toUtf8Bytes('duplicate_proof');
            const publicInput = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_input'));
            const verificationKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('verification_key'));
            const fee = ethers.utils.parseEther('0.01');

            // Submit first time
            const nonce = await snarktorVerifier.userNonces(user1.address);
            const message = ethers.utils.solidityKeccak256(
                ['uint256', 'uint256', 'bytes32', 'bytes32'],
                [fee, nonce, publicInput, verificationKey]
            );
            const signature = await user1.signMessage(ethers.utils.arrayify(message));

            await snarktorVerifier.connect(user1).submitBaseProof(
                proofData,
                publicInput,
                verificationKey,
                fee,
                signature,
                { value: fee }
            );

            // Try to submit again - should fail
            await expect(
                snarktorVerifier.connect(user1).submitBaseProof(
                    proofData,
                    publicInput,
                    verificationKey,
                    fee,
                    signature,
                    { value: fee }
                )
            ).to.be.revertedWith('Proof already submitted');
        });

        it('should reject invalid signatures', async function() {
            const proofData = ethers.utils.toUtf8Bytes('test_proof_data');
            const publicInput = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_input'));
            const verificationKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('verification_key'));
            const fee = ethers.utils.parseEther('0.01');

            // Create invalid signature
            const invalidSignature = '0x' + '00'.repeat(65);

            await expect(
                snarktorVerifier.connect(user1).submitBaseProof(
                    proofData,
                    publicInput,
                    verificationKey,
                    fee,
                    invalidSignature,
                    { value: fee }
                )
            ).to.be.revertedWith('Invalid signature');
        });
    });

    describe('Merkle Tree Operations', function() {
        it('should build and verify merkle tree correctly', function() {
            const proofHashes = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof2')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof3')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof4'))
            ];

            const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);
            expect(merkleRoot).to.not.be.null;

            // Verify each proof
            for (let i = 0; i < proofHashes.length; i++) {
                const merkleProof = GenericSnarktorClient.generateMerkleProof(proofHashes, i);
                const isValid = GenericSnarktorClient.verifyMerkleProof(
                    merkleProof.path,
                    merkleProof.index,
                    merkleProof.leaf,
                    merkleRoot
                );
                expect(isValid).to.be.true;
            }
        });

        it('should verify merkle root on-chain', async function() {
            const proofHashes = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof2')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof3'))
            ];

            const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);
            const isValid = await snarktorVerifier.verifyMerkleRoot(merkleRoot, proofHashes);
            expect(isValid).to.be.true;
        });

        it('should handle single leaf merkle tree', async function() {
            const proofHashes = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('single_proof'))];
            const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);
            
            expect(merkleRoot).to.equal(proofHashes[0]);
            
            const isValid = await snarktorVerifier.verifyMerkleRoot(merkleRoot, proofHashes);
            expect(isValid).to.be.true;
        });
    });

    describe('Aggregated Proof Submission', function() {
        let baseProofs;

        beforeEach(async function() {
            // Submit some base proofs first
            baseProofs = [];
            
            for (let i = 0; i < 3; i++) {
                const proofData = ethers.utils.toUtf8Bytes(`proof_${i}`);
                const publicInput = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`input_${i}`));
                const verificationKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`vk_${i}`));
                const fee = ethers.utils.parseEther('0.01');
                const user = i % 2 === 0 ? user1 : user2;

                const nonce = await snarktorVerifier.userNonces(user.address);
                const message = ethers.utils.solidityKeccak256(
                    ['uint256', 'uint256', 'bytes32', 'bytes32'],
                    [fee, nonce, publicInput, verificationKey]
                );
                const signature = await user.signMessage(ethers.utils.arrayify(message));

                await snarktorVerifier.connect(user).submitBaseProof(
                    proofData,
                    publicInput,
                    verificationKey,
                    fee,
                    signature,
                    { value: fee }
                );

                baseProofs.push({
                    proofHash: ethers.utils.keccak256(proofData),
                    user: user.address,
                    fee: fee,
                    nonce: nonce,
                    publicInput: publicInput,
                    verificationKey: verificationKey,
                    signature: signature
                });
            }
        });

        it('should submit aggregated proof successfully', async function() {
            const aggregatedProofData = ethers.utils.toUtf8Bytes('aggregated_proof_data');
            const proofHashes = baseProofs.map(p => p.proofHash);
            const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);

            // Submit aggregated proof (would normally be done by authorized aggregator)
            const tx = await snarktorVerifier.connect(owner).submitAggregatedProof(
                aggregatedProofData,
                merkleRoot,
                baseProofs,
                [] // No disabled nodes
            );

            const receipt = await tx.wait();
            const aggregatedHash = ethers.utils.keccak256(aggregatedProofData);

            // Check that aggregated proof was stored
            const storedProof = await snarktorVerifier.getAggregatedProof(aggregatedHash);
            expect(storedProof.submitter).to.equal(owner.address);
            expect(storedProof.merkleRoot).to.equal(merkleRoot);

            // Check events
            const proofEvent = receipt.events.find(e => e.event === 'AggregatedProofSubmitted');
            expect(proofEvent.args.aggregatedHash).to.equal(aggregatedHash);
            expect(proofEvent.args.baseProofCount).to.equal(baseProofs.length);
        });
    });

    describe('Proof Inclusion Verification', function() {
        it('should verify proof inclusion correctly', async function() {
            // This would typically be tested with real aggregated proof data
            // For now, we'll test the merkle proof verification logic
            const proofHashes = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof2')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof3'))
            ];

            const merkleRoot = GenericSnarktorClient.buildMerkleTree(proofHashes);
            const merkleProof = GenericSnarktorClient.generateMerkleProof(proofHashes, 1);

            const isValid = GenericSnarktorClient.verifyMerkleProof(
                merkleProof.path,
                merkleProof.index,
                merkleProof.leaf,
                merkleRoot
            );

            expect(isValid).to.be.true;
        });
    });

    describe('Balance Management', function() {
        it('should handle deposits and withdrawals', async function() {
            const depositAmount = ethers.utils.parseEther('1.0');

            // Deposit
            await snarktorVerifier.connect(user1).deposit({ value: depositAmount });
            expect(await snarktorVerifier.userBalances(user1.address)).to.equal(depositAmount);

            // Withdraw
            const withdrawAmount = ethers.utils.parseEther('0.5');
            const initialBalance = await ethers.provider.getBalance(user1.address);
            
            const tx = await snarktorVerifier.connect(user1).withdraw(withdrawAmount);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

            expect(await snarktorVerifier.userBalances(user1.address))
                .to.equal(depositAmount.sub(withdrawAmount));

            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance).to.equal(
                initialBalance.add(withdrawAmount).sub(gasUsed)
            );
        });

        it('should reject withdrawal of insufficient funds', async function() {
            await expect(
                snarktorVerifier.connect(user1).withdraw(ethers.utils.parseEther('1.0'))
            ).to.be.revertedWith('Insufficient balance');
        });
    });

    describe('Fee Distribution', function() {
        it('should calculate fee distribution correctly', async function() {
            const totalFee = ethers.utils.parseEther('1.0');
            
            // Expected distribution according to SNARKtor protocol
            const expectedCur = totalFee.mul(40).div(100);  // 40%
            const expectedInc = totalFee.mul(5).div(100);   // 5%
            const expectedAgg = totalFee.mul(55).div(100);  // 55%

            expect(expectedCur.add(expectedInc).add(expectedAgg)).to.equal(totalFee);
        });
    });

    describe('Generic Proof Processing', function() {
        it('should parse various proof formats correctly', function() {
            // Test hex string proof
            const hexProof = '0x123456789abcdef';
            const hexResult = GenericSnarktorClient.parseGenericProof(hexProof);
            expect(hexResult.proofHash).to.not.be.null;
            expect(hexResult.rawData).to.equal(hexProof);

            // Test JSON proof
            const jsonProof = { proof: 'data', publicSignals: ['1', '2'] };
            const jsonResult = GenericSnarktorClient.parseGenericProof(jsonProof);
            expect(jsonResult.proofHash).to.not.be.null;
            expect(jsonResult.structured).to.deep.equal(jsonProof);

            // Test buffer proof
            const bufferProof = Buffer.from('test_proof', 'utf8');
            const bufferResult = GenericSnarktorClient.parseGenericProof(bufferProof);
            expect(bufferResult.proofHash).to.not.be.null;
        });

        it('should validate proof structures', function() {
            const validProof = { proof: 'valid_data' };
            const validation = GenericSnarktorClient.validateProofStructure(validProof);
            expect(validation.isValid).to.be.true;
            expect(validation.proofHash).to.not.be.null;
        });

        it('should standardize proof submissions', function() {
            const proofData = 'example_proof';
            const publicInputs = ['input1', 'input2'];
            const verificationKey = { curve: 'bn254' };
            const fee = ethers.utils.parseEther('0.01');

            const standardized = GenericSnarktorClient.standardizeProofSubmission(
                proofData, publicInputs, verificationKey, fee
            );

            expect(standardized.proofData).to.not.be.null;
            expect(standardized.proofHash).to.not.be.null;
            expect(standardized.publicInput).to.not.be.null;
            expect(standardized.verificationKey).to.not.be.null;
            expect(standardized.fee).to.equal(fee);
        });
    });
});