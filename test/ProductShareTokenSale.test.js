const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers")

const { describe } = require("test");
const BigNumber = require('bignumber.js');
const { duration, increase } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");
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
        TOKEN_TO_SELL = await upgrades.deployProxy(this.TokenToSellFactory, ["StakeShare", "PSS"])
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

    async function setSoftCapAdminRefundAddress(signer, newSoftCapAdminRefundAddress, expectedError) {
        let tx = TOKEN_SALE.connect(signer).setSoftCapAdminRefundAddress(newSoftCapAdminRefundAddress);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }


    async function pause(signer, reason, expectedError) {
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

    async function buyTokens(signer, owner, tokenInputAmount, expectedError) {

        await INPUT_TOKEN.connect(owner).transfer(signer.address, tokenInputAmount);

        await INPUT_TOKEN.connect(signer).approve(TOKEN_SALE.target, tokenInputAmount)

        let tx = TOKEN_SALE.connect(signer).buy(tokenInputAmount);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function withdrawAll(signer, expectedError) {
        let tx = TOKEN_SALE.connect(signer).withdrawAll(signer.address);
        if (!expectedError) {
            await tx
        } else {
            await expect(tx).to.be.revertedWithCustomError(TOKEN_SALE, expectedError)
        }
    }

    async function refund(signer, planId, expectedError) {
        let tx = TOKEN_SALE.connect(signer).refund(planId);
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

                it("setting softCapAdminRefundAddress works as expected", async function () {

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


                    await setSoftCapAdminRefundAddress(this.owner, this.user2.address)

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

                it("setting softCapAdminRefundAddress fails - unauthorized", async function () {

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

                    await setSoftCapAdminRefundAddress(this.user1, this.user2.address, "Unauthorized")


                })

                it("setting softCapAdminRefundAddress fails - ZeroAddress", async function () {

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

                    await setSoftCapAdminRefundAddress(this.owner, '0x0000000000000000000000000000000000000000', "ZeroAddress")
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

                it("Whitelist remove fails - Unauthorized", async function () {

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


                    await batchRemoveWhitelist(this.user1, [this.user1, this.user2], "Unauthorized")



                })

                it("Whitelist remove fails - Public Sale", async function () {

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

                    await batchRemoveWhitelist(this.owner, [], "IsPublicSale")

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

                    const newEndTime = saleStart + 60;

                    await extendEndTime(this.owner, newEndTime)

                    expect(await TOKEN_SALE.endDate()).to.equal(saleStart + 60);


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

                    const newEndTime = saleStart + 60;

                    await extendEndTime(this.user1, newEndTime, "Unauthorized")

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

                    const newEndTime = saleStart;

                    await extendEndTime(this.owner, newEndTime, "EndDateMustBeInFuture")

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

                    const newEndTime = saleStart + 60;

                    await time.increase(31)

                    await extendEndTime(this.owner, newEndTime, "SaleHasEnded")

                })


            })


        })

        describe("Pausing", function () {

            describe("Success", function () {

                it("Pausing works", async function () {

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

                it("Unpausing works", async function () {

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

                it("Pausing fails -unauthorized", async function () {

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

                    await pause(this.user1, "test", "Unauthorized")

                })

                it("Pausing fails - SaleHasEnded", async function () {

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

                    await pause(this.owner, "test", "SaleHasEnded")

                })

                it("Pausing fails - Already paused", async function () {

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

                    await pause(this.owner, "test", "SaleIsPaused")

                })

                it("UnPausing fails - Unauthorized", async function () {

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

                    await unpause(this.user1, "Unauthorized")

                })

                //todo: is this really a scenario we want? What about increasing the end time by the pause length?
                it("UnPausing fails - SaleHasEnded", async function () {

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

                    await unpause(this.owner, "SaleHasEnded")

                })

                it("UnPausing fails - Already Active", async function () {

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

                    await unpause(this.owner, "SaleIsActiveAlready")

                })

            })


        })

        describe("Buying", function () {

            describe("Success", function () {

                it("Buying tokens succeeds (single user, single buy)", async function () {

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    const tokenSaleBalanceBefore = await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)
                    const expectedTokenAmountPurchased = BigInt("10000000000000000000")
                    await buyTokens(this.user1, this.owner, amountToSpend);

                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user1.address)).to.be.equal(amountToSpend)
                    expect(await TOKEN_SALE.amountOfTokenSold()).to.be.equal(expectedTokenAmountPurchased)
                    expect(await TOKEN_SALE.totalAmountInvested()).to.be.equal(amountToSpend)
                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address, 1)).to.be.equal(amountToSpend)

                    expect(await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)).to.be.equal(tokenSaleBalanceBefore + amountToSpend)

                })

                it("Buying tokens succeeds (multi user, single buys)", async function () {

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

                    const amountToSpend1 = salePrice * BigInt(10);//should buy 10 tokens

                    const tokenSaleBalanceBefore1 = await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)
                    const expectedTokenAmountPurchased1 = BigInt("10000000000000000000")
                    await buyTokens(this.user1, this.owner, amountToSpend1);

                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user1.address)).to.be.equal(amountToSpend1)
                    expect(await TOKEN_SALE.amountOfTokenSold()).to.be.equal(expectedTokenAmountPurchased1)
                    expect(await TOKEN_SALE.totalAmountInvested()).to.be.equal(amountToSpend1)
                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address, 1)).to.be.equal(amountToSpend1)

                    expect(await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)).to.be.equal(tokenSaleBalanceBefore1 + amountToSpend1)


                    const amountToSpend2 = salePrice * BigInt(100);//should buy 100 tokens
                    const expectedTokenAmountPurchased2 = BigInt("100000000000000000000")
                    const tokenSaleBalanceBefore2 = await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)

                    await buyTokens(this.user2, this.owner, amountToSpend2);
                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user2.address)).to.be.equal(amountToSpend2)
                    expect(await TOKEN_SALE.amountOfTokenSold()).to.be.equal(expectedTokenAmountPurchased1 + expectedTokenAmountPurchased2)
                    expect(await TOKEN_SALE.totalAmountInvested()).to.be.equal(amountToSpend1 + amountToSpend2)
                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user2.address, 2)).to.be.equal(amountToSpend2)

                    expect(await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)).to.be.equal(tokenSaleBalanceBefore2 + amountToSpend2)


                })

                it("Buying tokens succeeds (single user, multi buys)", async function () {
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

                    const amountToSpend1 = salePrice * BigInt(10);//should buy 10 tokens

                    const tokenSaleBalanceBefore1 = await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)
                    const expectedTokenAmountPurchased1 = BigInt("10000000000000000000")
                    await buyTokens(this.user1, this.owner, amountToSpend1);

                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user1.address)).to.be.equal(amountToSpend1)
                    expect(await TOKEN_SALE.amountOfTokenSold()).to.be.equal(expectedTokenAmountPurchased1)
                    expect(await TOKEN_SALE.totalAmountInvested()).to.be.equal(amountToSpend1)
                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address, 1)).to.be.equal(amountToSpend1)

                    expect(await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)).to.be.equal(tokenSaleBalanceBefore1 + amountToSpend1)


                    const amountToSpend2 = salePrice * BigInt(100);//should buy 100 tokens
                    const expectedTokenAmountPurchased2 = BigInt("100000000000000000000")
                    const tokenSaleBalanceBefore2 = await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)


                    await buyTokens(this.user1, this.owner, amountToSpend2);
                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user1.address)).to.be.equal(amountToSpend1 + amountToSpend2)
                    expect(await TOKEN_SALE.amountOfTokenSold()).to.be.equal(expectedTokenAmountPurchased1 + expectedTokenAmountPurchased2)
                    expect(await TOKEN_SALE.totalAmountInvested()).to.be.equal(amountToSpend1 + amountToSpend2)
                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address, 2)).to.be.equal(amountToSpend2)

                    expect(await INPUT_TOKEN.balanceOf(TOKEN_SALE.target)).to.be.equal(tokenSaleBalanceBefore2 + amountToSpend2)

                })
            })


            describe("Failure", function () {
                it("Buying tokens fails - sale is paused", async function () {

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


                    await pause(this.owner, "test")

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend, "SaleIsPaused");



                })

                it("Buying tokens fails - sale not started", async function () {

                    const saleStart = await time.latest() + 5000;
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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend, "SaleNotStarted");


                })

                it("Buying tokens fails - sale ended", async function () {

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await increase(60)

                    await buyTokens(this.user1, this.owner, amountToSpend, "SaleHasEnded");


                })

                it("Buying tokens fails - ZeroInputToken", async function () {

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

                    const amountToSpend = 0;

                    await buyTokens(this.user1, this.owner, amountToSpend, "ZeroInputToken");


                })

                it("Buying tokens fails - Hard cap reached", async function () {

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

                    const amountToSpend = hardCap + BigInt(1);

                    await buyTokens(this.user1, this.owner, amountToSpend, "HardcapReached");


                })

                it("Buying tokens fails - unauthorized in private sale", async function () {

                    const saleStart = await time.latest();
                    const saleDuration = 30;//30 seconds
                    const isPrivateSale = true;

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend, "Unauthorized");


                })
            })

        })


        describe("Withdrawing funds", function () {

            describe("Success", function () {

                it("Withdraw works", async function () {

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

                    const amountToSpend = softCap + salePrice;//soft cap plus 1 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    //sale is done
                    await increase(40)

                    const withdrawAddressBalanceInputToken = await INPUT_TOKEN.balanceOf(this.owner.address);
                    const withdrawAddressBalanceTokenToSell = await TOKEN_TO_SELL.balanceOf(this.owner.address);

                    const totalAmountInvested = await TOKEN_SALE.totalAmountInvested();
                    const unsoldBalance = await TOKEN_TO_SELL.balanceOf(TOKEN_SALE.target);

                    await withdrawAll(this.owner)

                    expect(await TOKEN_SALE.hasBeenWithdrawn()).to.be.equal(true)

                    expect(await INPUT_TOKEN.balanceOf(this.owner.address)).to.be.equal(withdrawAddressBalanceInputToken + totalAmountInvested)
                    expect(await TOKEN_TO_SELL.balanceOf(this.owner.address)).to.be.equal(withdrawAddressBalanceTokenToSell + unsoldBalance)

                })
            })

            describe("Failure", function () {

                it("Withdraw fails - unauthorized", async function () {

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

                    const amountToSpend = softCap + salePrice;//soft cap plus 1 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    //sale is done
                    await increase(40)

                    await withdrawAll(this.user1, "Unauthorized")

                })

                it("Withdraw fails - SaleHasNotEnded", async function () {

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

                    const amountToSpend = softCap + salePrice;//soft cap plus 1 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);


                    await withdrawAll(this.owner, "SaleHasNotEnded")

                })

                it("Withdraw fails - AlreadyWithdrawn", async function () {

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

                    const amountToSpend = softCap + salePrice;//soft cap plus 1 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    //sale is done
                    await increase(40)

                    await withdrawAll(this.owner)

                    await withdrawAll(this.owner, "AlreadyWithdrawn")


                })

                it("Withdraw fails - SoftcapNotReached", async function () {

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

                    const amountToSpend = salePrice * BigInt(100)

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    //sale is done
                    await increase(40)

                    await withdrawAll(this.owner, "SoftcapNotReached")


                })
            })
        })

        describe("softcap refunding", function () {

            describe("Success", function () {

                it.only("Refund works", async function () {

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    await increase(60)

                    const plan=1;

                    const previousUserAmountInvestedTotal=await TOKEN_SALE.userAmountInvestedTotal(this.user1)
                    const refundAmount=await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address,plan);
                    
                    const userBalanceBefore=await INPUT_TOKEN.balanceOf(this.user1.address)

                    await refund(this.user1, 1);

                    expect(await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address,plan)).to.be.equal(0)
                    expect(await TOKEN_SALE.userAmountInvestedTotal(this.user1)).to.be.equal(previousUserAmountInvestedTotal-refundAmount)
                    expect(await INPUT_TOKEN.balanceOf(this.user1.address)).to.be.equal(userBalanceBefore+refundAmount)

                })

            })

            describe("Failure", function () {

                it("Refund fails - SaleHasNotEnded", async function () {

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    //await increase(60)

                    const plan=1;

                    const previousUserAmountInvestedTotal=await TOKEN_SALE.userAmountInvestedTotal(this.user1)
                    const refundAmount=await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address,plan);
                    
                    const userBalanceBefore=await INPUT_TOKEN.balanceOf(this.user1.address)

                    await refund(this.user1, 1,"SaleHasNotEnded");

                })

                it("Refund fails - SoftcapReached", async function () {

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

                    const amountToSpend = softCap+(salePrice * BigInt(10));

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    await increase(60)

                    const plan=1;

                    const previousUserAmountInvestedTotal=await TOKEN_SALE.userAmountInvestedTotal(this.user1)
                    const refundAmount=await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address,plan);
                    
                    const userBalanceBefore=await INPUT_TOKEN.balanceOf(this.user1.address)

                    await refund(this.user1, 1,"SoftcapReached");



                })

                it("Refund fails -NothingToRefund", async function () {

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

                    const amountToSpend = salePrice * BigInt(10);//should buy 10 tokens

                    await buyTokens(this.user1, this.owner, amountToSpend);

                    await increase(60)

                    const plan=1;

                    const previousUserAmountInvestedTotal=await TOKEN_SALE.userAmountInvestedTotal(this.user1)
                    const refundAmount=await TOKEN_SALE.userAmountInvestedPerPlan(this.user1.address,plan);
                    
                    const userBalanceBefore=await INPUT_TOKEN.balanceOf(this.user1.address)

                    await refund(this.user1, 1);

                })
            })
        })
    })
})