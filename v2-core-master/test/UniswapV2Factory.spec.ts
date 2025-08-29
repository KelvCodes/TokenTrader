// -----------------------------------------------------------------------------
// Importing necessary libraries and dependencies
// -----------------------------------------------------------------------------
import chai, { expect } from "chai";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import {
  solidity,
  MockProvider,
  createFixtureLoader,
} from "ethereum-waffle";

// -----------------------------------------------------------------------------
// Import helper utilities and fixtures
// -----------------------------------------------------------------------------
import { getCreate2Address } from "./shared/utilities";
import { factoryFixture } from "./shared/fixtures";

// Import the UniswapV2Pair artifact for ABI and bytecode access
import UniswapV2Pair from "../build/UniswapV2Pair.json";

// -----------------------------------------------------------------------------
// Setup Chai with solidity plugin for better smart contract assertions
// -----------------------------------------------------------------------------
chai.use(solidity);

// -----------------------------------------------------------------------------
// Predefined test addresses that simulate ERC20 token contracts
// -----------------------------------------------------------------------------
const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

// -----------------------------------------------------------------------------
// Begin Test Suite for UniswapV2Factory
// -----------------------------------------------------------------------------
describe("UniswapV2Factory", () => {
  // ---------------------------------------------------------------------------
  // Initialize a mocked Ethereum provider
  // ---------------------------------------------------------------------------
  const provider = new MockProvider({
    hardfork: "istanbul",
    mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
    gasLimit: 9999999,
  });

  // ---------------------------------------------------------------------------
  // Extract two wallets from the provider
  // ---------------------------------------------------------------------------
  const [wallet, other] = provider.getWallets();

  // Fixture loader to simplify state resets between tests
  const loadFixture = createFixtureLoader(provider, [wallet, other]);

  // Factory contract instance (mutable between tests)
  let factory: Contract;

  // ---------------------------------------------------------------------------
  // Before each test, deploy a fresh factory contract using the fixture
  // ---------------------------------------------------------------------------
  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture);
    factory = fixture.factory;
  });

  // ---------------------------------------------------------------------------
  // Test: Initial state variables of the factory
  // ---------------------------------------------------------------------------
  it("feeTo, feeToSetter, allPairsLength", async () => {
    const feeTo = await factory.feeTo();
    const feeToSetter = await factory.feeToSetter();
    const pairCount = await factory.allPairsLength();

    expect(feeTo).to.eq(AddressZero);
    expect(feeToSetter).to.eq(wallet.address);
    expect(pairCount).to.eq(0);
  });

  // ---------------------------------------------------------------------------
  // Helper function to create a pair and validate correctness
  // ---------------------------------------------------------------------------
  async function createPair(tokens: [string, string]) {
    // Extract bytecode for UniswapV2Pair
    const bytecode = `0x${UniswapV2Pair.evm.bytecode.object}`;

    // Compute expected pair address using CREATE2
    const create2Address = getCreate2Address(factory.address, tokens, bytecode);

    // -------------------------------------------------------------------------
    // Execute the createPair transaction and validate emitted event
    // -------------------------------------------------------------------------
    await expect(factory.createPair(...tokens))
      .to.emit(factory, "PairCreated")
      .withArgs(
        TEST_ADDRESSES[0],
        TEST_ADDRESSES[1],
        create2Address,
        bigNumberify(1)
      );

    // -------------------------------------------------------------------------
    // Ensure creating the same pair again fails
    // -------------------------------------------------------------------------
    await expect(factory.createPair(...tokens)).to.be.reverted; // UniswapV2: PAIR_EXISTS
    await expect(
      factory.createPair(...tokens.slice().reverse())
    ).to.be.reverted; // UniswapV2: PAIR_EXISTS

    // -------------------------------------------------------------------------
    // Validate that the created pair can be retrieved correctly
    // -------------------------------------------------------------------------
    const storedPairDirect = await factory.getPair(...tokens);
    const storedPairReverse = await factory.getPair(...tokens.slice().reverse());
    const storedPairAtIndex = await factory.allPairs(0);
    const pairCount = await factory.allPairsLength();

    expect(storedPairDirect).to.eq(create2Address);
    expect(storedPairReverse).to.eq(create2Address);
    expect(storedPairAtIndex).to.eq(create2Address);
    expect(pairCount).to.eq(1);

    // -------------------------------------------------------------------------
    // Attach a contract instance to the created pair
    // -------------------------------------------------------------------------
    const pair = new Contract(
      create2Address,
      JSON.stringify(UniswapV2Pair.abi),
      provider
    );

    // -------------------------------------------------------------------------
    // Validate pair’s metadata
    // -------------------------------------------------------------------------
    const factoryAddress = await pair.factory();
    const token0 = await pair.token0();
    const token1 = await pair.token1();

    expect(factoryAddress).to.eq(factory.address);
    expect(token0).to.eq(TEST_ADDRESSES[0]);
    expect(token1).to.eq(TEST_ADDRESSES[1]);
  }

  // ---------------------------------------------------------------------------
  // Test: Creating a pair in the standard order
  // ---------------------------------------------------------------------------
  it("createPair", async () => {
    await createPair(TEST_ADDRESSES);
  });

  // ---------------------------------------------------------------------------
  // Test: Creating a pair with tokens in reverse order
  // ---------------------------------------------------------------------------
  it("createPair:reverse", async () => {
    const reversedTokens = TEST_ADDRESSES.slice().reverse() as [string, string];
    await createPair(reversedTokens);
  });

  // ---------------------------------------------------------------------------
  // Test: Measure gas usage for pair creation
  // ---------------------------------------------------------------------------
  it("createPair:gas", async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES);
    const receipt = await tx.wait();

    const gasUsed = receipt.gasUsed;
    expect(gasUsed).to.eq(2512920);
  });

  // ---------------------------------------------------------------------------
  // Test: Ensure only feeToSetter can update feeTo
  // ---------------------------------------------------------------------------
  it("setFeeTo", async () => {
    await expect(
      factory.connect(other).setFeeTo(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");

    await factory.setFeeTo(wallet.address);

    const feeTo = await factory.feeTo();
    expect(feeTo).to.eq(wallet.address);
  });

  // ---------------------------------------------------------------------------
  // Test: Ensure only feeToSetter can update feeToSetter
  // ---------------------------------------------------------------------------
  it("setFeeToSetter", async () => {
    await expect(
      factory.connect(other).setFeeToSetter(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");

    await factory.setFeeToSetter(other.address);

    const feeToSetter = await factory.feeToSetter();
    expect(feeToSetter).to.eq(other.address);

    await expect(
      factory.setFeeToSetter(wallet.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");
  });
});

