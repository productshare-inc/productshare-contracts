/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract ShareCash is
    Initializable,
    ERC20Upgradeable,
    AccessControlEnumerableUpgradeable,
    PausableUpgradeable,
    ERC20BurnableUpgradeable
{
    function initialize(string memory name, string memory symbol)
        public
        virtual
        initializer
    {
        __ERC20_init(name, symbol);
        __Pausable_init_unchained();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _grantRole(MINTER_ROLE, _msgSender());
        _grantRole(PAUSER_ROLE, _msgSender());
        _grantRole(BLACKLISTER_ROLE, _msgSender());
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE = keccak256("BLACKLISTER_ROLE");

    error CannotTransferWhenPaused();
    error CannotTransferWhenBlacklisted(address blacklisted);

    error DoesNotHaveMinterRole(address user);
    error DoesNotHavePauserRole(address user);
    error DoesNotHaveBlacklisterRole(address user);

    error ZeroAddress();

    mapping(address => bool) public blacklisted;

    event blacklistStatusChanged(
        address modifiedAddress,
        bool blacklistedStatus
    );

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        super._update(from, to, value);
        if (paused()) {
            revert CannotTransferWhenPaused();
        }
        if (blacklisted[from]) {
            revert CannotTransferWhenBlacklisted(from);
        }
        if (blacklisted[to]) {
            revert CannotTransferWhenBlacklisted(to);
        }
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

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual {
        if (!hasRole(PAUSER_ROLE, _msgSender())) {
            revert DoesNotHavePauserRole(_msgSender());
        }
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function unpause() public virtual {
        if (!hasRole(PAUSER_ROLE, _msgSender())) {
            revert DoesNotHavePauserRole(_msgSender());
        }
        _unpause();
    }

    function modifyblacklistedStatus(address toModify, bool blacklistedStatus)
        public
    {
        if (!hasRole(BLACKLISTER_ROLE, _msgSender())) {
            revert DoesNotHaveBlacklisterRole(_msgSender());
        }
        if (toModify == address(0)) {
            revert ZeroAddress();
        }
        blacklisted[toModify] = blacklistedStatus;
        emit blacklistStatusChanged(toModify, blacklistedStatus);
    }
}
