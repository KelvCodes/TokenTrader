h library
import './interfaces/IUniswapV2ERC20.sol';
import './libraries/SafeMath.sol';

// UniswapV2ERC20 contract implements an ERC20 token with permit (EIP-2612) functionality
contract UniswapV2ERC20 is IUniswapV2ERC20 {
    using SafeMath for uint;

    // Token metadata
    string public constant name = 'Uniswap V2';
    string public constant symbol = 'UNI-V2';
    uint8 public constant decimals = 18;

    // Total token supply
    uint public totalSupply;

    // Mapping to track each account's balance
    mapping(address => uint) public balanceOf;

    // Mapping to track allowances: owner => (spender => amount)
    mapping(address => mapping(address => uint)) public allowance;

    // EIP-712 domain separator for permit signatures
    bytes32 public DOMAIN_SEPARATOR;

    // Hash of the permit structure used in EIP-712 encoding
    bytes32 public constant PERMIT_TYPEHASH = 
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    // Mapping to track nonces for permit (prevents replay attacks)
    mapping(address => uint) public nonces;

    // Events required by ERC20 standard
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    // Contract constructor sets up the domain separator for EIP-712 permit
    constructor() public {
        uint chainId;
        assembly {
            chainId := chainid
        }
        // Calculate and store DOMAIN_SEPARATOR according to EIP-712
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // Hash of domain schema
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                // Hash of contract name
                keccak256(bytes(name)),
                // Hash of version (fixed as '1')
                keccak256(bytes('1')),
                // Current chain ID
                chainId,
                // Address of this contract
                address(this)
            )
        );
    }

    // Internal function to mint new tokens
    function _mint(address to, uint value) internal {
        totalSupply = totalSupply.add(value); // Increase total supply
        balanceOf[to] = balanceOf[to].add(value); // Increase recipient's balance
        emit Transfer(address(0), to, value); // Emit Transfer event from zero address (minting)
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

