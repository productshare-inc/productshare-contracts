const { ethers, upgrades } = require("hardhat");

const VOTING_TOKEN_ADDRESS = "enter here";

async function deployGovernor() {
    console.log("deploying governor contract")
    let signers = await ethers.getSigners();
    let admin = signers[0]

    let GovernorFactory = await ethers.getContractFactory('ProductShareGovernor', admin)    

    const governorInstance = await upgrades.deployProxy(GovernorFactory, [VOTING_TOKEN_ADDRESS, admin.address])
    
    console.log("deployed governor contract: ")
    console.log(governorInstance.address)
}

deployGovernor()


