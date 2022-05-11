const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");


const TOKEN_NAME = "ShareCash";
const TOKEN_SYMBOL = "PSS";


const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
const PAUSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER_ROLE"));
const BLACKLISTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BLACKLISTER_ROLE"));

describe("ERC20PresetMinterPauserUpgradable Test", function () {

  before(async function () {
    this.signers = await ethers.getSigners();
    this.ERC11554KFactory = await ethers.getContractFactory('ERC20PresetMinterPauserUpgradeable', this.owner)
    this.admin = this.signers[0]
    this.minter = this.signers[1]
    this.pauser = this.signers[2]
    this.blacklister = this.signers[3]
    this.tokenOwner = this.signers[4];
    this.tokenOwner2 = this.signers[5];
  })


  it("Deploys properly", async function () {

    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()

    expect(await erc20Token.name()).to.equal(TOKEN_NAME);
    expect(await erc20Token.symbol()).to.equal(TOKEN_SYMBOL);
    expect(await erc20Token.hasRole(MINTER_ROLE, this.admin.address)).to.equal(true);
    expect(await erc20Token.hasRole(PAUSER_ROLE, this.admin.address)).to.equal(true);
    expect(await erc20Token.hasRole(BLACKLISTER_ROLE, this.admin.address)).to.equal(true);
  });


  it("Changes roles properly", async function () {

    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()

    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    tx = await erc20Token.grantRole(PAUSER_ROLE, this.pauser.address)
    await tx.wait();
    tx = await erc20Token.grantRole(BLACKLISTER_ROLE, this.blacklister.address)
    await tx.wait();
    //revoke
    tx = await erc20Token.revokeRole(MINTER_ROLE, this.admin.address)
    await tx.wait();

    expect(await erc20Token.hasRole(MINTER_ROLE, this.minter.address)).to.equal(true);
    expect(await erc20Token.hasRole(PAUSER_ROLE, this.pauser.address)).to.equal(true);
    expect(await erc20Token.hasRole(BLACKLISTER_ROLE, this.blacklister.address)).to.equal(true);
    expect(await erc20Token.hasRole(MINTER_ROLE, this.admin.address)).to.equal(false);
  });

  it("mints and burns properly", async function () {

    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()
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


  it("blacklists and unblacklists addresses correctly when from address is blacklisted", async function () {

    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()

    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    tx = await erc20Token.grantRole(BLACKLISTER_ROLE, this.blacklister.address)
    await tx.wait();

    // init bal
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(0);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);

    //mint
    const mintAmount = 1000;
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)

    // post mint bal
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);

    //backlist from
    tx = await erc20Token.connect(this.blacklister).modifyblacklistedStatus(this.tokenOwner.address, true);
    await tx.wait();

    expect(await erc20Token.blacklisted(this.tokenOwner.address)).to.equal(true);

    let errorReport = null;
    try {
      await erc20Token.connect(this.tokenOwner).transfer(this.tokenOwner2.address, mintAmount)
    } catch (e) {
      errorReport = e;
    }
    expect(errorReport).to.not.equal(null)
    expect(JSON.stringify(errorReport).includes("from address is blacklisted")).to.equal(true);

    // post failed transfer bal, the same
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);


    //unblacklist 
    tx = await erc20Token.connect(this.blacklister).modifyblacklistedStatus(this.tokenOwner.address, false);
    await tx.wait();

    expect(await erc20Token.blacklisted(this.tokenOwner.address)).to.equal(false);


    tx = await erc20Token.connect(this.tokenOwner).transfer(this.tokenOwner2.address, mintAmount)
    await tx.wait();

    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(0);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(mintAmount);

  })

  
  it("blacklists and unblacklists addresses correctly when to address is blacklisted", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()

    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    tx = await erc20Token.grantRole(BLACKLISTER_ROLE, this.blacklister.address)
    await tx.wait();

    // init bal
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(0);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);

    //mint
    const mintAmount = 1000;
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)

    // post mint bal
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);

    //backlist from
    tx = await erc20Token.connect(this.blacklister).modifyblacklistedStatus(this.tokenOwner2.address, true);
    await tx.wait();

    expect(await erc20Token.blacklisted(this.tokenOwner2.address)).to.equal(true);

    let errorReport = null;
    try {
      await erc20Token.connect(this.tokenOwner).transfer(this.tokenOwner2.address, mintAmount)
    } catch (e) {
      errorReport = e;
    }
    expect(errorReport).to.not.equal(null)
    expect(JSON.stringify(errorReport).includes("to address is blacklisted")).to.equal(true);

    // post failed transfer bal, the same
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(mintAmount);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(0);
    //unblacklist 
    tx = await erc20Token.connect(this.blacklister).modifyblacklistedStatus(this.tokenOwner2.address, false);
    await tx.wait();
    expect(await erc20Token.blacklisted(this.tokenOwner2.address)).to.equal(false);
    tx = await erc20Token.connect(this.tokenOwner).transfer(this.tokenOwner2.address, mintAmount)
    await tx.wait();
    expect(await erc20Token.balanceOf(this.tokenOwner.address)).to.equal(0);
    expect(await erc20Token.balanceOf(this.tokenOwner2.address)).to.equal(mintAmount);
  })
  
  
  it("fails to blacklist when the caller has wrong role", async function () {
    const erc20Token = await upgrades.deployProxy(this.ERC11554KFactory, [TOKEN_NAME, TOKEN_SYMBOL])
    await erc20Token.deployed()
    //grant
    let tx = await erc20Token.grantRole(MINTER_ROLE, this.minter.address)
    await tx.wait();
    //tx = await erc20Token.grantRole(BLACKLISTER_ROLE, this.blacklister.address)
    //await tx.wait();

    //mint
    const mintAmount = 1000;
    tx = await erc20Token.connect(this.minter).mint(this.tokenOwner.address, mintAmount)

    //backlist from
    let errorReport=null;
    try{
      tx = await erc20Token.connect(this.blacklister).modifyblacklistedStatus(this.tokenOwner2.address, true);
      await tx.wait();
    }catch(e){
      errorReport=e;
    }
    expect(errorReport).to.not.equal(null)
    expect(JSON.stringify(errorReport).includes("must have blacklister role")).to.equal(true);
  })

});
