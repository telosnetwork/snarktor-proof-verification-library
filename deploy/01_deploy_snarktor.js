module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("Deploying SNARKtor Proof Verification Library...");
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);

  // Deploy SnarktorUtils library first
  const snarktorUtils = await deploy('SnarktorUtils', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  // Deploy main SnarktorVerifier contract
  const snarktorVerifier = await deploy('SnarktorVerifier', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    libraries: {
      SnarktorUtils: snarktorUtils.address,
    },
  });

  log(`SnarktorUtils deployed at: ${snarktorUtils.address}`);
  log(`SnarktorVerifier deployed at: ${snarktorVerifier.address}`);

  // Verify contracts on block explorer if not on local network
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log("Waiting for block confirmations...");
    await snarktorVerifier.deployTransaction.wait(6);
    
    try {
      await hre.run("verify:verify", {
        address: snarktorUtils.address,
        constructorArguments: [],
      });
      
      await hre.run("verify:verify", {
        address: snarktorVerifier.address,
        constructorArguments: [],
        libraries: {
          SnarktorUtils: snarktorUtils.address,
        },
      });
      
      log("Contracts verified on block explorer");
    } catch (error) {
      log("Contract verification failed:", error.message);
    }
  }

  // Log deployment summary
  log("\n=== Deployment Summary ===");
  log(`Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  log(`SnarktorUtils: ${snarktorUtils.address}`);
  log(`SnarktorVerifier: ${snarktorVerifier.address}`);
  log(`Gas Used: ${snarktorVerifier.receipt.gasUsed}`);
  log(`Transaction Hash: ${snarktorVerifier.transactionHash}`);
  
  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
    contracts: {
      SnarktorUtils: {
        address: snarktorUtils.address,
        transactionHash: snarktorUtils.transactionHash,
        gasUsed: snarktorUtils.receipt.gasUsed
      },
      SnarktorVerifier: {
        address: snarktorVerifier.address,
        transactionHash: snarktorVerifier.transactionHash,
        gasUsed: snarktorVerifier.receipt.gasUsed
      }
    }
  };

  // Write deployment info to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentDir = path.join(__dirname, '..', 'deployments', network.name);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentDir, 'deployment-info.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  log(`Deployment info saved to: deployments/${network.name}/deployment-info.json`);
  log("=========================\n");
};

module.exports.tags = ['SnarktorVerifier', 'all'];