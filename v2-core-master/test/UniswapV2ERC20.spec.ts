// ------------------------------------------------------
// Import Required Libraries
// ------------------------------------------------------

// Chai assertion library + Ethers.js Contract type
import chai, { expect } from 'chai'
import { Contract } from 'ethers'

// Ethers.js constants and utilities
import { MaxUint256 } from 'ethers/constants'
import { bigNumberify, hexlify, keccak256, defaultAbiCoder, toUtf8Bytes } from 'ethers/utils'

// Waffle testing tools: Solidity plugin, mock blockchain provider, and deploy helper
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

// Ethereum utility to sign data with private keys
import { ecsign } from 'ethereumjs-util'

// Shared utilities for tests: number scaling & EIP-712 approval digest creation
import { expandTo18Decimals, getApprovalDigest } from './shared/utilities'

// Compiled ERC20 ABI + bytecode
import ERC20 from '../build/ERC20.json'

// Enable Solidity matchers in Chai (e.g., `.to.emit`, `.reverted`, etc.)
chai.use(solidity)

// ------------------------------------------------------
// Constants for the Test Suite
// ------------------------------------------------------
const TOTAL_SUPPLY = expandTo18Decimals(10_000) // 10,000 tokens (18 decimals)
const TEST_AMOUNT = expandTo18Decimals(10)      // 10 tokens (18 decimals)

// ------------------------------------------------------
// Test Suite: UniswapV2ERC20
// ------------------------------------------------------
describe('UniswapV2ERC20', () => {
  // Create a mock Ethereum provider simulating an Ethereum network
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn', // deterministic wallets
    gasLimit: 9_999_999
  })

  // Get two test wallets from the mock provider
  const [wallet, other] = provider.getWallets()

  // ERC20 token contract instance (deployed fresh before each test)
  let token: Contract

  // ------------------------------------------------------
  // Deploy a fresh ERC20 before each test
  // ------------------------------------------------------
  beforeEach(async () => {
    token = await deployContract(wallet, ERC20, [TOTAL_SUPPLY])
  })

  // ------------------------------------------------------
  // Test: Token metadata and constants
  // ------------------------------------------------------
  it('should correctly return name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, and PERMIT_TYPEHASH', async () => {
    const name = await token.name()
    expect(name).to.eq('Uniswap V2')
    expect(await token.symbol()).to.eq('UNI-V2')
    expect(await token.decimals()).to.eq(18)
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY)

    // DOMAIN_SEPARATOR: EIP-712 domain hash for off-chain signing
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      keccak256(
        defaultAbiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            // EIP-712 domain type hash
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
            ),
            // Name hash
            keccak256(toUtf8Bytes(name)),
            // Version hash ("1")
            keccak256(toUtf8Bytes('1')),
            // Chain ID (1 for mainnet in tests)
            1,
            // Token contract address
            token.address
          ]
        )
      )
    )

    // PERMIT_TYPEHASH: EIP-2612 approval type hash
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(
        toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
      )
    )
  })

  // ------------------------------------------------------
  // Test: Approve allowance
  // ------------------------------------------------------
  it('should approve token allowance successfully', async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  })

  // ------------------------------------------------------
  // Test: Transfer tokens
  // ------------------------------------------------------
  it('should transfer tokens successfully', async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  // ------------------------------------------------------
  // Test: Prevent transfer beyond balance
  // ------------------------------------------------------
  it('should fail to transfer more tokens than balance', async () => {
    // Attempt to transfer more than the wallet's balance → revert
    await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted

    // Attempt to transfer from a wallet with zero balance → revert
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted
  })

  // ------------------------------------------------------
  // Test: transferFrom reduces allowance
  // ------------------------------------------------------
  it('should transfer tokens using transferFrom and update allowance', async () => {
    await token.approve(other.address, TEST_AMOUNT)

    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    // After transferFrom, allowance should be zero
    expect(await token.allowance(wallet.address, other.address)).to.eq(0)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  // ------------------------------------------------------
  // Test: transferFrom with MaxUint256 allowance
  // ------------------------------------------------------
  it('should allow unlimited transferFrom using MaxUint256 allowance', async () => {
    await token.approve(other.address, MaxUint256)

    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    // Allowance remains unchanged since it’s unlimited
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  // ------------------------------------------------------
  // Test: EIP-2612 Permit (signature-based approval)
  // ------------------------------------------------------
  it('should execute permit (EIP-2612) signature-based approval', async () => {
    const nonce = await token.nonces(wallet.address) // Current nonce for wallet
    const deadline = MaxUint256                    // No deadline restriction

    // Step 1: Create EIP-712 approval digest
    const digest = await getApprovalDigest(
      token,
      {
        owner: wallet.address,
        spender: other.address,
        value: TEST_AMOUNT
      },
      nonce,
      deadline
    )

    // Step 2: Sign the digest off-chain using wallet's private key
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), 'hex'),
      Buffer.from(wallet.privateKey.slice(2), 'hex')
    )

    // Step 3: Call permit() with the signature to set allowance on-chain
    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    // Allowance should now match TEST_AMOUNT
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)

    // Nonce should increment after a successful permit
    expect(await token.nonces(wallet.address)).to.eq(bigNumberify(1))
  })
})

