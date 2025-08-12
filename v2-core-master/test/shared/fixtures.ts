ct
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

