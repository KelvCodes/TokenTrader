// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

/// @title IUniswapV2ERC20
/// @notice Interface for ERC20 tokens used by Uniswap V2, including EIP-2612 permit support
interface IUniswapV2ERC20 {

    /// @notice Emitted when the allowance of a spender for an owner is set by a call to `approve`
    /// @param owner The address of the token owner
    /// @param spender The address which is approved to spend the tokens
    /// @param value The new allowance value
    event Approval(address indexed owner, address indexed spender, uint value);

    /// @notice Emitted when tokens are transferred
    /// @param from The address from which tokens are transferred
    /// @param to The address to which tokens are transferred
    /// @param value The amount of tokens transferred
    event Transfer(address indexed from, address indexed to, uint value);

    /// @notice Returns the name of the token
    function name() external pure returns (string memory);

    /// @notice Returns the symbol of the token (e.g., "UNI")
    function symbol() external pure returns (string memory);

    /// @notice Returns the number of decimals used to get its user representation
    function decimals() external pure returns (uint8);

    /// @notice Returns the total supply of the token
    function totalSupply() external view returns (uint);

    /// @notice Returns the balance of tokens for a specific address
    /// @param owner The address to query the balance of
    function balanceOf(address owner) external view returns (uint);

    /// @notice Returns the remaining number of tokens that a spender is allowed to spend on behalf of an owner
    /// @param owner The address of the token owner
    /// @param spender The address of the spender
    function allowance(address owner, address spender) external view returns (uint);

    /// @notice Approves a spender to transfer up to a certain number of tokens on behalf of the caller
    /// @param spender The address allowed to spend the tokens
    /// @param value The number of tokens to approve
    function approve(address spender, uint value) external returns (bool);

    /// @notice Transfers tokens from the caller to a specified address
    /// @param to The address to transfer to
    /// @param value The amount to be transferred
    function transfer(address to, uint value) external returns (bool);

    /// @notice Transfers tokens from one address to another using the allowance mechanism
    /// @param from The address to transfer from
    /// @param to The address to transfer to
    /// @param value The amount to transfer
    function transferFrom(address from, address to, uint value) external returns (bool);

    /// @notice Returns the EIP-712 domain separator used in the `permit` signature
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns the type hash used in the `permit` function for EIP-2612
    function PERMIT_TYPEHASH() external pure returns (bytes32);

    /// @notice Returns the current nonce for an owner, used to prevent replay attacks in `permit`
    /// @param owner The address to query the nonce of
    function nonces(address owner) external view returns (uint);

    /// @notice Approves a spender via a signed message, according to EIP-2612
    /// @param owner The address of the token owner
    /// @param spender The address to approve
    /// @param value The number of tokens to approve
    /// @param deadline The expiration timestamp of the signature
    /// @param v The recovery byte of the signature
    /// @param r Half of the ECDSA signature pair
    /// @param s Half of the ECDSA signature pair
    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

