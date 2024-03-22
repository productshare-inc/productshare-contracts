const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const TOKEN_NAME = "StakeShare";
const TOKEN_SYMBOL = "PSS";

const ERC20_Contract_Name="StakeShare"

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));

const supplyCap = BigInt("333000000000000000000000000")

describe.only("StakeShare Test", function () {

  before(async function () {
    this.signers = await ethers.getSigners();
    this.ERC20Token = await ethers.getContractFactory(ERC20_Contract_Name, this.owner)
    this.admin = this.signers[0]
    this.minter = this.signers[1]
    this.tokenOwner = this.signers[4];
    this.tokenOwner2 = this.signers[5];
  })

  it("Deploys properly", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    expect(await erc20Token.name()).to.equal(TOKEN_NAME);
     expect(await erc20Token.symbol()).to.equal(TOKEN_SYMBOL);
    expect(await erc20Token.hasRole(MINTER_ROLE, this.admin.address)).to.equal(true);
  });

  it("Changes roles properly", async function () {

    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])

    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    //revoke
    tx = await erc20Token.revokeRole(MINTER_ROLE, this.admin.address)
    await tx.wait();

    expect(await erc20Token.hasRole(MINTER_ROLE, this.minter.address)).to.equal(true);
    expect(await erc20Token.hasRole(MINTER_ROLE, this.admin.address)).to.equal(false);
  });

  it("mints and burns properly", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    //mint
    const mintAmount = 1000;
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)
    await tx.wait();
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
    //burn
    tx = await erc20Token.connect(this.tokenOwner).burn(mintAmount)
    await tx.wait();
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(0);
  })

  it("can mint up top supply cap", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    //mint
    const mintAmount = supplyCap;
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)
    await tx.wait();
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
  })

  it("cannot mint beyond supply cap at once", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    //mint
    const mintAmount = supplyCap+BigInt(1);
    await expect(erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)).to.be.revertedWithCustomError(erc20Token,"ExceedsSupplyCap")
  })

  it("cannot mint beyond supply cap in N steps", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();

    //mint 1
    const mintAmount = supplyCap-BigInt(1000);
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)
    await tx.wait();
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);

    //mint
    const mintAmount1 = BigInt(1001);
    await expect(erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)).to.be.revertedWithCustomError(erc20Token,"ExceedsSupplyCap")
  })

  it("cannot mint when the caller does not have minter role", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC20Token, [TOKEN_NAME, TOKEN_SYMBOL,supplyCap])
    const mintAmount = 1000;
    await expect(erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)).to.be.revertedWithCustomError(erc20Token,"DoesNotHaveMinterRole")
  })


  


});
