require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    "telos-testnet": {
      url: "https://testnet.telos.net/evm",
      chainId: 41,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    "telos-mainnet": {
      url: "https://mainnet.telos.net/evm", 
      chainId: 40,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  etherscan: {
    apiKey: {
      "telos-testnet": "teloscan-no-api-key-required",
      "telos-mainnet": "teloscan-no-api-key-required"
    },
    customChains: [
      {
        network: "telos-testnet",
        chainId: 41,
        urls: {
          apiURL: "https://api-testnet.teloscan.io/api",
          browserURL: "https://testnet.teloscan.io/"
        }
      },
      {
        network: "telos-mainnet", 
        chainId: 40,
        urls: {
          apiURL: "https://api.teloscan.io/api",
          browserURL: "https://www.teloscan.io/"
        }
      }
    ]
  }
};