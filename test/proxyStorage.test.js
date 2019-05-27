const Consensus = artifacts.require('ConsensusMock.sol')
const ProxyStorage = artifacts.require('ProxyStorageMock.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxyMock.sol')
const BallotsStorage = artifacts.require('BallotsStorage.sol')
const BlockReward = artifacts.require('BlockReward.sol')
const VotingToChangeBlockReward = artifacts.require('VotingToChangeBlockReward.sol')
const VotingToChangeMinStake = artifacts.require('VotingToChangeMinStake.sol')
const VotingToChangeMinThreshold = artifacts.require('VotingToChangeMinThreshold.sol')
const VotingToChangeProxyAddress = artifacts.require('VotingToChangeProxyAddress.sol')
const {ERROR_MSG, ZERO_AMOUNT, ZERO_ADDRESS, RANDOM_ADDRESS} = require('./helpers')
const {toBN, toWei, toChecksumAddress} = web3.utils

contract('ProxyStorage', async (accounts) => {
  let proxyStorageImpl, proxy, proxyStorage
  let owner = accounts[0]
  let nonOwner = accounts[1]
  let blockReward, ballotsStorage, votingToChangeBlockReward, votingToChangeMinStake, votingToChangeMinThreshold, votingToChangeProxy

  beforeEach(async () => {
    // Consensus
    consensusImpl = await Consensus.new()
    proxy = await EternalStorageProxy.new(ZERO_ADDRESS, consensusImpl.address)
    consensus = await Consensus.at(proxy.address)
    await consensus.initialize(toWei(toBN(10000), 'ether'), owner)

    // ProxyStorage
    proxyStorageImpl = await ProxyStorage.new()
    proxy = await EternalStorageProxy.new(ZERO_ADDRESS, proxyStorageImpl.address)
    proxyStorage = await ProxyStorage.at(proxy.address)

    // BallotsStorage
    ballotsStorageImpl = await BallotsStorage.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, ballotsStorageImpl.address)
    ballotsStorage = await BallotsStorage.at(proxy.address)

    // BlockReward
    blockRewardImpl = await BlockReward.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, blockRewardImpl.address)
    blockReward = await BlockReward.at(proxy.address)

    // VotingToChangeBlockReward
    votingToChangeBlockRewardImpl = await VotingToChangeBlockReward.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, votingToChangeBlockRewardImpl.address)
    votingToChangeBlockReward = await VotingToChangeBlockReward.at(proxy.address)

    // VotingToChangeMinStake
    votingToChangeMinStakeImpl = await VotingToChangeMinStake.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, votingToChangeMinStakeImpl.address)
    votingToChangeMinStake = await VotingToChangeMinStake.at(proxy.address)

    // VotingToChangeMinThreshold
    votingToChangeMinThresholdImpl = await VotingToChangeMinThreshold.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, votingToChangeMinThresholdImpl.address)
    votingToChangeMinThreshold = await VotingToChangeMinThreshold.at(proxy.address)

    // VotingToChangeProxyAddress
    votingToChangeProxyImpl = await VotingToChangeProxyAddress.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, votingToChangeProxyImpl.address)
    votingToChangeProxy = await VotingToChangeProxyAddress.at(proxy.address)
  })

  describe('initialize', async () => {
    it('should be successful', async () => {
      await proxyStorage.initialize(consensus.address).should.be.fulfilled
      true.should.be.equal(await proxyStorage.isInitialized())
      consensus.address.should.be.equal(await proxyStorage.getConsensus())
    })
  })

  describe('initializeAddresses', async () => {
    beforeEach(async () => {
      await proxyStorage.initialize(consensus.address)
    })
    it('should fail if not called from owner', async () => {
      await proxyStorage.initializeAddresses(
        blockReward.address,
        ballotsStorage.address,
        votingToChangeBlockReward.address,
        votingToChangeMinStake.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxy.address,
        {from: nonOwner}
      ).should.be.rejectedWith(ERROR_MSG)
    })
    it('should be successful', async () => {
      let {logs} = await proxyStorage.initializeAddresses(
        blockReward.address,
        ballotsStorage.address,
        votingToChangeBlockReward.address,
        votingToChangeMinStake.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxy.address,
        {from: owner}
      ).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('ProxyInitialized')
      logs[0].args.consensus.should.be.equal(consensus.address)
      logs[0].args.blockReward.should.be.equal(blockReward.address)
      logs[0].args.ballotsStorage.should.be.equal(ballotsStorage.address)
      logs[0].args.votingToChangeBlockReward.should.be.equal(votingToChangeBlockReward.address)
      logs[0].args.votingToChangeMinStake.should.be.equal(votingToChangeMinStake.address)
      logs[0].args.votingToChangeMinThreshold.should.be.equal(votingToChangeMinThreshold.address)
      logs[0].args.votingToChangeProxy.should.be.equal(votingToChangeProxy.address)

      consensus.address.should.be.equal(await proxyStorage.getConsensus())
      blockReward.address.should.be.equal(await proxyStorage.getBlockReward())
      ballotsStorage.address.should.be.equal(await proxyStorage.getBallotsStorage())
      votingToChangeBlockReward.address.should.be.equal(await proxyStorage.getVotingToChangeBlockReward())
      votingToChangeMinStake.address.should.be.equal(await proxyStorage.getVotingToChangeMinStake())
      votingToChangeMinThreshold.address.should.be.equal(await proxyStorage.getVotingToChangeMinThreshold())
      votingToChangeProxy.address.should.be.equal(await proxyStorage.getVotingToChangeProxy())
    })
    it('should not be called twice', async () => {
      await proxyStorage.initializeAddresses(
        blockReward.address,
        ballotsStorage.address,
        votingToChangeBlockReward.address,
        votingToChangeMinStake.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxy.address,
        {from: owner}
      ).should.be.fulfilled

      await proxyStorage.initializeAddresses(
        blockReward.address,
        ballotsStorage.address,
        votingToChangeBlockReward.address,
        votingToChangeMinStake.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxy.address,
        {from: owner}
      ).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('setContractAddress', async () => {
    const CONTRACT_TYPES = {
      INVALID: 0,
      CONSENSUS: 1,
      BLOCK_REWARD: 2,
      BALLOTS_STORAGE: 3,
      PROXY_STORAGE: 4,
      VOTING_TO_CHANGE_BLOCK_REWARD: 5,
      VOTING_TO_CHANGE_MIN_STAKE: 6,
      VOTING_TO_CHANGE_MIN_THRESHOLD: 7,
      VOTING_TO_CHANGE_PROXY: 8
    }
    beforeEach(async () => {
      await proxyStorage.initialize(consensus.address)
      await proxyStorage.initializeAddresses(
        blockReward.address,
        ballotsStorage.address,
        votingToChangeBlockReward.address,
        votingToChangeMinStake.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxy.address,
        {from: owner}
      ).should.be.fulfilled
    })
    it.skip('should only be called by votingToChangeProxy', async () => { // TODO make it work
      await proxyStorage.setContractAddress(CONTRACT_TYPES.CONSENSUS, RANDOM_ADDRESS, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      await proxyStorage.setVotingToChangeProxyAddress(owner)
      let {logs} = await proxyStorage.setContractAddress(CONTRACT_TYPES.CONSENSUS, RANDOM_ADDRESS, {from: owner})
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('AddressSet')
      logs[0].args['contractType'].should.be.bignumber.equal(toBN(CONTRACT_TYPES.CONSENSUS))
      logs[0].args['contractAddress'].should.be.equal(RANDOM_ADDRESS)
    })
    it('should not be able to set 0x0 address', async () => {
      await proxyStorage.setVotingToChangeProxyAddress(owner)
      let {logs} = await proxyStorage.setContractAddress(CONTRACT_TYPES.CONSENSUS, ZERO_ADDRESS, {from: owner})
      logs.length.should.be.equal(0)
    })
    it('should not be able to set "Invalid" contract type', async () => {
      await proxyStorage.setVotingToChangeProxyAddress(owner)
      let {logs} = await proxyStorage.setContractAddress(CONTRACT_TYPES.INVALID, RANDOM_ADDRESS, {from: owner})
      logs.length.should.be.equal(0)
    })
  })

  describe('upgradeTo', async () => {
    let proxyStorageNew
    let proxyStorageStub = accounts[8]
    beforeEach(async () => {
      proxyStorageNew = await ProxyStorage.new()
      await proxy.setProxyStorageMock(proxyStorageStub)
    })
    it('should only be called by ProxyStorage (this)', async () => {
      await proxy.upgradeTo(proxyStorageNew.address, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      let {logs} = await proxy.upgradeTo(proxyStorageNew.address, {from: proxyStorageStub})
      logs[0].event.should.be.equal('Upgraded')
      await proxy.setProxyStorageMock(proxyStorage.address)
    })
    it('should change implementation address', async () => {
      await proxy.upgradeTo(proxyStorageNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      proxyStorageNew.address.should.be.equal(await proxy.getImplementation())
    })
    it('should increment implementation version', async () => {
      let proxyStorageOldVersion = await proxy.getVersion()
      let proxyStorageNewVersion = proxyStorageOldVersion.add(toBN(1))
      await proxy.upgradeTo(proxyStorageNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      proxyStorageNewVersion.should.be.bignumber.equal(await proxy.getVersion())
    })
    it('should work after upgrade', async () => {
      await proxy.upgradeTo(proxyStorageNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      proxyStorageNew = await ProxyStorage.at(proxy.address)
      false.should.be.equal(await proxyStorageNew.isInitialized())
      await proxyStorageNew.initialize(consensus.address).should.be.fulfilled
      true.should.be.equal(await proxyStorageNew.isInitialized())
    })
    it.skip('should use same storage after upgrade', async () => { // TODO make it work
      await proxyStorage.setConsensusMock(RANDOM_ADDRESS)
      await proxy.upgradeTo(proxyStorageNew.address, {from: proxyStorageStub})
      proxyStorageNew = await ProxyStorage.at(proxy.address)
      RANDOM_ADDRESS.should.be.equal(await proxyStorageNew.getConsensus())
    })
  })
})
