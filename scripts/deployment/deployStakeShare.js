const { ethers, upgrades } = require("hardhat");

const TOKEN_NAME = "StakeShare";
const TOKEN_SYMBOL = "PSS";
const supplyCap = BigInt("333000000000000000000000000")

async function deployToken() {
    let signers = await ethers.getSigners();
    let admin = signers[0]
    console.log(`${admin.address} is deploying token contract`)

    let StakeShareFactory = await ethers.getContractFactory('StakeShare', admin)    
    const erc20Token = await upgrades.deployProxy(StakeShareFactory, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    
    console.log("deployed contract at "+erc20Token.target)

}

deployToken()

