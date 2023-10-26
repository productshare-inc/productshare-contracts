const { ethers, upgrades } = require("hardhat");

const TOKEN_NAME = "ShareCash";
const TOKEN_SYMBOL = "PSC";

async function deployToken() {
    console.log("deploying contract")
    let signers = await ethers.getSigners();
    let admin = signers[0]
    let ERC11554KFactory = await ethers.getContractFactory('ERC20PresetMinterPauserUpgradeable', admin)    
    const erc20Token = await upgrades.deployProxy(ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()
    
    console.log("deployed contract: ")
    console.log(erc20Token.address)

}


deployToken()


