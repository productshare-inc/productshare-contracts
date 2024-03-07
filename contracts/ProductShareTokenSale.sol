// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/ITOKEN.sol";
import "./interfaces/ILockupPlans.sol";

/*
    All token amounts MUST be in that token's native decimal
*/
contract ProductShareTokenSale is
    Initializable,
    AccessControlEnumerableUpgradeable,
    ReentrancyGuardUpgradeable
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

    mapping(address => mapping(uint256 => uint256))
        public userAmountInvestedPerPlan; //invested amount invested for user per plan
    mapping(address => uint256) public userAmountInvestedTotal; //total amount invested for a user.
    uint256 public totalAmountInvested; //total amount invested for all users.

    bytes32 public constant SALE_ADMIN_ROLE = keccak256("SALE_ADMIN_ROLE");

    uint256 public amountOfTokenSold; //total amount that has been sold.

    uint256 public hardcap;
    uint256 public softCap;

    ILockupPlans public lockupPlan;
    uint256 public cliffLength; //how long until vesting starts from start date.
    uint256 public vestPeriod; //length of a vesting period, for example 86400=day

    uint256 public vestingLength; //how long a user will be vesting for after cliff.

    bool public hasBeenWithdrawn;

    address public softCapAdminRefundAddress;

    bool public vestingInfoSet;

    /*
    Custom Errors
*/
    error EndDateMustBeInFuture();
    error IsPublicSale();
    error SaleHasEnded();
    error SaleHasNotEnded();
    error SaleIsPaused();
    error SaleIsActiveAlready();
    error WrongSaleData();
    error ZeroAddress();
    error WrongVestingData();
    error ZeroInputToken();
    error HardcapReached();
    error SoftcapNotReached();
    error SoftcapReached();
    error AlreadyWithdrawn();
    error NothingToRefund();
    error VestingInfoAlreadySet();
    error SaleNotStarted();

    /*
    0 -> does not have SALE_ADMIN_ROLE role
    1 -> not on whitelist 
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
    event withdrawn(
        uint256 withdrawnTokenToBeAccepted,
        uint256 withdrawnTokenToBeSold
    );
    event softCapAdminRefundAddressSet(address newSoftCapAdminRefundAddress);

    event userSoftcapRefundProcessed(address user, uint256 refundAmount);

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
        if (
            _hardcap == 0 ||
            _softcap == 0 ||
            _softcap >= _hardcap ||
            _salePrice == 0
        ) {
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

        softCapAdminRefundAddress = _msgSender();

        isSaleActive = true;

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

        if (_vestPeriod == 0 || _vestingLength == 0) {
            revert WrongVestingData();
        }

        if (vestingInfoSet) {
            revert VestingInfoAlreadySet();
        }

        lockupPlan = _lockUpPlan;
        cliffLength = _cliffLength;
        vestPeriod = _vestPeriod;
        vestingLength = _vestingLength;
        vestingInfoSet = true;
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

    function batchWhiteListRemove(address[] calldata unWhitelistedAddresses)
        public
    {
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

        if (block.timestamp >= endDate) {
            revert SaleHasEnded();
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

    function buy(uint256 tokenInputAmount) public nonReentrant {
        if (!isSaleActive) {
            revert SaleIsPaused();
        }

        if (block.timestamp < startDate) {
            revert SaleNotStarted();
        }

        if (block.timestamp > endDate) {
            revert SaleHasEnded();
        }

        if (tokenInputAmount == 0) {
            //no minimum purchase amount
            revert ZeroInputToken();
        }

        if (totalAmountInvested + tokenInputAmount > hardcap) {
            revert HardcapReached();
        }

        if (isPrivateSale && !isWhiteListed[msg.sender]) {
            revert Unauthorized(1);
        }

        uint256 amountPurchased = ((tokenInputAmount *
            (10**tokenToBeSold.decimals())) / salePrice);

        //tokens per period
        uint256 numPeriods = vestingLength / vestPeriod;
        uint256 tokensPerPeriod = amountPurchased / numPeriods;

        userAmountInvestedTotal[msg.sender] += tokenInputAmount;

        totalAmountInvested += tokenInputAmount;

        amountOfTokenSold += amountPurchased;

        //transfer input tokens to this contract
        tokenToBeAccepted.transferFrom(
            msg.sender,
            address(this),
            tokenInputAmount
        );

        //approve move to lockup
        tokenToBeSold.approve(address(lockupPlan), amountPurchased);
        uint256 newPlanId = lockupPlan.createPlan(
            msg.sender,
            address(tokenToBeSold),
            amountPurchased,
            block.timestamp,
            block.timestamp + cliffLength,
            tokensPerPeriod,
            vestPeriod
        );

        //we need the plan id for this,
        // this is why this is here and not before, 
        //but thankfully we're using the re-entrancy guard.
        userAmountInvestedPerPlan[msg.sender][newPlanId] = tokenInputAmount;
    }

    function withdrawAll(address withdrawAddress) public nonReentrant {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }

        if (block.timestamp < endDate) {
            revert SaleHasNotEnded();
        }

        if (hasBeenWithdrawn) {
            revert AlreadyWithdrawn();
        }

        if (totalAmountInvested < softCap) {
            revert SoftcapNotReached();
        }

        hasBeenWithdrawn = true;

        //transfer all the proceeds of the sale.
        tokenToBeAccepted.transfer(withdrawAddress, totalAmountInvested);
        //transfer all the unsold tokens.
        uint256 unsoldBalance = tokenToBeSold.balanceOf(address(this));
        tokenToBeSold.transfer(withdrawAddress, unsoldBalance);

        emit withdrawn(totalAmountInvested, unsoldBalance);
    }

    function setSoftCapAdminRefundAddress(address newSoftCapAdminRefundAddress)
        public
    {
        if (!hasRole(SALE_ADMIN_ROLE, _msgSender())) {
            revert Unauthorized(0);
        }

        if (newSoftCapAdminRefundAddress == address(0)) {
            revert ZeroAddress();
        }

        if (hasBeenWithdrawn) {
            revert AlreadyWithdrawn();
        }

        softCapAdminRefundAddress = newSoftCapAdminRefundAddress;

        emit softCapAdminRefundAddressSet(softCapAdminRefundAddress);
    }

    function refund(uint256 planId) public nonReentrant {
        //the sale needs to be over
        if (block.timestamp < endDate) {
            revert SaleHasNotEnded();
        }
        //the amount invested needs to be lower than the soft cap
        if (totalAmountInvested >= softCap) {
            revert SoftcapReached();
        }

        if (userAmountInvestedPerPlan[msg.sender][planId] == 0) {
            revert NothingToRefund();
        }

        uint256 refundAmount = userAmountInvestedPerPlan[msg.sender][planId];

        //set the amount that the user has invested, in this plan, to 0
        userAmountInvestedPerPlan[msg.sender][planId] = 0;

        //lower the user total amount invested over all plans
        userAmountInvestedTotal[msg.sender] -= refundAmount;

        //return the amount that the user has invested
        tokenToBeAccepted.transfer(msg.sender, refundAmount);

        //send plan to admin (This needs a pre-approval so the token can be moved)
        lockupPlan.safeTransferFrom(
            msg.sender,
            softCapAdminRefundAddress,
            planId
        );

        //emit events
        emit userSoftcapRefundProcessed(msg.sender, refundAmount);
    }

    function batchRefund(uint256[] calldata planIds) public nonReentrant {
        for (uint256 i = 0; i < planIds.length; i++) {
            refund(i);
        }
    }
}
