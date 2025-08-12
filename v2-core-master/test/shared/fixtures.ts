// ------------------------------------------------------
// Import Required Ethers.js Types & Utilities
// ------------------------------------------------------
import { Contract, Wallet } from 'ethers' // Contract interaction + signer wallet type
import { Web3Provider } from 'ethers/providers' // Provider to connect to Ethereum nodes
import { deployContract } from 'ethereum-waffle' // Waffle helper to deploy contracts for tests

// Import utility to handle token amounts with 18 decimal places
import { expandTo18Decimals } from './utilities'

// Import compiled contract artifacts (ABI + bytecode)
import ERC20 from '../../build/ERC20.json'
import UniswapV2Factory from '../../build/UniswapV2Factory.json'
import UniswapV2Pair from '../../build/UniswapV2Pair.json'

// ------------------------------------------------------
// Types for Fixtures (Organized Contract Deployments)
// ------------------------------------------------------

// Factory fixture returns only the UniswapV2Factory instance
interface FactoryFixture {
  factory: Contract
}

// Pair fixture extends factory fixture with ERC20 tokens and UniswapV2Pair instance
interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
}

// ------------------------------------------------------
// Transaction Overrides
// ------------------------------------------------------
// Set a high gas limit to prevent out-of-gas issues during test runs
const overrides = {
  gasLimit: 9_999_999
}

// ------------------------------------------------------
// Deploy a Fresh UniswapV2Factory Contract
// ------------------------------------------------------
export async function factoryFixture(_: Web3Provider, [wallet]: Wallet[]): Promise<FactoryFixture> {
  // Deploy UniswapV2Factory with the wallet's address as the feeToSetter
  const factory = await deployContract(wallet, UniswapV2Factory, [wallet.address], overrides)

  // Return the deployed factory contract
  return { factory }
}

// ------------------------------------------------------
// Deploy ERC20 Tokens + Create a Uniswap Pair
// ------------------------------------------------------
export async function pairFixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<PairFixture> {
  // Step 1: Deploy the factory using the fixture helper
  const { factory } = await factoryFixture(provider, [wallet])

  // Step 2: Deploy two ERC20 tokens, each with a total supply of 10,000 tokens (18 decimals)
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10_000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10_000)], overrides)

  // Step 3: Create a new UniswapV2 pair for the two tokens
  await factory.createPair(tokenA.address, tokenB.address, overrides)

  // Step 4: Fetch the deployed pair's address from the factory
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)

  // Step 5: Instantiate the pair contract with ABI + address + provider and connect signer
  const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

  // Step 6: Determine token0 and token1 order (Uniswap sorts by address lexicographically)
  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  // Step 7: Return the deployed contracts and their ordered references
  return { factory, token0, token1, pair }
}

