transferFrom', async () => {
    await token.approve(other.address, TEST_AMOUNT)
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(0)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('transferFrom:max', async () => {
    await token.approve(other.address, MaxUint256)
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('permit', async () => {
    const nonce = await token.nonces(wallet.address)
    const deadline = MaxUint256
    const digest = await getApprovalDigest(
      token,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce,
      deadline
    )

    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
    expect(await token.nonces(wallet.address)).to.eq(bigNumberify(1))
  })
})
