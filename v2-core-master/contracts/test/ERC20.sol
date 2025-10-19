// SPDX-License-Identifier: MIT
pragma solidity =0.5.16;

// -----------------------------------------------------------
// Import the UniswapV2ERC20 contract, which provides
// standard ERC20 token functionality such as transfer,
// approval, allowance, and balance tracking.
// -----------------------------------------------------------
import '../UniswapV2ERC20.sol';

// -----------------------------------------------------------
// ERC20 Contract
// -----------------------------------------------------------
// This contract extends UniswapV2ERC20 to create a standard
// ERC20 token with a specified total supply minted to the
// deployer upon contract creation.
// -----------------------------------------------------------
contract ERC20 is UniswapV2ERC20 {

    // -------------------------------------------------------
    // Constructor
    // -------------------------------------------------------
    // @param _totalSupply: The total number of tokens to mint.
    //
    // When the contract is deployed, this constructor mints
    // the entire token supply to the deployer's (msg.sender)
    // wallet address.
    // -------------------------------------------------------
    constructor(uint _totalSupply) public {
        // Mint the specified total supply of tokens to the deployer
        _mint(msg.sender, _totalSupply);
    }
}

