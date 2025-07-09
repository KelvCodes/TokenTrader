/* 📦 Import libraries and utilities used in tests */

const truffleAssert = require('truffle-assertions'); // For better assertion handling in Truffle tests
const { MockProvider } = require("ethereum-waffle"); // Used to create test wallets
const { signMetaTransaction } = require("./utils/signMetaTransaction.js"); // Utility to sign meta transactions

const vals = require('../lib/testValuesCommon.js'); // Common test values (e.g., ADDRESS_ZERO, URI_BASE)


/* 📄 Import smart contracts to test */

const ERC1155Tradable = artifacts.require("../contracts/ERC1155Tradable.sol");
const MockProxyRegistry = artifacts.require("../contracts/MockProxyRegistry.sol");
const ApprovedSpenderContract = artifacts.require("../contracts/test/ApprovedSpenderContract.sol");


/* 🛠 Define useful constants and helpers */

const toBN = web3.utils.toBN; // Convert numbers to BN (BigNumber) objects
const web3ERC1155 = new web3.eth.Contract(ERC1155Tradable.abi); // Web3 contract instance for encoding ABI calls


/* 🧪 Test suite for ERC1155Tradable */

contract("ERC1155Tradable - ERC 1155", (accounts) => {
  const NAME = 'ERC-1155 Test Contract';
  const SYMBOL = 'ERC1155Test';

  const INITIAL_TOKEN_ID = 1;
  const NON_EXISTENT_TOKEN_ID = 99999999;
  const MINT_AMOUNT = toBN(100);
  const OVERFLOW_NUMBER = toBN(2).pow(toBN(256)).sub(toBN(1)); // Max uint256 value

  const owner = accounts[0];
  const creator = accounts[1];
  const userA = accounts[2];
  const userB = accounts[3];
  const proxyForOwner = accounts[5];

  let instance;      // ERC1155Tradable contract instance
  let proxy;         // MockProxyRegistry instance
  let approvedContract; // Contract to be approved in some tests
  let tokenId = 0;   // Keep track of token IDs incrementally


  /**
   * 🚀 Before running tests: deploy contracts
   * - Deploy a mock proxy registry
   * - Set a proxy for owner
   * - Deploy the ERC1155Tradable contract with proxy
   * - Deploy a contract to be approved later
   */
  before(async () => {
    proxy = await MockProxyRegistry.new();
    await proxy.setProxy(owner, proxyForOwner);
    instance = await ERC1155Tradable.new(NAME, SYMBOL, vals.URI_BASE, proxy.address);
    approvedContract = await ApprovedSpenderContract.new();
  });


  /** 🧪 Test the constructor */
  describe('#constructor()', () => {
    it('should set the token name, symbol, and URI', async () => {
      const name = await instance.name();
      assert.equal(name, NAME);
      const symbol = await instance.symbol();
      assert.equal(symbol, SYMBOL);
      // proxyRegistryAddress cannot be directly tested as it's private
    });
  });


  /** 🧪 Test token creation logic */
  describe('#create()', () => {

    it('should allow the contract owner to create tokens with zero supply', async () => {
      tokenId += 1;
      truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, 0, "", "0x0", { from: owner }),
        'TransferSingle',
        { operator: owner, from: vals.ADDRESS_ZERO, to: owner, id: toBN(tokenId), value: toBN(0) }
      );
      const supply = await instance.tokenSupply(tokenId);
      assert.ok(supply.eq(toBN(0)));
    });

    it('should allow the contract owner to create tokens with initial supply', async () => {
      tokenId += 1;
      truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, MINT_AMOUNT, "", "0x0", { from: owner }),
        'TransferSingle',
        { operator: owner, from: vals.ADDRESS_ZERO, to: owner, id: toBN(tokenId), value: MINT_AMOUNT }
      );
      const supply = await instance.tokenSupply(tokenId);
      assert.ok(supply.eq(MINT_AMOUNT));
    });

    it('should set tokenSupply on creation', async () => {
      tokenId += 1;
      const tokenSupply = 33;
      truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, tokenSupply, "", "0x0", { from: owner }),
        'TransferSingle',
        { id: toBN(tokenId) }
      );
      const balance = await instance.balanceOf(owner, tokenId);
      const supply = await instance.tokenSupply(tokenId);
      assert.ok(supply.eq(toBN(tokenSupply)));
      assert.ok(supply.eq(balance));
    });

    it('should increment the token type id', async () => {
      tokenId += 1;
      await truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, 0, "", "0x0", { from: owner }),
        'TransferSingle',
        { id: toBN(tokenId) }
      );
      tokenId += 1;
      await truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, 0, "", "0x0", { from: owner }),
        'TransferSingle',
        { id: toBN(tokenId) }
      );
    });

    it('should not allow a non-owner to create tokens', async () => {
      tokenId += 1;
      await truffleAssert.fails(
        instance.create(userA, tokenId, 0, "", "0x0", { from: userA }),
        truffleAssert.ErrorType.revert,
        'caller is not the owner'
      );
    });

    it('should allow the contract owner to create tokens and emit a URI event if URI is provided', async () => {
      tokenId += 1;
      truffleAssert.eventEmitted(
        await instance.create(owner, tokenId, 0, vals.URI_BASE, "0x0", { from: owner }),
        'URI',
        { value: vals.URI_BASE, id: toBN(tokenId) }
      );
    });

    it('should not emit URI event if no URI is provided', async () => {
      tokenId += 1;
      truffleAssert.eventNotEmitted(
        await instance.create(owner, tokenId, 0, "", "0x0", { from: owner }),
        'URI'
      );
    });
  });


  /** 🧪 Test totalSupply logic */
  describe('#totalSupply()', () => {
    it('should return correct supply for existing token', async () => {
      tokenId += 1;
      await instance.create(owner, tokenId, MINT_AMOUNT, "", "0x0", { from: owner });
      const balance = await instance.balanceOf(owner, tokenId);
      const supplyGetterValue = await instance.tokenSupply(tokenId);
      const supplyAccessorValue = await instance.totalSupply(tokenId);
      assert.ok(balance.eq(MINT_AMOUNT));
      assert.ok(supplyGetterValue.eq(MINT_AMOUNT));
      assert.ok(supplyAccessorValue.eq(MINT_AMOUNT));
    });

    it('should return zero for non-existent token', async () => {
      const balance = await instance.balanceOf(owner, NON_EXISTENT_TOKEN_ID);
      const supply = await instance.totalSupply(NON_EXISTENT_TOKEN_ID);
      assert.ok(balance.eq(toBN(0)));
      assert.ok(supply.eq(toBN(0)));
    });
  });


  /** 🧪 Test setting creator */
  describe('#setCreator()', () => {
    it('should allow creator to set new creator', async () => {
      await instance.setCreator(userA, [INITIAL_TOKEN_ID], { from: owner });
      const tokenCreator = await instance.creators(INITIAL_TOKEN_ID);
      assert.equal(tokenCreator, userA);
    });

    it('should allow new creator to change creator again', async () => {
      await instance.setCreator(creator, [INITIAL_TOKEN_ID], { from: userA });
      const tokenCreator = await instance.creators(INITIAL_TOKEN_ID);
      assert.equal(tokenCreator, creator);
    });

    it('should not allow creator to set creator to 0x0', () =>
      truffleAssert.fails(
        instance.setCreator(vals.ADDRESS_ZERO, [INITIAL_TOKEN_ID], { from: creator }),
        truffleAssert.ErrorType.revert,
        'ERC1155Tradable#setCreator: INVALID_ADDRESS.'
      )
    );

    it('should not allow non-creator to change creator', async () => {
      await truffleAssert.fails(
        instance.setCreator(userA, [INITIAL_TOKEN_ID], { from: userA }),
        truffleAssert.ErrorType.revert,
        'ERC1155Tradable#creatorOnly: ONLY_CREATOR_ALLOWED'
      );
      await truffleAssert.fails(
        instance.setCreator(owner, [INITIAL_TOKEN_ID], { from: owner }),
        truffleAssert.ErrorType.revert,
        'ERC1155Tradable#creatorOnly: ONLY_CREATOR_ALLOWED'
      );
    });
  });


  /** 🧪 Test minting logic */
  describe('#mint()', () => {
    it('should allow creator to mint tokens', async () => {
      await instance.mint(userA, INITIAL_TOKEN_ID, MINT_AMOUNT, "0x0", { from: creator });
      const supply = await instance.totalSupply(INITIAL_TOKEN_ID);
      assert.isOk(supply.eq(MINT_AMOUNT));
    });

    it('should update totalSupply when minting', async () => {
      let supply = await instance.totalSupply(INITIAL_TOKEN_ID);
      await instance.mint(userA, INITIAL_TOKEN_ID, MINT_AMOUNT, "0x0", { from: creator });
      const newSupply = await instance.totalSupply(INITIAL_TOKEN_ID);
      assert.isOk(newSupply.eq(supply.add(MINT_AMOUNT)));
    });

    it('should prevent overflow when minting too many tokens', async () => {
      await truffleAssert.fails(
        instance.mint(userB, INITIAL_TOKEN_ID, OVERFLOW_NUMBER, "0x0", { from: creator }),
        truffleAssert.ErrorType.revert
      );
    });
  });


  /** 🧪 Test batch minting logic */
  describe('#batchMint()', () => {
    it('should update totalSupply correctly', async () => {
      await instance.batchMint(userA, [INITIAL_TOKEN_ID], [MINT_AMOUNT], "0x0", { from: creator });
      const supply = await instance.totalSupply(INITIAL_TOKEN_ID);
      assert.isOk(supply.gte(MINT_AMOUNT)); // Should be sum of previous + new
    });

    it('should prevent overflow in batchMint', () =>
      truffleAssert.fails(
        instance.batchMint(userB, [INITIAL_TOKEN_ID], [OVERFLOW_NUMBER], "0x0", { from: creator }),
        truffleAssert.ErrorType.revert
      )
    );

    it('should reject minting if caller is not creator', async () =>
      truffleAssert.fails(
        instance.batchMint(userA, [INITIAL_TOKEN_ID], [MINT_AMOUNT], "0x0", { from: userB }),
        truffleAssert.ErrorType.revert,
        'ERC1155Tradable#batchMint: ONLY_CREATOR_ALLOWED'
      )
    );
  });


  /** 🧪 Test URI methods */
  describe('#uri()', () => {
    it('should return default uri for valid token', async () => {
      const uri = await instance.uri(1);
      assert.equal(uri, `${vals.URI_BASE}`);
    });

    it('should fail for non-existent token', () =>
      truffleAssert.fails(
        instance.uri(NON_EXISTENT_TOKEN_ID),
        truffleAssert.ErrorType.revert,
        'NONEXISTENT_TOKEN'
      )
    );
  });

  describe('#setURI()', () => {
    const newUri = "https://newuri.com/{id}";
    it('should allow owner to set URI', async () => {
      await instance.setURI(newUri, { from: owner });
      const uri = await instance.uri(1);
      assert.equal(uri, newUri);
    });

    it('should reject non-owner from setting URI', () =>
      truffleAssert.fails(
        instance.setURI(newUri, { from: userA }),
        truffleAssert.ErrorType.revert,
        'Ownable: caller is not the owner'
      )
    );
  });

  describe('#setCustomURI()', () => {
    const customUri = "https://customuri.com/metadata";
    it('should allow creator to set custom URI', async () => {
      tokenId += 1;
      await instance.create(owner, tokenId, 0, "", "0x0", { from: owner });
      await instance.setCustomURI(tokenId, customUri, { from: owner });
      const uri = await instance.uri(tokenId);
      assert.equal(uri, customUri);
    });

    it('should reject non-creator from setting custom URI', async () => {
      tokenId += 1;
      await instance.create(owner, tokenId, 0, "", "0x0", { from: owner });
      await truffleAssert.fails(
        instance.setCustomURI(tokenId, customUri, { from: userB })
      );
    });
  });


  /** 🧪 Test operator approval logic */
  describe('#isApprovedForAll()', () => {
    it('should auto-approve proxy address as operator', async () => {
      assert.isOk(await instance.isApprovedForAll(owner, proxyForOwner));
    });

    it('should not approve non-proxy address', async () => {
      assert.isNotOk(await instance.isApprovedForAll(owner, userB));
    });

    it('should reject proxy as operator for non-owner', async () => {
      assert.isNotOk(await instance.isApprovedForAll(userA, proxyForOwner));
    });

    it('should allow manual approval for operator', async () => {
      await instance.setApprovalForAll(userB, true, { from: userA });
      assert.isOk(await instance.isApprovedForAll(userA, userB));
      await instance.setApprovalForAll(userB, false, { from: userA });
    });

    it('should reflect revoked approval correctly', async () => {
      await instance.setApprovalForAll(userB, false, { from: userA });
      assert.isNotOk(await instance.isApprovedForAll(userA, userB));
    });
  });


  /** 🧪 Test meta-transaction functionality */
  describe("#executeMetaTransaction()", function () {
    it("should allow meta-tx to call setApprovalForAll", async function () {
      const wallet = new MockProvider().createEmptyWallet();
      const user = await wallet.getAddress();

      const name = await instance.name();
      const nonce = await instance.getNonce(user);
      const version = await instance.ERC712_VERSION();
      const chainId = await instance.getChainId();

      const domainData = {
        name,
        version,
        verifyingContract: instance.address,
        salt: '0x' + web3.utils.toHex(chainId).substring(2).padStart(64, '0'),
      };

      const functionSignature = web3ERC1155.methods
        .setApprovalForAll(approvedContract.address, true)
        .encodeABI();

      const { r, s, v } = await signMetaTransaction(wallet, nonce, domainData, functionSignature);

      assert.equal(await instance.isApprovedForAll(user, approvedContract.address), false);
      truffleAssert.eventEmitted(
        await instance.executeMetaTransaction(user, functionSignature, r, s, v),
        'ApprovalForAll',
        { account: user, operator: approvedContract.address, approved: true }
      );
      assert.equal(await instance.isApprovedForAll(user, approvedContract.address), true);
    });
  });
});
