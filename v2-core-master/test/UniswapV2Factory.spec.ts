
import { Contract } from 'ethers'
import { AddressZero } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

// Import utility function for computing create2 addresses
import { getCreate2Address } from './shared/utilities'
// Import a fixture to deploy the factory contract
import { factoryFixture } from './shared/fixtures'

// Import compiled UniswapV2Pair artifact for ABI and bytecode
import UniswapV2Pair from '../build/UniswapV2Pair.json'

// Use Chai plugin for better Solidity assertions
chai.use(solidity)

// Predefined test addresses for simulating token contracts
const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

// Begin test suite for UniswapV2Factory
describe('UniswapV2Factory', () => {
  // Initialize a mocked Ethereum provider with a fixed mnemonic and gas limit
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })

  // Get two wallets from the provider for use in tests
  const [wallet, other] = provider.getWallets()
  // Fixture loader for setting up the test state
  const loadFixture = createFixtureLoader(provider, [wallet, other])

  let factory: Contract

  // Deploy a fresh factory contract before each test
  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory
  })

  // Check initial values for feeTo, feeToSetter, and pair count
  it('feeTo, feeToSetter, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(AddressZero)
    expect(await factory.feeToSetter()).to.eq(wallet.address)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  // Helper function to create a new pair and validate its correctness
  async function createPair(tokens: [string, string]) {
    const bytecode = `0x${UniswapV2Pair.evm.bytecode.object}`
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)

    // Create pair and check that event is emitted with correct arguments
    await expect(factory.createPair(...tokens))
      .to.emit(factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, bigNumberify(1))

    // Creating the same pair again (even in reverse order) should fail
    await expect(factory.createPair(...tokens)).to.be.reverted // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // UniswapV2: PAIR_EXISTS

    // Validate that the created pair is stored and retrievable
    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(await factory.allPairsLength()).to.eq(1)

    // Instantiate the pair contract and validate its properties
    const pair = new Contract(create2Address, JSON.stringify(UniswapV2Pair.abi), provider)
    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0])
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1])
  }

  // Test: Creating a pair in normal order
  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  // Test: Creating a pair in reverse token order
  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse() as [string, string])
  })

  // Test: Measure gas used in pair creation
  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(2512920) // Validate against expected gas usage
  })

  // Test: Only the feeToSetter can update feeTo
  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  // Test: Only the feeToSetter can change the feeToSetter
  it('setFeeToSetter', async () => {
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setFeeToSetter(other.address)
    expect(await factory.feeToSetter()).to.eq(other.address)
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
  })
})

