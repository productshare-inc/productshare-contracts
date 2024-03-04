/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract MockStableCoin is
    Initializable,
    ERC20Upgradeable
{
    function initialize(string memory name, string memory symbol)
        public
        virtual
        initializer
    {
        __ERC20_init(name, symbol);

    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }


    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }

}
