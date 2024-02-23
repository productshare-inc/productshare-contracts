/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

contract StakeShare is
    Initializable,
    ERC20Upgradeable,
    AccessControlEnumerableUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20VotesUpgradeable
{
    function initialize(string memory name, string memory symbol)
        public
        virtual
        initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Votes_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _grantRole(MINTER_ROLE, _msgSender());
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE = keccak256("BLACKLISTER_ROLE");

    error CannotTransferWhenBlacklisted(address blacklisted);

    error DoesNotHaveMinterRole(address user);
    error DoesNotHaveBlacklisterRole(address user);

    error ZeroAddress();

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._update(from, to, value);
    }

    /**
     * @dev Creates `amount` new tokens for `to`.
     *
     * See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) public virtual {
        if (!hasRole(MINTER_ROLE, _msgSender())) {
            revert DoesNotHaveMinterRole(_msgSender());
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }
        _mint(to, amount);
    }
}
