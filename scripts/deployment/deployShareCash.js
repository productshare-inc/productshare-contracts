const { ethers, upgrades } = require("hardhat");

const TOKEN_NAME = "ShareCash";
const TOKEN_SYMBOL = "PSC";

async function deployToken() {
    console.log("deploying token contract")
    let signers = await ethers.getSigners();
    let admin = signers[0]
    let ShareCashFactory = await ethers.getContractFactory('ShareCash', admin)    
    const erc20Token = await upgrades.deployProxy(ShareCashFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    
    console.log("deployed contract: ")
    console.log(erc20Token.address)

}

deployToken()


