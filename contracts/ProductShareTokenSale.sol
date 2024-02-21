// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";

import "./interfaces/ITOKEN.sol";
import "./interfaces/ILockupPlans.sol";

/*
    All token amounts MUST be in that token's native decimal
    */
contract ProductShareTokenSale is
    Initializable,
    AccessControlEnumerableUpgradeable
{
    uint256 public startDate;
    uint256 public endDate;
    bool public isSaleActive;

    ITOKEN public tokenToBeAccepted; //for example USDC with 6 decimal points
    ITOKEN public tokenToBeSold; //for example PSS with 18 decimal points

   
    //220000 USDT WEI gets you 1000000000000000000 PSS WEI
    //how many of the tokenToBeAccepted for 1 abstract (not wei) unit of tokenToBeSold
    uint256 public salePrice;

    bool public isPrivateSale;
    mapping(address => bool) public isWhiteListed;

    mapping(address => uint256) public userAmountInvested;
    uint256 public totalAmountInvested;

    bytes32 public constant SALE_ADMIN_ROLE = keccak256("SALE_ADMIN_ROLE");

    uint256 amountOfTokenSold; //total amount that has been sold.

    uint256 public hardcap;
    uint256 public softCap;

    ILockupPlans public lockupPlan;
    uint256 public cliffLength; //how long until vesting starts from start date.
    uint256 public vestPeriod; //length of a vesting period, for example 86400=day

    uint256 public vestingLength; //how long a user will be vesting for after cliff.

    /*
    Custom Errors
*/
    error EndDateMustBeInFuture();
    error IsPublicSale();
    error SaleHasEnded();
    error SaleIsPaused();
    error SaleIsActiveAlready();
    error WrongSaleData();
    error ZeroAddress();
    error WrongVestingData();
    error ZeroInputToken();
    error HardcapReached();

    /*
    0 -> does not have SALE_ADMIN_ROLE role 
    */
    error Unauthorized(uint256 code);

    /*
    Events
*/
    event addressWhiteListed(address[] whitelistedAddress);
    event addressUnWhiteListed(address[] unwhitelistedAddress);
    event endDateExtended(uint256 newEndDate);
    event salePaused(string reason);
    event saleUnPaused();
    event salePriceChanged(uint256 newSalePrice);

    function initialize(
        ITOKEN _tokenToBeSold,
        ITOKEN _tokenToBeAccepted,
        uint256 _startDate,
        uint256 _endDate,
        bool _isPrivateSale,
        uint256 _hardcap,
        uint256 _softcap,
        uint256 _salePrice
    ) public virtual initializer {
        if (_endDate <= _startDate) {
            revert EndDateMustBeInFuture();
        }
        if (_hardcap == 0 || _softcap == 0 || _softcap >= _hardcap || _salePrice == 0 ) {
            revert WrongSaleData();
        }

        startDate = _startDate;
        endDate = _endDate;

        tokenToBeSold = _tokenToBeSold;
        tokenToBeAccepted = _tokenToBeAccepted;
        salePrice = _salePrice;

        isPrivateSale = _isPrivateSale;

        hardcap = _hardcap;
        softCap = _softcap;

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(SALE_ADMIN_ROLE, _msgSender());
    }

    function setVestingInfo(
        ILockupPlans _lockUpPlan,
        uint256 _cliffLength,
        uint256 _vestPeriod,
        uint256 _vestingLength
    ) public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }

        if (address(_lockUpPlan) == address(0)) {
            revert ZeroAddress();
        }

        if(_vestPeriod==0 || _vestingLength==0){
            revert WrongVestingData();
        }

        lockupPlan = _lockUpPlan;
        cliffLength = _cliffLength;
        vestPeriod = _vestPeriod;
        vestingLength = _vestingLength;
    }

    function batchWhiteListAdd(address[] calldata whitelistedAddresses) public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }

        if (!isPrivateSale) {
            revert IsPublicSale();
        }
        for (uint256 i = 0; i < whitelistedAddresses.length; i++) {
            if (!isWhiteListed[whitelistedAddresses[i]]) {
                isWhiteListed[whitelistedAddresses[i]] = true;
            }
        }
        emit addressWhiteListed(whitelistedAddresses);
    }

    function batchWhiteListRemove(
        address[] calldata unWhitelistedAddresses
    ) public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }
        if (!isPrivateSale) {
            revert IsPublicSale();
        }
        for (uint256 i = 0; i < unWhitelistedAddresses.length; i++) {
            if (isWhiteListed[unWhitelistedAddresses[i]]) {
                isWhiteListed[unWhitelistedAddresses[i]] = false;
            }
        }
        emit addressUnWhiteListed(unWhitelistedAddresses);
    }

    function extendEndTime(uint256 _newEndDate) public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }

        if (_newEndDate <= endDate) {
            revert EndDateMustBeInFuture();
        }

        endDate = _newEndDate;

        emit endDateExtended(endDate);
    }

    function pauseSale(string calldata reason) public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }
        if (block.timestamp >= endDate) {
            revert SaleHasEnded();
        }
        if (!isSaleActive) {
            revert SaleIsPaused();
        }
        isSaleActive = false;
        emit salePaused(reason);
    }

    function unPauseSale() public {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }
        if (block.timestamp >= endDate) {
            revert SaleHasEnded();
        }

        if (isSaleActive) {
            revert SaleIsActiveAlready();
        }
        isSaleActive = true;
        emit saleUnPaused();
    }

    //work in progress
    //TODO: what happens when there already is a vesting plan? We need to handle being able to handle users investing more than once
    function buy(uint256 tokenInputAmount) public {

        if (!isSaleActive) {
            revert SaleIsPaused();
        }

        if(block.timestamp > endDate){
            revert SaleHasEnded();
        }

        if(tokenInputAmount==0){//no minimum purchase amount
            revert ZeroInputToken();
        }

        if(totalAmountInvested+tokenInputAmount>hardcap){
            revert HardcapReached();
        }

        uint256 amountPurchased = ((tokenInputAmount * 10**tokenToBeSold.decimals()) / salePrice);

        //tokens per period
        uint256 numPeriods = vestingLength / vestPeriod;
        uint256 tokensPerPeriod = amountPurchased / numPeriods;

        userAmountInvested[msg.sender]+=tokenInputAmount;

        totalAmountInvested+=tokenInputAmount;
        
        amountOfTokenSold+=amountPurchased;

        //transfer input tokens to this contract
        tokenToBeAccepted.transferFrom(msg.sender,address(this),tokenInputAmount);

        //approve move to lockup
        tokenToBeSold.approve(address(lockupPlan),amountPurchased);
        lockupPlan.createPlan(
            msg.sender,
            address(tokenToBeSold),
            amountPurchased,
            block.timestamp,
            block.timestamp + cliffLength,
            tokensPerPeriod,
            vestPeriod
        );
    }

    //NOTE add function here to withdraw tokens at the end of the sale

    //NOTE: add funciton here to service refunds of soft cap is not met
}
