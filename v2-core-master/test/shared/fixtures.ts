// Import core Ethers.js types
import { Contract, Wallet } from 'ethers'
// Import Ethers.js Web3 provider
import { Web3Provider } from 'ethers/providers'
// Utility to deploy smart contracts using Waffle
import { deployContract } from 'ethereum-waffle'

// Utility for scaling token amounts to 18 decimal places
import { expandTo18Decimals } from './utilities'

// Import compiled contract ABIs and bytecode
import ERC20 from '../../build/ERC20.json'
import UniswapV2Factory from '../../build/UniswapV2Factory.json'
import UniswapV2Pair from '../../build/UniswapV2Pair.json'

// Interface for the factory fixture result
interface FactoryFixture {
  factory: Contract
}

// Set high gas limit to avoid out-of-gas errors during tests
const overrides = {
  gasLimit: 9999999
}

// Deploy and return a fresh instance of the UniswapV2Factory contract
export async function factoryFixture(_: Web3Provider, [wallet]: Wallet[]): Promise<FactoryFixture> {
  const factory = await deployContract(wallet, UniswapV2Factory, [wallet.address], overrides)
  return { factory }
}

// Interface for a complete pair fixture setup
interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
}

// Deploy two ERC20 tokens, create a UniswapV2 pair for them, and return all relevant contracts
export async function pairFixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<PairFixture> {
  // Deploy the factory using the helper function above
  const { factory } = await factoryFixture(provider, [wallet])

  // Deploy two ERC20 tokens with 10,000 units each (18 decimals)
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)

  // Create a pair between the two tokens using the factory
  await factory.createPair(tokenA.address, tokenB.address, overrides)

  // Get the address of the created pair contract
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)

  // Instantiate the pair contract with ABI, address, and provider
  const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

  // Determine which token is token0 and which is token1 (sorted lexicographically inside Uniswap)
  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  // Return the full set of deployed contracts and token order
  return { factory, token0, token1, pair }
}

