ss = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  // Return the full set of deployed contracts and token order
  return { factory, token0, token1, pair }
}

