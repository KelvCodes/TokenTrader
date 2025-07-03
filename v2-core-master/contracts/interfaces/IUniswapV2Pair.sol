// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

/**
 * @title IUniswapV2Pair
 * @notice Interface for the Uniswap V2 Pair contract.
 * 
 * A pair contract manages a liquidity pool of two ERC20 tokens and handles swaps,
 * adding/removing liquidity, and keeps track of pricing data.
 */
interface IUniswapV2Pair {

    // --- ERC20 Events ---

    /// @notice Emitted when an approval is set via approve() or permit()
    event Approval(address indexed owner, address indexed spender, uint value);

    /// @notice Emitted when tokens are transferred (also during mint/burn)
    event Transfer(address indexed from, address indexed to, uint value);

    // --- ERC20 Metadata & Basic Functions ---

    /// @notice Returns the name of the liquidity token (e.g., "Uniswap V2")
    function name() external pure returns (string memory);

    /// @notice Returns the symbol of the liquidity token (e.g., "UNI-V2")
    function symbol() external pure returns (string memory);

    /// @notice Number of decimals used (always 18 for LP tokens)
    function decimals() external pure returns (uint8);

    /// @notice Total supply of LP tokens
    function totalSupply() external view returns (uint);

    /// @notice Returns the balance of LP tokens for a specific owner
    function balanceOf(address owner) external view returns (uint);

    /// @notice Returns how many tokens a spender is allowed to transfer on behalf of owner
    function allowance(address owner, address spender) external view returns (uint);

    /// @notice Approves spender to spend a specified amount of LP tokens
    function approve(address spender, uint value) external returns (bool);

    /// @notice Transfers LP tokens to another address
    function transfer(address to, uint value) external returns (bool);

    /// @notice Transfers LP tokens from one address to another (using allowance)
    function transferFrom(address from, address to, uint value) external returns (bool);

    // --- Permit (EIP-2612) ---

    /// @notice EIP-712 domain separator used for permit signatures
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Typehash used in permit signature
    function PERMIT_TYPEHASH() external pure returns (bytes32);

    /// @notice Tracks the number of permits used by each owner (prevents replay attacks)
    function nonces(address owner) external view returns (uint);

    /**
     * @notice Sets approval by signature, as defined in EIP-2612
     * @param owner The address granting approval
     * @param spender The address receiving approval
     * @param value Amount approved
     * @param deadline Expiry timestamp of the signature
     * @param v, r, s Components of the owner's signature
     */
    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    // --- Uniswap V2 Specific Events ---

    /// @notice Emitted when liquidity is added to the pool
    event Mint(address indexed sender, uint amount0, uint amount1);

    /// @notice Emitted when liquidity is removed from the pool
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);

    /**
     * @notice Emitted when a swap happens
     * @param sender The address that initiated the swap
     * @param amount0In Amount of token0 coming into the pool
     * @param amount1In Amount of token1 coming into the pool
     * @param amount0Out Amount of token0 sent out from the pool
     * @param amount1Out Amount of token1 sent out from the pool
     * @param to Recipient of output tokens
     */
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );

    /// @notice Emitted whenever reserves are updated via sync()
    event Sync(uint112 reserve0, uint112 reserve1);

    // --- Pool State & Info ---

    /// @notice The minimum liquidity locked forever (to prevent divide by zero)
    function MINIMUM_LIQUIDITY() external pure returns (uint);

    /// @notice Address of the factory that created this pair
    function factory() external view returns (address);

    /// @notice The first token in the pair
    function token0() external view returns (address);

    /// @notice The second token in the pair
    function token1() external view returns (address);

    /**
     * @notice Returns the pool's current reserves and the last updated block timestamp
     * @return reserve0 Amount of token0 in the pool
     * @return reserve1 Amount of token1 in the pool
     * @return blockTimestampLast Last block timestamp when reserves changed
     */
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );

    /// @notice Cumulative price of token0, used for TWAP calculations
    function price0CumulativeLast() external view returns (uint);

    /// @notice Cumulative price of token1, used for TWAP calculations
    function price1CumulativeLast() external view returns (uint);

    /// @notice Last value of reserve0 * reserve1 (helps track fees)
    function kLast() external view returns (uint);

    // --- Liquidity Management ---

    /**
     * @notice Adds liquidity to the pool and mints LP tokens to `to`
     * @param to Recipient of LP tokens
     * @return liquidity Amount of LP tokens minted
     */
    function mint(address to) external returns (uint liquidity);

    /**
     * @notice Removes liquidity from the pool and burns LP tokens
     * @param to Recipient of the withdrawn tokens
     * @return amount0 Amount of token0 withdrawn
     * @return amount1 Amount of token1 withdrawn
     */
    function burn(address to) external returns (uint amount0, uint amount1);

    /**
     * @notice Executes a swap from one token to another
     * @param amount0Out Amount of token0 to send out
     * @param amount1Out Amount of token1 to send out
     * @param to Recipient of output tokens
     * @param data Arbitrary data, used for flash swaps
     */
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to,
        bytes calldata data
    ) external;

    /**
     * @notice Transfers excess tokens (from fees, etc.) to `to`
     * @param to Recipient of the skimmed tokens
     */
    function skim(address to) external;

    /// @notice Syncs the stored reserves with the actual token balances in the contract
    function sync() external;

    
