const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers")

const { describe } = require("test");
const BigNumber = require('bignumber.js');
const { duration } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");
const BN = BigNumber.BigNumber;

const Input_Token_Contract_Name = "MockStableCoin";//need to make this with 6 decimals
const Token_To_Sell_Contract_Name = "StakeShare";
const Mock_Hedgey_Locker_Contract_Name = "MockHedgeyTokenLocker"//need to make this mock.
const Token_Sale_Contract_Name = "ProductShareTokenSale"

describe("ProductShareTokenSale Unit Tests", function () {

    let INPUT_TOKEN;
    let TOKEN_TO_SELL;
    let TOKEN_SALE;
    let MOCK_TOKEN_LOCKER;


    before(async function () {
        this.signers = await ethers.getSigners();
        this.InputTokenFactory = await ethers.getContractFactory(Input_Token_Contract_Name, this.owner)
        this.TokenToSellFactory = await ethers.getContractFactory(Token_To_Sell_Contract_Name, this.owner)
        this.MockHedgeyTokenLockerFactory = await ethers.getContractFactory(Mock_Hedgey_Locker_Contract_Name, this.owner)
        this.tokenSaleFactory = await ethers.getContractFactory(Token_Sale_Contract_Name, this.owner)

        this.owner = this.signers[0]
        this.user1 = this.signers[1]
        this.user2 = this.signers[2]
    })

    //deploy all contracts
    beforeEach(async function () {
        INPUT_TOKEN = await upgrades.deployProxy(this.InputTokenFactory, ["MockStableCoin", "MUSD"])
        TOKEN_TO_SELL = await upgrades.deployProxy(this.InputTokenFactory, ["StakeShare", "PSS"])
        MOCK_TOKEN_LOCKER = await upgrades.deployProxy(this.MockHedgeyTokenLockerFactory, [])

        const adminMockTokenAmount = BigInt(10000000) * (BigInt("1000000"))//10 million USDM
        await INPUT_TOKEN.mint(this.owner, adminMockTokenAmount)

        const adminTokenToSellAmount = BigInt(10000000) * (BigInt("1000000000000000000"))//10 million PSS
        await TOKEN_TO_SELL.mint(this.owner, adminTokenToSellAmount)

    })


    async function newFundedTokenSale(inputToken, tokenToSell, tokenSaleFactory, saleStart, saleDuration, isPrivateSale, softcap, hardcap, saleprice) {

        const newTokenSale = await upgrades.deployProxy(tokenSaleFactory, [
            TOKEN_TO_SELL.target,
            INPUT_TOKEN.target,
            saleStart,
            saleStart + saleDuration,
            isPrivateSale,
            hardcap,
            softcap,
            saleprice
        ])

        const amountToSendToSale = (hardcap * BigInt("1000000000000000000")) / saleprice
        await TOKEN_TO_SELL.transfer(newTokenSale.target, amountToSendToSale)
        return { newTokenSale, amountToSendToSale }
    }


    async function setVestingInfo(signer, lockupPlan, cliff, period, length, expectedError) {
        let setTx = TOKEN_SALE.connect(signer).setVestingInfo(lockupPlan, cliff, period, length);
        if (!expectedError) {
            await setTx
        } else {
            await expect(setTx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function batchAddWhitelist(signer, whiteListAddresses, expectedError) {
        let tx = TOKEN_SALE.connect(signer).batchWhiteListAdd(whiteListAddresses);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function batchRemoveWhitelist(signer, whiteListAddresses, expectedError) {
        let tx = TOKEN_SALE.connect(signer).batchWhiteListRemove(whiteListAddresses);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }


    async function extendEndTime(signer, newEndTime, expectedError) {
        let tx = TOKEN_SALE.connect(signer).extendEndTime(newEndTime);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function setSoftCapAdminRefundAddress(signer,newSoftCapAdminRefundAddress, expectedError) {
        let tx = TOKEN_SALE.connect(signer).setSoftCapAdminRefundAddress(newSoftCapAdminRefundAddress);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }


    async function pause(signer,reason, expectedError) {
        let tx = TOKEN_SALE.connect(signer).pauseSale(reason);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function unpause(signer, expectedError) {
        let tx = TOKEN_SALE.connect(signer).unPauseSale();
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }
    


    describe("Unit Tests For Token Sale Contract", function () {

        describe("Setters", function () {
            describe("Success", function () {
                it("Contract deployment works as expected", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_TO_SELL.balanceOf(TOKEN_SALE.target)).to.equal(res.amountToSendToSale);

                    expect(await TOKEN_SALE.startDate()).to.equal(saleStart);

                    console.log(await TOKEN_SALE.endDate())
                    expect(await TOKEN_SALE.endDate()).to.equal(saleStart + saleDuration);
                    expect(await TOKEN_SALE.isSaleActive()).to.equal(true);

                    expect(await TOKEN_SALE.tokenToBeAccepted()).to.equal(INPUT_TOKEN.target);
                    expect(await TOKEN_SALE.tokenToBeSold()).to.equal(TOKEN_TO_SELL.target);


                    expect(await TOKEN_SALE.salePrice()).to.equal(salePrice);

                    expect(await TOKEN_SALE.isPrivateSale()).to.equal(isPrivateSale);
                    expect(await TOKEN_SALE.totalAmountInvested()).to.equal(0);


                    expect(await TOKEN_SALE.hardcap()).to.equal(hardCap);
                    expect(await TOKEN_SALE.softCap()).to.equal(softCap);

                    expect(await TOKEN_SALE.hasBeenWithdrawn()).to.equal(false);
                    expect(await TOKEN_SALE.softCapAdminRefundAddress()).to.equal(this.owner.address);

                    //vesting info, which has not been set yet

                    expect(await TOKEN_SALE.lockupPlan()).to.equal("0x0000000000000000000000000000000000000000");
                    expect(await TOKEN_SALE.cliffLength()).to.equal(0);
                    expect(await TOKEN_SALE.vestPeriod()).to.equal(0);
                    expect(await TOKEN_SALE.vestingLength()).to.equal(0);
                    expect(await TOKEN_SALE.vestingInfoSet()).to.equal(false);


                })

                it("Setting vesting data works as expected", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setVestingInfo(this.owner, MOCK_TOKEN_LOCKER.target, cliffLength, period, lockLength)


                    //vesting info, which has not been set yet

                    expect(await TOKEN_SALE.lockupPlan()).to.equal(MOCK_TOKEN_LOCKER.target);
                    expect(await TOKEN_SALE.cliffLength()).to.equal(cliffLength);
                    expect(await TOKEN_SALE.vestPeriod()).to.equal(period);
                    expect(await TOKEN_SALE.vestingLength()).to.equal(lockLength);
                    expect(await TOKEN_SALE.vestingInfoSet()).to.equal(true);


                })

                it("setting softCapAdminRefundAddress works as expected", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    await setSoftCapAdminRefundAddress(this.owner,this.user2.address)

                    expect(await TOKEN_SALE.softCapAdminRefundAddress()).to.equal(this.user2.address);


                })

            })


            describe("Failure", function () {

                it("Setting vesting data fails (unauthorized)", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setVestingInfo(this.user1, MOCK_TOKEN_LOCKER.target, cliffLength, period, lockLength, "Unauthorized")

                })

                it("Setting vesting data fails (ZeroAddress)", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setVestingInfo(this.owner, "0x0000000000000000000000000000000000000000", cliffLength, period, lockLength, "ZeroAddress")

                })

                it("Setting vesting data fails (WrongVestingData)", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setVestingInfo(this.owner, MOCK_TOKEN_LOCKER.target, cliffLength, 0, lockLength, "WrongVestingData")

                    await setVestingInfo(this.owner, MOCK_TOKEN_LOCKER.target, cliffLength, cliffLength, 0, "WrongVestingData")

                })

                it("Setting vesting data fails (Already Set)", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setVestingInfo(this.owner, MOCK_TOKEN_LOCKER.target, cliffLength, cliffLength, lockLength)

                    await setVestingInfo(this.owner, MOCK_TOKEN_LOCKER.target, cliffLength, cliffLength, lockLength, "VestingInfoAlreadySet")

                })

                it("setting softCapAdminRefundAddress fails - unauthorized", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setSoftCapAdminRefundAddress(this.user1,this.user2.address,"Unauthorized")


                })

                it("setting softCapAdminRefundAddress fails - ZeroAddress", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await setSoftCapAdminRefundAddress(this.owner,'0x0000000000000000000000000000000000000000',"ZeroAddress")
                })

            })
        })


        describe("Whitelist", function () {

            describe("Success", function () {


                it("Whitelist add works", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.owner, [this.user1, this.user2])

                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(true);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(true);


                })

                it("Whitelist remove works", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.owner, [this.user1, this.user2])

                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(true);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(true);


                    await batchRemoveWhitelist(this.owner, [this.user1, this.user2])

                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                })

            })

            describe("Failure", function () {

                it("Whitelist add fails - Unauthorized", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.user1, [this.user1, this.user2], "Unauthorized")




                })

                it("Whitelist add fails - Public Sale", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.owner, [this.user1, this.user2], "IsPublicSale")




                })

                it("Whitelist add fails - Unauthorized", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.user1, [this.user1, this.user2], "Unauthorized")




                })

                it("Whitelist remove fails - Unauthorized", async function (){

                    const saleStart= await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale=true;
        
                    const softCap= BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm
        
                    const salePrice =BigInt("220000"); //22 cents usdm
                    
                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE=res.newTokenSale


                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(false);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(false);

                    await batchAddWhitelist(this.owner,[this.user1,this.user2])

                    expect(await TOKEN_SALE.isWhiteListed(this.user1.address)).to.equal(true);
                    expect(await TOKEN_SALE.isWhiteListed(this.user2.address)).to.equal(true);
                    

                    await batchRemoveWhitelist(this.user1,[this.user1,this.user2],"Unauthorized")



                })

                it("Whitelist remove fails - Public Sale", async function (){

                    const saleStart= await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale=false;
        
                    const softCap= BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm
        
                    const salePrice =BigInt("220000"); //22 cents usdm
                    
                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE=res.newTokenSale
            
                    await batchRemoveWhitelist(this.owner,[],"IsPublicSale")

                })

            })


        })

        describe("End time Extension", function () {

            describe("Success", function () {

                it("Time Extension works", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    const newEndTime=saleStart+60;

                    await extendEndTime(this.owner,newEndTime)

                    expect(await TOKEN_SALE.endDate()).to.equal(saleStart+60);


                })

            })

            describe("Failure", function () {

                it("Time Extension fails - unauthorized", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    const newEndTime=saleStart+60;

                    await extendEndTime(this.user1,newEndTime,"Unauthorized")

                })

                it("Time Extension fails - end date must be after current end date", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    const newEndTime=saleStart;

                    await extendEndTime(this.owner,newEndTime,"EndDateMustBeInFuture")

                })

                it("Time Extension fails - sale has ended", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    const newEndTime=saleStart+60;

                    await time.increase(31)

                    await extendEndTime(this.owner,newEndTime,"SaleHasEnded")

                })


            })


        })

        describe("Pausing", function () {

            describe("Success", function () {

                it("Pausing works", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    expect(await TOKEN_SALE.isSaleActive()).to.equal(true);

                    await pause(this.owner, "test")

                    expect(await TOKEN_SALE.isSaleActive()).to.equal(false);

                })

                it("Unpausing works", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    expect(await TOKEN_SALE.isSaleActive()).to.equal(true);

                    await pause(this.owner, "test")

                    expect(await TOKEN_SALE.isSaleActive()).to.equal(false);

                    await unpause(this.owner)

                    expect(await TOKEN_SALE.isSaleActive()).to.equal(true);


                })


            })

            describe("Failure", function () {

                it("Pausing fails -unauthorized", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await pause(this.user1, "test","Unauthorized")

                })

                it("Pausing fails - SaleHasEnded", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await time.increase(31)

                    await pause(this.owner, "test","SaleHasEnded")

                })
                
                it("Pausing fails - Already paused", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await pause(this.owner, "test")

                    await pause(this.owner, "test","SaleIsPaused")

                })

                it("UnPausing fails - Unauthorized", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await pause(this.owner, "test")

                    await unpause(this.user1,"Unauthorized")

                })

                //todo: is this really a scenario we want? What about increasing the end time by the pause length?
                it("UnPausing fails - SaleHasEnded", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await pause(this.owner, "test")

                    await time.increase(31);

                    await unpause(this.owner,"SaleHasEnded")

                })

                it("UnPausing fails - Already Active", async function(){

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = false;

                    const softCap = BigInt("100000000000"); //1 hundred thousand usdm
                    const hardCap = BigInt("1000000000000");//1 million usdm

                    const salePrice = BigInt("220000"); //22 cents usdm

                    const cliffLength = 10;//10 seconds
                    const period = 1;//1 seconds period
                    const lockLength = 60;//60 sec total lock

                    const res = await newFundedTokenSale(
                        INPUT_TOKEN,
                        TOKEN_TO_SELL,
                        this.tokenSaleFactory,
                        saleStart,
                        saleDuration,
                        isPrivateSale,
                        softCap,
                        hardCap,
                        salePrice
                    )
                    TOKEN_SALE = res.newTokenSale

                    await unpause(this.owner,"SaleIsActiveAlready")

                })

            })


        })




    })


})



