const BlockReward = artifacts.require('BlockRewardMock.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const {ERROR_MSG, ZERO_AMOUNT, ZERO_ADDRESS} = require('./helpers')
const {toBN, toWei, toChecksumAddress} = web3.utils

const REWARD = toWei(toBN(1), 'ether')
const REWARD_OTHER = toWei(toBN(2), 'ether')
const SYSTEM_ADDRESS = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE'

contract('BlockReward', async (accounts) => {
  let blockRewardImpl, proxy, blockReward
  let owner = accounts[0]
  let nonOwner = accounts[1]
  let mockSystemAddress = accounts[2]

  describe('initialize', async () => {
    beforeEach(async () => {
      blockRewardImpl = await BlockReward.new()
      proxy = await EternalStorageProxy.new(ZERO_ADDRESS, blockRewardImpl.address)
      owner.should.equal(await proxy.getOwner())
      blockReward = await BlockReward.at(proxy.address)
    })
    it('default values', async () => {
      await blockReward.initialize(REWARD)
      toChecksumAddress(SYSTEM_ADDRESS).should.be.equal(toChecksumAddress(await blockReward.systemAddress()))
      REWARD.should.be.bignumber.equal(await blockReward.getReward())
    })
    it('only owner can set reward', async () => {
      await blockReward.initialize(REWARD)
      await blockReward.setReward(REWARD_OTHER, {from: nonOwner}).should.be.rejectedWith(ERROR_MSG)
      REWARD.should.be.bignumber.equal(await blockReward.getReward())
      await blockReward.setReward(REWARD_OTHER, {from: owner})
      REWARD_OTHER.should.be.bignumber.equal(await blockReward.getReward())
    })
    it('can set zero reward', async () => {
      await blockReward.initialize(REWARD)
      await blockReward.setReward(ZERO_AMOUNT, {from: owner})
      ZERO_AMOUNT.should.be.bignumber.equal(await blockReward.getReward())
    })
  })

  describe('reward', async () => {
    beforeEach(async () => {
      blockRewardImpl = await BlockReward.new()
      proxy = await EternalStorageProxy.new(ZERO_ADDRESS, blockRewardImpl.address)
      blockReward = await BlockReward.at(proxy.address)
      await blockReward.initialize(REWARD)
    })
    it('can only be called by system address', async () => {
      await blockReward.reward([accounts[3]], [0]).should.be.rejectedWith(ERROR_MSG)
      await blockReward.setSystemAddress(mockSystemAddress, {from: owner})
      await blockReward.reward([accounts[3]], [0], {from: mockSystemAddress}).should.be.fulfilled
    })
    it('should revert if input array contains more than one item', async () => {
      await blockReward.setSystemAddress(mockSystemAddress, {from: owner})
      await blockReward.reward([accounts[3], accounts[4]], [0, 0], {from: mockSystemAddress}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should revert if lengths of input arrays are not equal', async () => {
      await blockReward.setSystemAddress(mockSystemAddress, {from: owner})
      await blockReward.reward([accounts[3]], [0, 0], {from: mockSystemAddress}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should revert if `kind` parameter is not 0', async () => {
      await blockReward.setSystemAddress(mockSystemAddress, {from: owner})
      await blockReward.reward([accounts[3]], [1], {from: mockSystemAddress}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should give reward and balance should be updated', async () => {
      await blockReward.setSystemAddress(mockSystemAddress, {from: owner})
      let {logs} = await blockReward.reward([accounts[3]], [0], {from: mockSystemAddress}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('Rewarded')
      logs[0].args['receivers'].should.deep.equal([accounts[3]])
      logs[0].args['rewards'][0].should.be.bignumber.equal(REWARD)
    })
  })
})
