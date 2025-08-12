ct
  
  // Instantiate the pair contract with ABI, address, and provider
  const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

  // Determine which token is token0 and which is token1 (sorted lexicographically inside Uniswap)
  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  // Return the full set of deployed contracts and token order
  return { factory, token0, token1, pair }
}