/*


// test scenarios.

We will test the functionality of the token sale contract, not so much the functionality of the hedgey contract.
This maeans that the hedgey locker functionality will be treated like a black box, at least at this level.
We will need to mock the hedgey contract for the unit tests.
We can do a manual test to test hedgey and the redeeming/vesting.

//test that the contract initalizes correctly

//test the setting of the vesting info, including its error scenarios.

//test the whitelist adding and removing, including its error scenarios.

//test the extension of the end time, including its error scenarios.

//test the pausing and unpausing of the sale

//test the purchase of the tokens, incling its error scenarios.
//test with different token input amounts.
//test with big numbers to cause some kind of overflow
//test with zeros, both for the input amount and the sale price
//test with N consecutive purchases.
// check the following changes
    //userAmountInvested for user increases by tokenInputAmount
    //totalAmountInvested increases by tokenInputAmount
    //amountOfTokenSold increaaes by amountPurchased
    //tokenInputAmount gets moved to the contract.
    //amountPurchased gets moved to hedgey contract



//test withdraw all, including its error scenarios.
// check the following changes
    //hasBeenWithdrawn set to true
    //totalAmountInvested sent to withdrawAddress
    //unsoldBalance in the contract sent to withdrawAddress
    
    
//test a user who did a buy later gets refunded because the soft cap was not reached.
//test the error scenarios.

// check the following changes
    //userAmountInvested goes to 0
    //refundAmount aka the old userAmountInvested sent to user.
    //the user no longer has the payment plan NFT, the softCapAdminRefundAddress has it.





*/