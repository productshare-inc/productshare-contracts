/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ITOKEN {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    // ERC20 Standard Functions
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function decimals() external returns (uint256);

    // Custom Functions specific to StakeShare
    function initialize(string memory name, string memory symbol) external;

    function mint(address to, uint256 amount) external;

    function hasRole(bytes32 role, address account)
        external
        view
        returns (bool);

    // Include common roles if they're part of your interface's public functions
    function MINTER_ROLE() external view returns (bytes32);

    function PAUSER_ROLE() external view returns (bytes32);

    function BLACKLISTER_ROLE() external view returns (bytes32);

    // Custom Errors
    error CannotTransferWhenBlacklisted(address blacklisted);
    error DoesNotHaveMinterRole(address user);
    error DoesNotHaveBlacklisterRole(address user);
    error ZeroAddress();
}
