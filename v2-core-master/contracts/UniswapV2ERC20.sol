t Transfer event from zero address (minting)
    }

    // Internal function to burn tokens
    function _burn(address from, uint value) internal {
        balanceOf[from] = balanceOf[from].sub(value); // Decrease sender's balance
        totalSupply = totalSupply.sub(value); // Decrease total supply
        emit Transfer(from, address(0), value); // Emit Transfer event to zero address (burning)
    }

    // Internal function to approve spender to spend owner's tokens
    function _approve(address owner, address spender, uint value) private {
        allowance[owner][spender] = value; // Set allowance
        emit Approval(owner, spender, value); // Emit Approval event
    }

    // Internal function to transfer tokens from one address to another
    function _transfer(address from, address to, uint value) private {
        balanceOf[from] = balanceOf[from].sub(value); // Deduct from sender
        balanceOf[to] = balanceOf[to].add(value); // Add to recipient
        emit Transfer(from, to, value); // Emit Transfer event
    }

    // Public function: approve spender to spend tokens on behalf of msg.sender
    function approve(address spender, uint value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    // Public function: transfer tokens to another address
    function transfer(address to, uint value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    // Public function: transfer tokens on behalf of another address
    function transferFrom(address from, address to, uint value) external returns (bool) {
        // If allowance isn't max uint, reduce it by value
        if (allowance[from][msg.sender] != uint(-1)) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    // Permit function allows approving allowances via signatures (EIP-2612)
    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, 'UniswapV2: EXPIRED'); // Check deadline

        // Create the digest for EIP-712 signature verification
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    nonces[owner]++, // Use current nonce and increment
                    deadline
                ))
            )
        );

        // Recover the signer from the signature
        address recoveredAddress = ecrecover(digest, v, r, s);

        // Validate recovered address
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'UniswapV2: INVALID_SIGNATURE');

        // Approve allowance
        _approve(owner, spender, value);
    }
}

