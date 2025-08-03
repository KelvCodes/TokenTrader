// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

/**
 * @title IERC20
 * @dev Interface for the standard ERC20 token as defined in the Ethereum Improvement Proposal (EIP-20).
 * This interface defines the core functionality and events required for any ERC20-compliant token.
 */
interface IERC20 {
    // ---------------------------------------------------------
    // Events
    // ---------------------------------------------------------

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set via {approve}.
     *      `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint value);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to another (`to`).
     *      Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint value);

    // ---------------------------------------------------------
    // Read-Only Functions
    // ---------------------------------------------------------

    /**
     * @dev Returns the name of the token (e.g., "Dai Stablecoin").
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token (e.g., "DAI").
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the number of decimals the token uses (e.g., 18 means token amounts are divisible by 10^18).
     */
    function decimals() external view returns (uint8);

    /**
     * @dev Returns the total number of tokens in existence.
     */
    function totalSupply() external view returns (uint);

    /**
     * @dev Returns the account balance of the given address.
     * @param owner Address to query the balance of.
     */
    function balanceOf(address owner) external view returns (uint);

    /**
     * @dev Returns the remaining number of tokens that `spender` is allowed to spend
     *      on behalf of `owner` via {transferFrom}. This is zero by default.
     */
    function allowance(address owner, address spender) external view returns (uint);

    // ---------------------------------------------------------
    // State-Changing Functions
    // ---------------------------------------------------------

    /**
     * @dev Approves the passed address to spend the specified amount of tokens on behalf of the message sender.
     * @param spender Address authorized to spend.
     * @param value Amount of tokens to be approved.
     * @return true if the operation is successful.
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint value) external returns (bool);

    /**
     * @dev Transfers `value` tokens to address `to`.
     * @param to Recipient address.
     * @param value Amount of tokens to transfer.
     * @return true if the operation is successful.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint value) external returns (bool);

    /**
     * @dev Transfers `value` tokens from address `from` to address `to` using the allowance mechanism.
     *      `value` is then deducted from the caller’s allowance.
     * @param from Address to send tokens from.
     * @param to Address to send tokens to.
     * @param value Amount of tokens to transfer.
     * @return true if the operation is successful.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint value) external returns (bool);
}

