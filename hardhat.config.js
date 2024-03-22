require('dotenv').config({path:__dirname+'/.env'})
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@nomicfoundation/hardhat-chai-matchers")
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mainnet: {
      url: "https://eth-mainnet.g.alchemy.com/v2/-pn5nPFpYKqStQpDXBxA9glOBKOIDdOi",
      accounts:
      process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : []
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/pXrOXDi7213Lifmy6MyRViWCKkXv-2BI",
      chainId: 11155111.,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : []
    },
    optimisticEthereum: {
      url: "https://opt-mainnet.g.alchemy.com/v2/_CMwzqagiVpMeXJBITzEGH_BtPmrVn6J",
      chainId: 10,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    optimisticSepolia: {
      url: "https://opt-sepolia.g.alchemy.com/v2/VM97KKQZC3kiYc84woykmIRUO1L-eDPq",
      chainId: 11155420,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 3640000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      optimisticEthereum: process.env.OPTIMISM_SCAN_API_KEY,
      optimisticSepolia: process.env.OPTIMISM_SCAN_API_KEY,
      sepolia: process.env.ETHER_SCAN_API_KEY,
      mainnet: process.env.ETHER_SCAN_API_KEY
    },
    customChains: [
      {
        network: "optimisticSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/",
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [],
  }

}
