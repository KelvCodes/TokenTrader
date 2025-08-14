pragma solidity =0.5.16;

/**
 * @title SafeMath
 * @dev Arithmetic operations with safety checks to prevent overflow/underflow.
 *      Based on DappHub's DS-Math library: https://github.com/dapphub/ds-math
 *
 *      Since Solidity 0.5.x does not have built-in overflow checks (unlike 0.8+),
 *      we use `require` statements to revert the transaction when unsafe operations occur.
 */
library SafeMath {

    /**
     * @notice Safely adds two unsigned integers.
     * @dev Reverts if the result overflows (i.e., exceeds the maximum uint value).
     * @param x First operand.
     * @param y Second operand.
     * @return z The sum of x and y.
     */
    function add(uint x, uint y) internal pure returns (uint z) {
        // Perform addition and assign to z
        z = x + y;
        // Overflow check: result must be >= first operand
        require(z >= x, 'ds-math-add-overflow');
    }

    /**
     * @notice Safely subtracts one unsigned integer from another.
     * @dev Reverts if subtraction results in a negative number (underflow).
     * @param x First operand (minuend).
     * @param y Second operand (subtrahend).
     * @return z The result of x - y.
     */
    function sub(uint x, uint y) internal pure returns (uint z) {
        // Perform subtraction and assign to z
        z = x - y;
        // Underflow check: result must be <= first operand
        require(z <= x, 'ds-math-sub-underflow');
    }

    /**
     * @notice Safely multiplies two unsigned integers.
     * @dev Reverts if multiplication overflows.
     *      Special case: multiplication by 0 is always safe.
     * @param x First operand.
     * @param y Second operand.
     * @return z The product of x and y.
     */
    function mul(uint x, uint y) internal pure returns (uint z) {
        // Multiplication by zero is safe and always results in 0
        if (y == 0) return 0;
        // Perform multiplication and assign to z
        z = x * y;
        // Overflow check: dividing the result by y must yield the original x
        require(z / y == x, 'ds-math-mul-overflow');
    }
}

