const { ethers, upgrades } = require("hardhat");

const TokenToBeSold="0x397470f7Fb1242Dc216AEB96B07A2431b8510ce2"//PSS
const TokenToBeAccepted="0x5fd84259d66Cd46123540766Be93DFE6D43130D7"//USDC
const StartDate=Math.floor(Date.now() / 1000);
const EndDate=StartDate+3600//one hour
const IsPrivateSale=false;
const hardcap=1000000*10^6;//1 million dollars in stablecoin
const softcap=10000*10^6;//10k in stablecoin
const salePrice=220000;//22 cents of stablecoin



const VotingTokenLockupPlansContract="";//FILL IN
const cliffLength=600;//10 mins until vesting starts
const vestLength=3600;//1 hour total vest length
const vestPeriod=600;//10 mins, 6 total vesting periods

async function deployTokenSale() {
    let signers = await ethers.getSigners();
    let admin = signers[0]
    console.log(`${admin.address} is deploying token sale contract`)

    let ProductShareTokenSaleFactory = await ethers.getContractFactory('ProductShareTokenSale', admin)    

    const saleInstance = await upgrades.deployProxy(ProductShareTokenSaleFactory, [TokenToBeSold,TokenToBeAccepted,StartDate,EndDate,IsPrivateSale,hardcap,softcap,salePrice])
    
    console.log("deployed sale contract")

    console.log("finishin set up")

    //await saleInstance.setVestingInfo(VotingTokenLockupPlansContract,cliffLength,vestPeriod,vestLength)

}

deployTokenSale()


