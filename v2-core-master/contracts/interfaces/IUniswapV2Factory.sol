// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

/// @title IUniswapV2Factory Interface
/// @notice Interface for the Uniswap V2 Factory contract
/// @dev This contract is responsible for creating and managing all trading pairs (liquidity pools) in Uniswap V2
interface IUniswapV2Factory {

    /// @notice Emitted whenever a new trading pair (liquidity pool) is created
    /// @param token0 Address of the first token in the pair
    /// @param token1 Address of the second token in the pair
    /// @param pair The address of the newly created pair (UniswapV2Pair contract)
    /// @param allPairsLength Total number of pairs after creation
    event PairCreated(address indexed token0, address indexed token1, address pair, uint allPairsLength);

    /// @notice Returns the current address where trading fees are sent
    /// @return The address that receives protocol fees
    function feeTo() external view returns (address);

    /// @notice Returns the address allowed to update the feeTo address
    /// @return The address with permission to set the fee recipient
    function feeToSetter() external view returns (address);

    /// @notice Returns the address of the trading pair for two given tokens
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return pair The address of the liquidity pool for tokenA and tokenB
    function getPair(address tokenA, address tokenB) external view returns (address pair);

    /// @notice Returns the address of a pair at a specific index
    /// @param index Index position in the allPairs array
    /// @return pair The address of the pair at that index
    function allPairs(uint index) external view returns (address pair);

    /// @notice Returns the total number of trading pairs created by the factory
    /// @return The length of the allPairs array
    function allPairsLength() external view returns (uint);

    /// @notice Creates a new trading pair (liquidity pool) between two tokens
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return pair Address of the newly created UniswapV2Pair contract
    function createPair(address tokenA, address tokenB) external returns (address pair);

    /// @notice Updates the address that receives protocol trading fees
    /// @param _feeTo The new address to receive trading fees
    function setFeeTo(address _feeTo) external;

    /// @notice Updates the address with permission to change the fee recipient
    /// @param _feeToSetter The new feeToSetter address
    function setFeeToSetter(address _feeToSetter) external;
}

