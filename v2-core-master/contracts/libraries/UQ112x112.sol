pragma solidity =0.5.16;

// A library for handling binary fixed point numbers in Q112.112 format
// Reference: https://en.wikipedia.org/wiki/Q_(number_format)
//
// Range: [0, 2**112 - 1]
// Resolution: 1 / 2**112
//
// This format allows encoding of fractional numbers with very high precision.

library UQ112x112 {
    // The scaling factor for Q112.112 fixed point representation.
    // Multiplying by Q112 shifts the integer into fixed-point form.
    uint224 constant Q112 = 2**112;

    /**
     * @dev Encodes a uint112 integer into a UQ112x112 fixed-point number.
     *      This is done by multiplying the integer with the scaling factor Q112.
     *      Example: 5 -> 5 * 2^112
     * @param y The unsigned integer (up to 112 bits) to be encoded.
     * @return z The encoded fixed-point number in Q112.112 format.
     */
    function encode(uint112 y) internal pure returns (uint224 z) {
        // Convert the input into uint224 explicitly to avoid overflow during multiplication
        uint224 temp = uint224(y);

        // Multiply by the scaling factor Q112 to encode
        uint224 result = temp * Q112;

        // Assign the result to the output variable
        z = result;

        // Sanity check: result should always be >= input
        // (except when input = 0, then both are zero)
        require(z >= temp, "UQ112x112: encode overflow");
    }

    /**
     * @dev Divides a UQ112x112 fixed-point number by a uint112 integer.
     *      Returns another UQ112x112 fixed-point number as the result.
     *      Example: (10 * 2^112) / 2 -> (5 * 2^112)
     * @param x The dividend in UQ112x112 format.
     * @param y The divisor as a uint112 integer (must not be zero).
     * @return z The result of the division in UQ112x112 format.
     */
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        // Prevent division by zero
        require(y != 0, "UQ112x112: divide by zero");

        // Explicitly cast divisor to uint224 for safe division
        uint224 divisor = uint224(y);

        // Perform the division operation
        uint224 result = x / divisor;

        // Assign the result to the output variable
        z = result;

        // Sanity check: result should never exceed original value (since divisor >= 1)
        require(z <= x, "UQ112x112: uqdiv invalid result");
    }
}

