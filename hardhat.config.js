require("dotenv").config();

require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");

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
  solidity: "0.8.20",
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    optimisticEthereum:{
      url: "https://opt-mainnet.g.alchemy.com/v2/_CMwzqagiVpMeXJBITzEGH_BtPmrVn6J",
      chainId: 10,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    optimisticGoerli: {
      url: "https://opt-goerli.g.alchemy.com/v2/mQjNQDn-XdE7EpiZW0qqirKYi-j0zuI3",
      chainId: 420,
      accounts:
      process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      bsc: process.env.bscScanApiKey,
      optimisticGoerli: process.env.optimismScanApiKey,
      optimisticEthereum: process.env.optimismScanApiKey
    }
  },
};
