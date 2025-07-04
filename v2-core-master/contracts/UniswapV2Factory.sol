
// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

import './interfaces/IUniswapV2Factory.sol';  // Interface declaration
import './UniswapV2Pair.sol';                // Pair contract to deploy

/**
 * @title UniswapV2Factory
 * @notice Factory contract to create and track UniswapV2Pair contracts for token pairs
 */
contract UniswapV2Factory is IUniswapV2Factory {
    /// @notice Address to which protocol fees are sent
    address public feeTo;

    /// @notice Address allowed to update feeTo and feeToSetter
    address public feeToSetter;

    /// @notice Maps two token addresses to the address of their corresponding pair contract
    mapping(address => mapping(address => address)) public getPair;

    /// @notice List of all pair contract addresses created by this factory
    address[] public allPairs;

    /// @notice Emitted when a new pair is created
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    /**
     * @dev Initializes the factory with the feeToSetter address
     * @param _feeToSetter Address with permission to update feeTo and feeToSetter
     */
    constructor(address _feeToSetter) public {
        feeToSetter = _feeToSetter;
    }

    /**
     * @notice Returns the number of pairs created so far
     * @return The total number of pair contracts
     */
    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    /**
     * @notice Creates a new pair contract for tokenA and tokenB
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return pair Address of the newly created pair contract
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES'); // Tokens must be different

        // Sort token addresses to ensure uniqueness (token0 < token1)
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS'); // Prevent creating pair with zero address

        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // Pair must not already exist

        bytes memory bytecode = type(UniswapV2Pair).creationCode; // Get the bytecode to deploy UniswapV2Pair
        bytes32 salt = keccak256(abi.encodePacked(token0, token1)); // Unique salt for create2

        // Deploy new pair contract using create2 for deterministic address
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        // Initialize the newly created pair contract with the two tokens
        IUniswapV2Pair(pair).initialize(token0, token1);

        // Store pair address in mapping (both token0/token1 and token1/token0 for easy lookup)
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;

        // Add the new pair to the list of all pairs
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    /**
     * @notice Updates the address to which protocol fees are sent
     * @param _feeTo New feeTo address
     */
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN'); // Only feeToSetter can call
        feeTo = _feeTo;
    }

    /**
     * @notice Updates the address allowed to set feeTo and feeToSetter
     * @param _feeToSetter New feeToSetter address
     */
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN'); // Only current feeToSetter can call
        feeToSetter = _feeToSetter;
    }
}
