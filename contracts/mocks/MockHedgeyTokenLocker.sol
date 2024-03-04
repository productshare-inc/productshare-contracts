// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MockHedgeyTokenLocker is Initializable{
    event planCreated(
        address recipient,
        address token,
        uint256 amount,
        uint256 start,
        uint256 cliff,
        uint256 rate,
        uint256 period
    );
    event transfer(
        address from,
        address to,
        uint256 tokenId
    );

    function createPlan(
        address recipient,
        address token,
        uint256 amount,
        uint256 start,
        uint256 cliff,
        uint256 rate,
        uint256 period
    ) external returns (uint256){
        emit planCreated(recipient,token,amount,start,cliff,rate,period);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external{
        emit transfer(from,to,tokenId);
    }

}



