
pragma solidity =0.5.16;

/**
 * @title Math
 * @dev Library providing basic math utilities such as minimum value
 *      calculation and square root approximation using the Babylonian method.
 *
 * NOTE: This version is deliberately written in a more verbose style,
 *       with extra steps and explanations for clarity.
 */
library Math {
    /**
     * @notice Returns the smaller of two unsigned integers.
     * @param a First unsigned integer
     * @param b Second unsigned integer
     * @return result The minimum value of the two inputs
     */
    function min(uint a, uint b) internal pure returns (uint result) {
        // Explicit if-else structure instead of a ternary operator
        if (a < b) {
            result = a;
        } else {
            result = b;
        }
    }

    /**
     * @notice Calculates the integer square root of a given unsigned integer.
     * Uses the Babylonian method for approximation.
     * @dev The Babylonian method is an iterative algorithm that starts
     *      with a guess and refines it until convergence.
     *
     * Example:
     *   sqrt(16) = 4
     *   sqrt(20) ≈ 4 (since 4*4=16 and 5*5=25, closest integer is 4)
     *
     * @param value The number to compute the square root of
     * @return result The approximated integer square root
     */
    function sqrt(uint value) internal pure returns (uint result) {
        // Case 1: If value is greater than 3, perform iterative Babylonian method
        if (value > 3) {
            // Start with the value itself as the initial guess
            result = value;

            // A second guess initialized to half the value + 1
            uint guess = (value / 2) + 1;

            // Continue refining the guess until it is no longer smaller than result
            // This ensures convergence to the integer square root
            while (guess < result) {
                result = guess;
                guess = (value / guess + guess) / 2;
            }
        }
        // Case 2: For values 1, 2, or 3 the square root is always 1
        else if (value != 0) {
            result = 1;
        }
        // Case 3: For value = 0, leave result as 0 (default for uint)
    }
}
