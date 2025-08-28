pragma solidity =0.5.16;

// -----------------------------------------------------------------------------
// Import required interfaces and libraries
// -----------------------------------------------------------------------------
import "./interfaces/IUniswapV2ERC20.sol";  // ERC20 interface with permit functionality
import "./libraries/SafeMath.sol";          // SafeMath library for secure arithmetic

// -----------------------------------------------------------------------------
// UniswapV2ERC20
// -----------------------------------------------------------------------------
// Implements an ERC20-compatible token that also includes support for EIP-2612
// "permit" functionality (gasless approvals via signatures).
// -----------------------------------------------------------------------------
contract UniswapV2ERC20 is IUniswapV2ERC20 {
    using SafeMath for uint;

    // -------------------------------------------------------------------------
    // Token Metadata
    // -------------------------------------------------------------------------
    string public constant name = "Uniswap V2";  // Token name
    string public constant symbol = "UNI-V2";    // Token symbol
    uint8 public constant decimals = 18;         // Number of decimal places

    // -------------------------------------------------------------------------
    // ERC20 State Variables
    // -------------------------------------------------------------------------
    uint public totalSupply; // Tracks total supply of tokens in existence

    // Mapping from account addresses to their balances
    mapping(address => uint) public balanceOf;

    // Mapping for allowances: owner => (spender => allowance)
    mapping(address => mapping(address => uint)) public allowance;

    // -------------------------------------------------------------------------
    // EIP-2612 State Variables
    // -------------------------------------------------------------------------
    // Domain separator for EIP-712 encoding
    bytes32 public DOMAIN_SEPARATOR;

    // Pre-computed typehash for permit function
    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    // Mapping of nonces for each address (to prevent replay attacks)
    mapping(address => uint) public nonces;

    // -------------------------------------------------------------------------
    // ERC20 Events
    // -------------------------------------------------------------------------
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() public {
        uint chainId;

        // Retrieve current chain ID using inline assembly
        assembly {
            chainId := chainid
        }

        // Build and assign the EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // EIP-712 domain typehash
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),         // Hash of token name
                keccak256(bytes("1")),          // Version fixed as "1"
                chainId,                        // Current chain ID
                address(this)                   // This contract’s address
            )
        );
    }

    // -------------------------------------------------------------------------
    // Internal Mint Function
    // -------------------------------------------------------------------------
    function _mint(address to, uint value) internal {
        // Increase total supply
        totalSupply = totalSupply.add(value);

        // Increase recipient’s balance
        balanceOf[to] = balanceOf[to].add(value);

        // Emit standard ERC20 Transfer event (from zero address = mint)
        emit Transfer(address(0), to, value);
    }

    // -------------------------------------------------------------------------
    // Internal Burn Function
    // -------------------------------------------------------------------------
    function _burn(address from, uint value) internal {
        // Subtract tokens from sender’s balance
        balanceOf[from] = balanceOf[from].sub(value);

        // Reduce total supply
        totalSupply = totalSupply.sub(value);

        // Emit standard ERC20 Transfer event (to zero address = burn)
        emit Transfer(from, address(0), value);
    }

    // -------------------------------------------------------------------------
    // Internal Approve Function
    // -------------------------------------------------------------------------
    function _approve(address owner, address spender, uint value) private {
        // Assign allowance
        allowance[owner][spender] = value;

        // Emit standard Approval event
        emit Approval(owner, spender, value);
    }

    // -------------------------------------------------------------------------
    // Internal Transfer Function
    // -------------------------------------------------------------------------
    function _transfer(address from, address to, uint value) private {
        // Deduct tokens from sender
        balanceOf[from] = balanceOf[from].sub(value);

        // Add tokens to recipient
        balanceOf[to] = balanceOf[to].add(value);

        // Emit standard Transfer event
        emit Transfer(from, to, value);
    }

    // -------------------------------------------------------------------------
    // ERC20 Public Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Approve a spender to spend tokens on behalf of msg.sender
     */
    function approve(address spender, uint value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Transfer tokens from msg.sender to a recipient
     */
    function transfer(address to, uint value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @notice Transfer tokens from one account to another using allowance
     */
    function transferFrom(address from, address to, uint value)
        external
        returns (bool)
    {
        uint currentAllowance = allowance[from][msg.sender];

        // If allowance is not set to max uint, decrease by transfer amount
        if (currentAllowance != uint(-1)) {
            allowance[from][msg.sender] = currentAllowance.sub(value);
        }

        // Perform the transfer
        _transfer(from, to, value);
        return true;
    }

    // -------------------------------------------------------------------------
    // EIP-2612 Permit Function
    // -------------------------------------------------------------------------
    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Check that the deadline has not passed
        require(deadline >= block.timestamp, "UniswapV2: EXPIRED");

        // Build digest for EIP-712 signature
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",                // Prefix per EIP-191
                DOMAIN_SEPARATOR,          // EIP-712 domain separator
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,   // Typehash for permit
                        owner,             // Token owner
                        spender,           // Spender
                        value,             // Allowance value
                        nonces[owner]++,   // Nonce (used once)
                        deadline           // Expiry timestamp
                    )
                )
            )
        );

        // Recover signer’s address
        address recoveredAddress = ecrecover(digest, v, r, s);

        // Verify validity of recovered address
        require(
            recoveredAddress != address(0) && recoveredAddress == owner,
            "UniswapV2: INVALID_SIGNATURE"
        );

        // Approve the spender
        _approve(owner, spender, value);
    }
}
