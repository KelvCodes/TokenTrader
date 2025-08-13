

import { MaxUint256 } from 'ethers/constants'
import { bigNumberify, hexlify, keccak256, defaultAbiCoder, toUtf8Bytes } from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

// Import shared utility functions for digest creation and value expansion
import { expandTo18Decimals, getApprovalDigest } from './shared/utilities'

// Import the compiled ERC20 ABI
import ERC20 from '../build/ERC20.json'

// Enable Solidity plugin for Chai to use `.to.emit`, `.reverted`, etc.
chai.use(solidity)

// Constants used throughout the test suite
const TOTAL_SUPPLY = expandTo18Decimals(10000) // 10,000 tokens with 18 decimals
const TEST_AMOUNT = expandTo18Decimals(10) // 10 tokens with 18 decimals

describe('UniswapV2ERC20', () => {
  // Create a mock Ethereum provider with Istanbul hardfork
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })

  // Wallets provided by the mock provider
  const [wallet, other] = provider.getWallets()

  // Token contract instance
  let token: Contract

  // Deploy a fresh ERC20 token contract before each test
  beforeEach(async () => {
    token = await deployContract(wallet, ERC20, [TOTAL_SUPPLY])
  })

  it('should correctly return name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, and PERMIT_TYPEHASH', async () => {
    const name = await token.name()
    expect(name).to.eq('Uniswap V2')
    expect(await token.symbol()).to.eq('UNI-V2')
    expect(await token.decimals()).to.eq(18)
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY)

    // DOMAIN_SEPARATOR: used for EIP-712 typed data signing
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      keccak256(
        defaultAbiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
            ),
            keccak256(toUtf8Bytes(name)),
            keccak256(toUtf8Bytes('1')),
            1,
            token.address
          ]
        )
      )
    )

    // PERMIT_TYPEHASH: used in meta-transactions (EIP-2612)
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
    )
  })

  it('should approve token allowance successfully', async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  })

  it('should transfer tokens successfully', async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('should fail to transfer more tokens than balance', async () => {
    // Attempt to transfer more than wallet's balance - should revert
    await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted

    // Attempt transfer from a wallet with 0 balance - should revert
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted
  })

  it('should transfer tokens using transferFrom and update allowance', async () => {
    await token.approve(other.address, TEST_AMOUNT)

    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    // After transferFrom, allowance should be 0
    expect(await token.allowance(wallet.address, other.address)).to.eq(0)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('should allow unlimited transferFrom using MaxUint256 allowance', async () => {
    await token.approve(other.address, MaxUint256)

    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    // Since allowance is max, it should remain unchanged
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('should execute permit (EIP-2612) signature-based approval', async () => {
    const nonce = await token.nonces(wallet.address)
    const deadline = MaxUint256

    // Create a digest per EIP-712
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

    // Sign the digest off-chain
    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

    // Execute permit function with signature parameters
    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
    expect(await token.nonces(wallet.address)).to.eq(bigNumberify(1)) // Nonce increments after successful permit
  })
})
