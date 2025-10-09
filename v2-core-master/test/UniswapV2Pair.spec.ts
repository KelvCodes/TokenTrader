// Importing required libraries and utilities
import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { BigNumber, bigNumberify } from 'ethers/utils'

// Custom utility functions and test fixtures
import { expandTo18Decimals, mineBlock, encodePrice } from './shared/utilities'
import { pairFixture } from './shared/fixtures'
import { AddressZero } from 'ethers/constants'

// Minimum liquidity constant used to lock initial LP tokens in contract
// In UniswapV2 the first minted liquidity has MINIMUM_LIQUIDITY locked forever (usually 1000)
const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

// Enable solidity plugin for Chai assertions (adds helpful matchers for EVM events/errors)
chai.use(solidity)

// Global overrides for consistent gas limit across all txs
const overrides = {
  gasLimit: 9999999
}

describe('UniswapV2Pair', () => {
  // Create a mock provider (ganache-like) with deterministic mnemonic so tests are repeatable
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })

  // Get two wallets (accounts) from the provider: wallet = deployer/main test account, other = secondary
  const [wallet, other] = provider.getWallets()

  // Fixture loader helps deploy the pair/factory/token contracts once per test case (fast & deterministic)
  const loadFixture = createFixtureLoader(provider, [wallet])

  // Contracts used throughout tests
  let factory: Contract
  let token0: Contract
  let token1: Contract
  let pair: Contract

  // Deploy fresh contracts before each test using the pairFixture
  beforeEach(async () => {
    const fixture = await loadFixture(pairFixture)
    factory = fixture.factory
    token0 = fixture.token0
    token1 = fixture.token1
    pair = fixture.pair
  })

  // ---------------------------
  // Test: minting liquidity tokens
  // ---------------------------
  it('mint', async () => {
    // Provide 1 token0 and 4 token1 (18 decimals)
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)

    // Transfer tokens into the pair contract (simulate a user providing liquidity)
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)

    // expectedLiquidity is the initial totalSupply minted (sqrt(token0Amount * token1Amount))
    // In the reference Uniswap v2 implementation for these amounts the expected liquidity is 2 (in 18 decimals)
    const expectedLiquidity = expandTo18Decimals(2)

    // Mint call should:
    //  - lock MINIMUM_LIQUIDITY to address(0) (first Transfer event)
    //  - mint expectedLiquidity - MINIMUM_LIQUIDITY to the provider (wallet)
    //  - emit Sync with the deposited reserves
    //  - emit Mint with the provider address and amounts
    await expect(pair.mint(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY) // burn to zero to lock minimum liquidity
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY)) // provider's LP tokens
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount) // reserves updated
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount) // mint event

    // Validate internal accounting:
    // totalSupply should equal expectedLiquidity (MINIMUM_LIQUIDITY + provider amount)
    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    // wallet balance should equal expectedLiquidity - MINIMUM_LIQUIDITY
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    // Token balances in pair contract should reflect amounts transferred
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount)
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount)

    // getReserves returns (reserve0, reserve1, blockTimestampLast)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  // ---------------------------
  // Helper: addLiquidity
  // ---------------------------
  // Reusable helper to transfer token amounts into pair and mint LP tokens to the wallet
  async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(wallet.address, overrides)
  }

  // ---------------------------
  // Swap calculation test cases
  // ---------------------------
  // swapTestCases contains arrays of [swapAmount, token0Amount, token1Amount, expectedOutputAmount]
  // numeric values are converted to 18-decimal BigNumbers where appropriate (expandTo18Decimals)
  const swapTestCases: BigNumber[][] = [
    [1, 5, 10, '1662497915624478906'],
    [1, 10, 5, '453305446940074565'],
    [2, 5, 10, '2851015155847869602'],
    [2, 10, 5, '831248957812239453'],
    [1, 10, 10, '906610893880149131'],
    [1, 100, 100, '987158034397061298'],
    [1, 1000, 1000, '996006981039903216']
  ].map(a => a.map(n => (typeof n === 'string' ? bigNumberify(n) : expandTo18Decimals(n))) as BigNumber[])

  // For each case, ensure Uniswap's input -> output calculation (with 0.3% fee) produces expected output
  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] = swapTestCase

      // Seed the pool with liquidity
      await addLiquidity(token0Amount, token1Amount)
      // Send the swap input to the pair contract
      await token0.transfer(pair.address, swapAmount)

      // If a caller tries to withdraw more than allowed (expectedOutputAmount + 1), the pair should revert
      await expect(pair.swap(0, expectedOutputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith(
        'UniswapV2: K'
      )

      // Valid swap: request exactly the expected output amount
      await pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides)
    })
  })

  // ---------------------------
  // Optimistic minimal-input test cases
  // ---------------------------
  // These test a few edge/optimistic situations where inputs are minimal or set in raw integer number (not 18d)
  const optimisticTestCases: BigNumber[][] = [
    ['997000000000000000', 5, 10, 1],
    ['997000000000000000', 10, 5, 1],
    ['997000000000000000', 5, 5, 1],
    [1, 5, 5, '1003009027081243732']
  ].map(a => a.map(n => (typeof n === 'string' ? bigNumberify(n) : expandTo18Decimals(n))) as BigNumber[])

  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      // Structure: [outputAmount, token0Amount, token1Amount, inputAmount]
      const [outputAmount, token0Amount, token1Amount, inputAmount] = optimisticTestCase
      await addLiquidity(token0Amount, token1Amount)

      // Transfer the small inputAmount to the pair (simulate user sending tokens)
      await token0.transfer(pair.address, inputAmount)

      // Asking for more output than formula allows should revert
      await expect(pair.swap(outputAmount.add(1), 0, wallet.address, '0x', overrides)).to.be.revertedWith(
        'UniswapV2: K'
      )

      // Otherwise the swap should succeed with the expected output
      await pair.swap(outputAmount, 0, wallet.address, '0x', overrides)
    })
  })

  // ---------------------------
  // Test: swap when token0 is input
  // ---------------------------
  it('swap:token0', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    // Swap 1 token0 into the pool
    const swapAmount = expandTo18Decimals(1)
    // expectedOutputAmount computed from Uniswap formula for this case
    const expectedOutputAmount = bigNumberify('1662497915624478906')
    await token0.transfer(pair.address, swapAmount)

    // Check events and new reserves emitted by the swap call
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount) // token1 transferred out to wallet
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount)) // new reserves
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address) // Swap event
  })

  // ---------------------------
  // Test: swap when token1 is input
  // ---------------------------
  it('swap:token1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    // Swap 1 token1 into the pool
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('453305446940074565')
    await token1.transfer(pair.address, swapAmount)

    // Validate outgoing token0 transfer, reserves update, and Swap event
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.sub(expectedOutputAmount), token1Amount.add(swapAmount))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, swapAmount, expectedOutputAmount, 0, wallet.address)
  })

  // ---------------------------
  // Test: gas usage of swap under normal conditions
  // ---------------------------
  it('swap:gas', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    // Advance block time by 1 to ensure timestamp changes used by cumulative price calculations
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    // Sync pair reserves (updates internal state)
    await pair.sync(overrides)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('453305446940074565')
    await token1.transfer(pair.address, swapAmount)

    // Advance block again so timestamp changes are meaningful
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)

    // Execute swap and inspect gas used in receipt
    const tx = await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)
    const receipt = await tx.wait()
    // Assert that gasUsed equals expected number (this is specific to the reference implementation & mock environment)
    expect(receipt.gasUsed).to.eq(73462)
  })

  // ---------------------------
  // Test: burn LP tokens and verify returned underlying tokens
  // ---------------------------
  it('burn', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    // expectedLiquidity for these deposits (in 18 decimals)
    const expectedLiquidity = expandTo18Decimals(3)

    // Send back LP tokens (except the locked MINIMUM_LIQUIDITY) to pair contract then call burn
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await expect(pair.burn(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY)) // LP tokens burned
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, token0Amount.sub(1000)) // token0 returned (less dust)
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, token1Amount.sub(1000)) // token1 returned (less dust)
  })

  // ---------------------------
  // Test: price cumulative tracking over time (TWAP helpers rely on this)
  // ---------------------------
  it('price{0,1}CumulativeLast', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    // Capture the block timestamp recorded in reserves
    const blockTimestamp = (await pair.getReserves())[2]

    // Mine a block with timestamp +1 and sync; this begins time for cumulative price accumulation
    await mineBlock(provider, blockTimestamp + 1)
    await pair.sync(overrides)

    // Calculate expected encoded price based on initial reserves
    const initialPrice = encodePrice(token0Amount, token1Amount)

    // Immediately after sync, price{0,1}CumulativeLast should equal initial encoded price
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0])
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1])

    // Advance time by 10 seconds (or blocks) and execute a swap to force price cumulative to grow with time
    await mineBlock(provider, blockTimestamp + 10)
    await pair.swap(0, expandTo18Decimals(1), wallet.address, '0x', overrides)

    // Now price cumulative should have increased by initialPrice * timeElapsed (10)
    expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0].mul(10))
    expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1].mul(10))

    // Further advance and sync to leave pair in consistent state
    await mineBlock(provider, blockTimestamp + 20)
    await pair.sync(overrides)
  })

  // ---------------------------
  // Test: protocol fee logic when feeTo is not set (feeTo:off)
  // ---------------------------
  it('feeTo:off', async () => {
    // Provide large liquidity to test fee behavior
    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    // Do a swap to generate fees inside the pair
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    // Burn LP tokens back to the provider (simulate LP removing liquidity)
    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address, overrides)

    // When feeTo is off (unset), no extra liquidity should be minted for fee collector; totalSupply should equal MINIMUM_LIQUIDITY
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  // ---------------------------
  // Test: protocol fee logic when feeTo is set (feeTo:on)
  // ---------------------------
  it('feeTo:on', async () => {
    // Set feeTo in the factory so that the pair mints protocol fees to the feeTo address
    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    // Do a swap to create accrued fees
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    // Burn LP tokens back to provider to trigger fee minting to feeTo address
    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address, overrides)

    // After fee-on behavior, a small amount of extra liquidity should be minted to the fee collector (other.address)
    // These expected numbers are based on the reference implementation & arithmetic in the test environment
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY.add('249750499251388'))
    expect(await pair.balanceOf(other.address)).to.eq('249750499251388')
  })
})

