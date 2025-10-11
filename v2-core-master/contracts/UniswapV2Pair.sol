pragma solidity =0.5.16;

/*  
 *  Uniswap V2 Pair Contract
 *  ----------------------------------------------------------
 *  This contract represents a liquidity pair in the Uniswap V2 AMM.
 *  It handles liquidity provision (minting LP tokens), removal (burning LP tokens),
 *  and swaps between token0 and token1, maintaining the invariant:
 *        reserve0 * reserve1 = constant (after fees)
 *  
 *  Key functionalities:
 *    - Mint & Burn (liquidity management)
 *    - Swap (token trades)
 *    - Sync & Skim (reserve management)
 *    - Fee-on transfer logic
 *  
 *  Based on: Uniswap V2 Core
 *  ----------------------------------------------------------
 */

// Importing interfaces and utility libraries
import './interfaces/IUniswapV2Pair.sol';
import './UniswapV2ERC20.sol';
import './libraries/Math.sol';
import './libraries/UQ112x112.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Callee.sol';

// ----------------------------------------------------------
// Main Pair Contract
// ----------------------------------------------------------
contract UniswapV2Pair is IUniswapV2Pair, UniswapV2ERC20 {
    using SafeMath for uint;
    using UQ112x112 for uint224;

    // ------------------------------------------------------
    // Constants
    // ------------------------------------------------------

    // Minimum liquidity that is permanently locked (burned)
    uint public constant MINIMUM_LIQUIDITY = 10**3;

    // Selector for ERC20 transfer calls
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    // ------------------------------------------------------
    // Pair State Variables
    // ------------------------------------------------------

    address public factory;      // Factory address (creates pairs)
    address public token0;       // Address of token0
    address public token1;       // Address of token1

    uint112 private reserve0;    // Reserve of token0
    uint112 private reserve1;    // Reserve of token1
    uint32  private blockTimestampLast; // Timestamp of last update

    // Cumulative price data (for TWAP calculations)
    uint public price0CumulativeLast;
    uint public price1CumulativeLast;
    uint public kLast; // product of reserves after last liquidity event

    // ------------------------------------------------------
    // Reentrancy Guard
    // ------------------------------------------------------
    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'UniswapV2: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    // ------------------------------------------------------
    // Events
    // ------------------------------------------------------
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender, 
        uint amount0In, 
        uint amount1In, 
        uint amount0Out, 
        uint amount1Out, 
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    // ------------------------------------------------------
    // Constructor
    // ------------------------------------------------------
    constructor() public {
        factory = msg.sender; // Factory deploys the pair
    }

    // ------------------------------------------------------
    // Initialization
    // ------------------------------------------------------
    // Called once by the factory to set the pair's tokens
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, 'UniswapV2: FORBIDDEN');
        token0 = _token0;
        token1 = _token1;
    }

    // ------------------------------------------------------
    // Getters
    // ------------------------------------------------------
    // Returns the current reserves and timestamp
    function getReserves() 
        public 
        view 
        returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) 
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    // ------------------------------------------------------
    // Internal Utility: Safe ERC20 Transfer
    // ------------------------------------------------------
    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(SELECTOR, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'UniswapV2: TRANSFER_FAILED');
    }

    // ------------------------------------------------------
    // Internal Function: Update Reserves & Price Data
    // ------------------------------------------------------
    function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'UniswapV2: OVERFLOW');

        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;

        // Update cumulative prices if time has passed and reserves are non-zero
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }

        // Update reserves and timestamp
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    // ------------------------------------------------------
    // Internal Function: Mint Protocol Fees (if enabled)
    // ------------------------------------------------------
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        address feeTo = IUniswapV2Factory(factory).feeTo(); // Fee collector
        feeOn = feeTo != address(0);
        uint _kLast = kLast;

        if (feeOn) {
            // If previous liquidity exists, mint fee proportional to growth
            if (_kLast != 0) {
                uint rootK = Math.sqrt(uint(_reserve0).mul(_reserve1));
                uint rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint numerator = totalSupply.mul(rootK.sub(rootKLast));
                    uint denominator = rootK.mul(5).add(rootKLast);
                    uint liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0; // reset if no fee
        }
    }

    // ------------------------------------------------------
    // Mint Liquidity
    // ------------------------------------------------------
    // Called when users add liquidity to the pool.
    function mint(address to) external lock returns (uint liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();

        // Get current token balances
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));

        // Amounts added by the user
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply;

        // Calculate liquidity tokens to mint
        if (_totalSupply == 0) {
            // Initial liquidity (geometric mean)
            liquidity = Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // Lock minimum
        } else {
            liquidity = Math.min(
                amount0.mul(_totalSupply) / _reserve0, 
                amount1.mul(_totalSupply) / _reserve1
            );
        }

        require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        // Update reserves
        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0).mul(reserve1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // ------------------------------------------------------
    // Burn Liquidity
    // ------------------------------------------------------
    // Called when users remove liquidity from the pool.
    function burn(address to) external lock returns (uint amount0, uint amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = token0;
        address _token1 = token1;

        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply;

        // Calculate how much of each token to return
        amount0 = liquidity.mul(balance0) / _totalSupply;
        amount1 = liquidity.mul(balance1) / _totalSupply;

        require(amount0 > 0 && amount1 > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED');

        // Burn LP tokens and transfer assets back
        _burn(address(this), liquidity);
        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);

        // Update reserves
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        _update(balance0, balance1, _reserve0, _reserve1);

        if (feeOn) kLast = uint(reserve0).mul(reserve1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // ------------------------------------------------------
    // Swap Tokens
    // ------------------------------------------------------
    // Executes swaps between token0 and token1 while maintaining the invariant.
    // Supports flash swaps through `IUniswapV2Callee`.
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;

        {
            // Perform the swap
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');

            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out);
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out);

            // Optional callback for flash swaps
            if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(
                msg.sender, amount0Out, amount1Out, data
            );

            // Check balances after swap
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }

        // Calculate amounts coming in
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;

        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');

        // Adjust balances for 0.3% fee and invariant check
        {
            uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
            uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
            require(
                balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(1000**2),
                'UniswapV2: K'
            );
        }

        // Update reserves
        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // ------------------------------------------------------
    // Skim Excess Tokens
    // ------------------------------------------------------
    // Sends any extra tokens (non-reserve) to `to`
    function skim(address to) external lock {
        address _token0 = token0;
        address _token1 = token1;
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)).sub(reserve0));
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)).sub(reserve1));
    }

    // ------------------------------------------------------
    // Force Reserve Sync
    // ------------------------------------------------------
    // Manually updates the reserves to match contract balances
    function sync() external lock {
        _update(
            IERC20(token0).balanceOf(address(this)), 
            IERC20(token1).balanceOf(address(this)), 
            reserve0, 
            reserve1
        );
    }
}

