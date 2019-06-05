const moment = require('moment')
const EternalStorageProxy = artifacts.require('EternalStorageProxyMock.sol')
const BlockReward = artifacts.require('BlockReward.sol')
const Consensus = artifacts.require('ConsensusMock.sol')
const ProxyStorage = artifacts.require('ProxyStorageMock.sol')
const Voting = artifacts.require('VotingMock.sol')
const {ERROR_MSG, ZERO_ADDRESS, RANDOM_ADDRESS, advanceBlocks} = require('./helpers')
const {toBN, toWei} = web3.utils

const CYCLE_DURATION_BLOCKS = 10
const SNAPSHOTS_PER_CYCLE = 2
const MIN_BALLOT_DURATION_CYCLES = 2 // 2 days

const CONTRACT_TYPES = { INVALID: 0, CONSENSUS: 1, BLOCK_REWARD: 2, PROXY_STORAGE: 3, VOTING: 4 }
const QUORUM_STATES = { INVALID: 0, IN_PROGRESS: 1, ACCEPTED: 2, REJECTED: 3 }
const ACTION_CHOICES = { INVALID: 0, ACCEPT: 1, REJECT: 2 }

contract('Voting', async (accounts) => {
  let consensus, proxy, proxyStorage
  let votingImpl, voting
  let owner = accounts[0]
  let validators = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8]]

  let voteStartAfterNumberOfCycles, voteCyclesDuration

  beforeEach(async () => {
    // Consensus
    let consensusImpl = await Consensus.new()
    proxy = await EternalStorageProxy.new(ZERO_ADDRESS, consensusImpl.address)
    consensus = await Consensus.at(proxy.address)
    await consensus.initialize(toWei(toBN(10000), 'ether'), CYCLE_DURATION_BLOCKS, SNAPSHOTS_PER_CYCLE, owner)

    // ProxyStorage
    let proxyStorageImpl = await ProxyStorage.new()
    proxy = await EternalStorageProxy.new(ZERO_ADDRESS, proxyStorageImpl.address)
    proxyStorage = await ProxyStorage.at(proxy.address)
    await proxyStorage.initialize(consensus.address)
    await consensus.setProxyStorage(proxyStorage.address)

    // BlockReward
    let blockRewardImpl = await BlockReward.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, blockRewardImpl.address)
    let blockReward = await BlockReward.at(proxy.address)
    await blockReward.initialize(toWei(toBN(10), 'ether'))

    // Voting
    votingImpl = await Voting.new()
    proxy = await EternalStorageProxy.new(proxyStorage.address, votingImpl.address)
    voting = await Voting.at(proxy.address)

    // Initialize ProxyStorage
    await proxyStorage.initializeAddresses(
      blockReward.address,
      voting.address
    )

    await consensus.setNewValidatorSetMock(validators)
    await consensus.setSystemAddressMock(owner, {from: owner})
    await consensus.finalizeChange().should.be.fulfilled

    true.should.be.equal(await voting.isValidVotingKey(validators[0]))
    true.should.be.equal(await voting.isValidVotingKey(validators[1]))
    true.should.be.equal(await voting.isValidVotingKey(validators[2]))
    true.should.be.equal(await voting.isValidVotingKey(validators[3]))
    true.should.be.equal(await voting.isValidVotingKey(validators[4]))
    true.should.be.equal(await voting.isValidVotingKey(validators[5]))
    true.should.be.equal(await voting.isValidVotingKey(validators[6]))
    true.should.be.equal(await voting.isValidVotingKey(validators[7]))
  })

  describe('initialize', async () => {
    it('should be successful', async () => {
      await voting.initialize(MIN_BALLOT_DURATION_CYCLES).should.be.fulfilled
      toBN(MIN_BALLOT_DURATION_CYCLES).should.be.bignumber.equal(await voting.getMinBallotDurationCycles())
    })
    it('should fail if min ballot duration is bigger than max ballot duration', async () => {
      let maxBallotDurationCycles = await voting.getMaxBallotDurationCycles()
      await voting.initialize(maxBallotDurationCycles.add(toBN(1))).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('newBallot', async () => {
    beforeEach(async () => {
      await voting.initialize(MIN_BALLOT_DURATION_CYCLES).should.be.fulfilled
      voteStartAfterNumberOfCycles = 1
      voteCyclesDuration = 10
    })
    it('should be successful', async () => {
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      let currentCycleEndBlock = await consensus.getCurrentCycleEndBlock()
      let voteStartAfterNumberOfBlocks = toBN(voteStartAfterNumberOfCycles).mul(toBN(CYCLE_DURATION_BLOCKS))
      let startBlock = currentCycleEndBlock.add(voteStartAfterNumberOfBlocks)
      let voteEndAfterNumberOfBlocks = toBN(voteCyclesDuration).mul(toBN(CYCLE_DURATION_BLOCKS))
      let endBlock = startBlock.add(voteEndAfterNumberOfBlocks)

      let {logs} = await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('BallotCreated')
      logs[0].args['id'].should.be.bignumber.equal(toBN(id))
      logs[0].args['creator'].should.be.equal(validators[0])
      let ballotInfo = await voting.getBallotInfo(id, validators[0])
      ballotInfo.startBlock.should.be.bignumber.equal(startBlock)
      ballotInfo.endBlock.should.be.bignumber.equal(endBlock)
      ballotInfo.totalVoters.should.be.bignumber.equal(toBN(0))
      ballotInfo.isFinalized.should.be.equal(false)
      ballotInfo.proposedValue.should.be.equal(proposedValue)
      ballotInfo.contractType.should.be.bignumber.equal(toBN(contractType))
      ballotInfo.creator.should.be.equal(validators[0])
      ballotInfo.description.should.be.equal('description')
      ballotInfo.canBeFinalizedNow.should.be.equal(false)
      ballotInfo.alreadyVoted.should.be.equal(false)
      toBN(QUORUM_STATES.IN_PROGRESS).should.be.bignumber.equal(await voting.getQuorumState(id))
      toBN(0).should.be.bignumber.equal(await voting.getIndex(id))
    })
    it('should fail if not called by valid voting key', async () => {
      let nonVotingKey = owner
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: nonVotingKey}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if duration is invalid', async () => {
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS

      // require(_startAfterNumberOfCycles > 0);
      await voting.newBallot(0, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)

      // require (_cyclesDuration > 0);
      await voting.newBallot(voteStartAfterNumberOfCycles, 0, contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)

      // require(_cyclesDuration >= getMinBallotDurationCycles());
      let minBallotDurationCycles = await voting.getMinBallotDurationCycles()
      await voting.newBallot(voteStartAfterNumberOfCycles, minBallotDurationCycles.sub(toBN(1)), contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)

      // require(_cyclesDuration <= getMaxBallotDurationCycles());
      let maxBallotDurationCycles = await voting.getMaxBallotDurationCycles()
      await voting.newBallot(voteStartAfterNumberOfCycles, maxBallotDurationCycles.add(toBN(1)), contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if proposed value is invalid', async () => {
      // require(_proposedValue != address(0));
      let proposedValue = ZERO_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if contract type is invalid', async () => {
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.INVALID
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if creating ballot over the ballots limit', async () => {
      let maxLimitOfBallots = (await voting.getMaxLimitOfBallots()).toNumber()
      let validatorsCount = (await consensus.currentValidatorsLength()).toNumber()
      let ballotLimitPerValidator = (await voting.getBallotLimitPerValidator()).toNumber()
      ballotLimitPerValidator.should.be.equal(Math.floor(maxLimitOfBallots / validatorsCount))
      // create ballots successfully up to the limit
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      for (let i = 0; i < ballotLimitPerValidator; i++) {
        let {logs} = await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      }
      // create a ballot over the limit should fail
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      // create a ballot with different key successfully
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[1]}).should.be.fulfilled
    })
  })

  describe('vote', async () => {
    let id, proposedValue, contractType
    beforeEach(async () => {
      await voting.initialize(MIN_BALLOT_DURATION_CYCLES).should.be.fulfilled
      voteStartAfterNumberOfCycles = 1
      voteCyclesDuration = 10
      id = await voting.getNextBallotId()
      proposedValue = RANDOM_ADDRESS
      contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
    })
    it('should vote "accept" successfully', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      let {logs} = await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('Vote')
      logs[0].args['id'].should.be.bignumber.equal(id)
      logs[0].args['decision'].should.be.bignumber.equal(toBN(ACTION_CHOICES.ACCEPT))
      logs[0].args['voter'].should.be.equal(validators[0])
      toBN(1).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.ACCEPT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[0]))
    })
    it('should vote "reject" successfully', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      let {logs} = await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[0]}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('Vote')
      logs[0].args['id'].should.be.bignumber.equal(id)
      logs[0].args['decision'].should.be.bignumber.equal(toBN(ACTION_CHOICES.REJECT))
      logs[0].args['voter'].should.be.equal(validators[0])
      toBN(1).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.REJECT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[0]))
    })
    it('multiple voters should vote successfully', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      toBN(1).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.ACCEPT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[0]))

      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
      toBN(2).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.ACCEPT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[1]))

      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
      toBN(3).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.REJECT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[2]))

      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[3]}).should.be.fulfilled
      toBN(4).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.REJECT).should.be.bignumber.equal(await voting.getVoterChoice(id, validators[3]))
    })
    it('should be successful even if called by non validator', async () => {
      let nonValidatorKey = owner
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: nonValidatorKey}).should.be.fulfilled
      toBN(1).should.be.bignumber.equal(await voting.getTotalVoters(id))
      toBN(ACTION_CHOICES.ACCEPT).should.be.bignumber.equal(await voting.getVoterChoice(id, nonValidatorKey))
    })
    it('should fail if voting before start time', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.sub(toBN(1)).toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if voting after end time', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteEndBlock = await voting.getEndBlock(id)
      let blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if trying to vote twice', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if trying to vote with invalid choice', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.INVALID, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      await voting.vote(id, Object.keys(ACTION_CHOICES).length + 1, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if trying to vote for invalid id', async () => {
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id.toNumber() + 1, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      await voting.vote(id.toNumber() - 1, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('finalize', async () => {
    beforeEach(async () => {
      await voting.initialize(MIN_BALLOT_DURATION_CYCLES).should.be.fulfilled
      voteStartAfterNumberOfCycles = 1
      voteCyclesDuration = 10
    })
    it('should change to proposed value successfully if quorum is reached', async () => {
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
      let voteEndBlock = await voting.getEndBlock(id)
      blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      let {logs} = await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('BallotFinalized')
      logs[0].args['id'].should.be.bignumber.equal(id)
      logs[0].args['finalizer'].should.be.equal(validators[0])
      toBN(0).should.be.bignumber.equal(await voting.activeBallotsLength())
      let ballotInfo = await voting.getBallotInfo(id, validators[0])
      ballotInfo.startBlock.should.be.bignumber.equal(voteStartBlock)
      ballotInfo.endBlock.should.be.bignumber.equal(voteEndBlock)
      ballotInfo.totalVoters.should.be.bignumber.equal(toBN(3))
      ballotInfo.isFinalized.should.be.equal(true)
      ballotInfo.proposedValue.should.be.equal(proposedValue)
      ballotInfo.contractType.should.be.bignumber.equal(toBN(contractType))
      ballotInfo.creator.should.be.equal(validators[0])
      ballotInfo.description.should.be.equal('description')
      ballotInfo.canBeFinalizedNow.should.be.equal(false)
      ballotInfo.alreadyVoted.should.be.equal(true)
      toBN(QUORUM_STATES.ACCEPTED).should.be.bignumber.equal(await voting.getQuorumState(id))
      toBN(0).should.be.bignumber.equal(await voting.getIndex(id))
      proposedValue.should.be.equal(await (await EternalStorageProxy.at(await proxyStorage.getConsensus())).getImplementation())
    })
    it('should not change to proposed value if quorum is not reached', async () => {
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[1]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
      currentBlock = await voting.getCurrentBlockNumber()
      let voteEndBlock = await voting.getEndBlock(id)
      blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      let {logs} = await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('BallotFinalized')
      logs[0].args['id'].should.be.bignumber.equal(id)
      logs[0].args['finalizer'].should.be.equal(validators[0])
      toBN(0).should.be.bignumber.equal(await voting.activeBallotsLength())
      let ballotInfo = await voting.getBallotInfo(id, validators[0])
      ballotInfo.startBlock.should.be.bignumber.equal(voteStartBlock)
      ballotInfo.endBlock.should.be.bignumber.equal(voteEndBlock)
      ballotInfo.totalVoters.should.be.bignumber.equal(toBN(3))
      ballotInfo.isFinalized.should.be.equal(true)
      ballotInfo.proposedValue.should.be.equal(proposedValue)
      ballotInfo.contractType.should.be.bignumber.equal(toBN(contractType))
      ballotInfo.creator.should.be.equal(validators[0])
      ballotInfo.description.should.be.equal('description')
      ballotInfo.canBeFinalizedNow.should.be.equal(false)
      ballotInfo.alreadyVoted.should.be.equal(true)
      toBN(QUORUM_STATES.REJECTED).should.be.bignumber.equal(await voting.getQuorumState(id))
      toBN(0).should.be.bignumber.equal(await voting.getIndex(id))
      proposedValue.should.not.be.equal(await (await EternalStorageProxy.at(await proxyStorage.getConsensus())).getImplementation())
    })
    it('should fail if trying to finalize twice', async () => {
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteStartBlock = await voting.getStartBlock(id)
      let blocksToAdvance = voteStartBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.toNumber())
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
      await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
      currentBlock = await voting.getCurrentBlockNumber()
      let voteEndBlock = await voting.getEndBlock(id)
      blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
      await voting.finalize(id, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should be allowed after end time has passed even if not all voters have voted', async () => {
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteEndBlock = await voting.getEndBlock(id)
      let blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
    })
    it('should fail if not called by valid voting key', async () => {
      let nonValidatorKey = owner
      let id = await voting.getNextBallotId()
      let proposedValue = RANDOM_ADDRESS
      let contractType = CONTRACT_TYPES.CONSENSUS
      await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
      let currentBlock = await voting.getCurrentBlockNumber()
      let voteEndBlock = await voting.getEndBlock(id)
      let blocksToAdvance = voteEndBlock.sub(currentBlock)
      await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
      await voting.finalize(id, {from: nonValidatorKey}).should.be.rejectedWith(ERROR_MSG)
    })
    describe('should change all contract types implementations', async () => {
      it('consensus', async () => {
        let id = await voting.getNextBallotId()
        let proposedValue = RANDOM_ADDRESS
        let contractType = CONTRACT_TYPES.CONSENSUS
        await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
        let currentBlock = await voting.getCurrentBlockNumber()
        let voteStartBlock = await voting.getStartBlock(id)
        let blocksToAdvance = voteStartBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.toNumber())
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
        currentBlock = await voting.getCurrentBlockNumber()
        let voteEndBlock = await voting.getEndBlock(id)
        blocksToAdvance = voteEndBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
        await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
        proposedValue.should.be.equal(await (await EternalStorageProxy.at(await proxyStorage.getConsensus())).getImplementation())
      })
      it('block reward', async () => {
        let id = await voting.getNextBallotId()
        let proposedValue = RANDOM_ADDRESS
        let contractType = CONTRACT_TYPES.BLOCK_REWARD
        await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
        let currentBlock = await voting.getCurrentBlockNumber()
        let voteStartBlock = await voting.getStartBlock(id)
        let blocksToAdvance = voteStartBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.toNumber())
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
        currentBlock = await voting.getCurrentBlockNumber()
        let voteEndBlock = await voting.getEndBlock(id)
        blocksToAdvance = voteEndBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
        await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
        proposedValue.should.be.equal(await (await EternalStorageProxy.at(await proxyStorage.getBlockReward())).getImplementation())
      })
      it('proxy storage', async () => {
        let id = await voting.getNextBallotId()
        let proposedValue = RANDOM_ADDRESS
        let contractType = CONTRACT_TYPES.PROXY_STORAGE
        await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
        let currentBlock = await voting.getCurrentBlockNumber()
        let voteStartBlock = await voting.getStartBlock(id)
        let blocksToAdvance = voteStartBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.toNumber())
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
        currentBlock = await voting.getCurrentBlockNumber()
        let voteEndBlock = await voting.getEndBlock(id)
        blocksToAdvance = voteEndBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
        await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
        proposedValue.should.be.equal(await (await EternalStorageProxy.at(proxyStorage.address)).getImplementation())
      })
      it('voting', async () => {
        let id = await voting.getNextBallotId()
        let proposedValue = RANDOM_ADDRESS
        let contractType = CONTRACT_TYPES.VOTING
        await voting.newBallot(voteStartAfterNumberOfCycles, voteCyclesDuration, contractType, proposedValue, 'description', {from: validators[0]}).should.be.fulfilled
        let currentBlock = await voting.getCurrentBlockNumber()
        let voteStartBlock = await voting.getStartBlock(id)
        let blocksToAdvance = voteStartBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.toNumber())
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[0]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.ACCEPT, {from: validators[1]}).should.be.fulfilled
        await voting.vote(id, ACTION_CHOICES.REJECT, {from: validators[2]}).should.be.fulfilled
        currentBlock = await voting.getCurrentBlockNumber()
        let voteEndBlock = await voting.getEndBlock(id)
        blocksToAdvance = voteEndBlock.sub(currentBlock)
        await advanceBlocks(blocksToAdvance.add(toBN(1)).toNumber())
        await voting.finalize(id, {from: validators[0]}).should.be.fulfilled
        proposedValue.should.be.equal(await (await EternalStorageProxy.at(await proxyStorage.getVoting())).getImplementation())
      })
    })
  })

  describe('upgradeTo', async () => {
    let votingOldImplementation, votingNew
    let proxyStorageStub = accounts[13]
    beforeEach(async () => {
      voting = await Voting.new()
      votingOldImplementation = voting.address
      proxy = await EternalStorageProxy.new(proxyStorage.address, voting.address)
      voting = await Voting.at(proxy.address)
      votingNew = await Voting.new()
    })
    it('should only be called by ProxyStorage', async () => {
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      let {logs} = await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      logs[0].event.should.be.equal('Upgraded')
      await proxy.setProxyStorageMock(proxyStorage.address)
    })
    it('should change implementation address', async () => {
      votingOldImplementation.should.be.equal(await proxy.getImplementation())
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      votingNew.address.should.be.equal(await proxy.getImplementation())
    })
    it('should increment implementation version', async () => {
      let votingOldVersion = await proxy.getVersion()
      let votingNewVersion = votingOldVersion.add(toBN(1))
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      votingNewVersion.should.be.bignumber.equal(await proxy.getVersion())
    })
    it('should work after upgrade', async () => {
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      await proxy.setProxyStorageMock(proxyStorage.address)
      votingNew = await Voting.at(proxy.address)
      false.should.be.equal(await votingNew.isInitialized())
      await votingNew.initialize(MIN_BALLOT_DURATION_CYCLES).should.be.fulfilled
      true.should.be.equal(await votingNew.isInitialized())
    })
    it('should use same proxyStorage after upgrade', async () => {
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      votingNew = await Voting.at(proxy.address)
      proxyStorageStub.should.be.equal(await votingNew.getProxyStorage())
    })
    it('should use same storage after upgrade', async () => {
      let newValue = MIN_BALLOT_DURATION_CYCLES + 1
      await voting.setMinBallotDurationCyclesMock(newValue)
      await proxy.setProxyStorageMock(proxyStorageStub)
      await proxy.upgradeTo(votingNew.address, {from: proxyStorageStub})
      votingNew = await Voting.at(proxy.address)
      toBN(newValue).should.be.bignumber.equal(await votingNew.getMinBallotDurationCycles())
    })
  })
})
