const { ethers, upgrades } = require("hardhat");

const VOTING_TOKEN_ADDRESS = "0x397470f7Fb1242Dc216AEB96B07A2431b8510ce2";//careful, make sure this is correct

async function deployGovernor() {
    let signers = await ethers.getSigners();
    let admin = signers[0]
    console.log(`${admin.address} is deploying token contract`)
    let GovernorFactory = await ethers.getContractFactory('ProductShareGovernor', admin)    

    const governorInstance = await upgrades.deployProxy(GovernorFactory, [VOTING_TOKEN_ADDRESS, admin.address])
    
    console.log("deployed governor contract")
}

deployGovernor()


