const { ethers, upgrades } = require("hardhat");

const TokenToBeSold="0x7b1806053CeB1BdcDae0eC5DA408e65e61E34f71"//PSS
const TokenToBeAccepted="0xD75dDEC0768a3D9f856de59Cb20BE1520c9b522c"//MOCK stablecoin
const StartDate=Math.floor(Date.now() / 1000);
const EndDate=StartDate+(3600*10) //10 hours
const IsPrivateSale=false;
const hardcap=1000000*Math.pow(10,6);//1 million dollars in stablecoin
const softcap=10000*Math.pow(10,6);//10k in stablecoin
const salePrice=220000;//22 cents of stablecoin


const VotingTokenLockupPlansContract="0x6f4937559e463000D3F01bBDb7f0C0D4a2FCf87b";//FILL IN
const cliffLength=600;//10 mins until vesting starts
const vestLength=3600;//1 hour total vest length
const vestPeriod=600;//10 mins, 6 total vesting periods

async function deployTokenSale() {
    let signers = await ethers.getSigners();
    let admin = signers[0]
    console.log(`${admin.address} is deploying token sale contract`)

    let ProductShareTokenSaleFactory = await ethers.getContractFactory('ProductShareTokenSale', admin)    

    try{

    
    const saleInstance = await upgrades.deployProxy(ProductShareTokenSaleFactory, [TokenToBeSold,TokenToBeAccepted,StartDate,EndDate,IsPrivateSale,hardcap,softcap,salePrice])
    
    console.log("deployed sale contract")

    console.log("trying to finish set up")

    await saleInstance.setVestingInfo(VotingTokenLockupPlansContract,cliffLength,vestPeriod,vestLength)

    console.log("finished set up ")
    }catch(e){
        console.log(e)
    }
}

deployTokenSale()


