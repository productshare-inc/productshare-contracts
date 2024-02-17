const { ethers, upgrades } = require("hardhat");

const TOKEN_NAME = "StakeShare";
const TOKEN_SYMBOL = "PSS";

async function deployToken() {
    console.log("deploying token contract")
    let signers = await ethers.getSigners();
    let admin = signers[0]
    let StakeShareFactory = await ethers.getContractFactory('StakeShare', admin)    
    const erc20Token = await upgrades.deployProxy(StakeShareFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    
    console.log("deployed contract: ")
    console.log(erc20Token.address)

}

deployToken()

