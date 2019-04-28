const Consensus = artifacts.require('Consensus.sol')
const {ERROR_MSG} = require('./helpers')

const MIN_STAKE = web3.toWei(10000, 'ether')
const HALF_MIN_STAKE = web3.toWei(5000, 'ether')
const EXACTLY_MIN_STAKE = MIN_STAKE
const MORE_THAN_MIN_STAKE = web3.toWei(10001, 'ether')
const SYSTEM_ADDRESS = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE'

contract('Consensus', async (accounts) => {
  let consensus
  let owner = accounts[0]
  let nonOwner = accounts[1]
  let firstCandidate = accounts[1]
  let secondCandidate = accounts[2]

  beforeEach(async () => {
    consensus = await Consensus.new(MIN_STAKE)
  })
  describe('initialize', async () => {
    it('default values', async () => {
      web3.toChecksumAddress(SYSTEM_ADDRESS).should.be.equal(web3.toChecksumAddress(await consensus.SYSTEM_ADDRESS()))
      false.should.be.equal(await consensus.finalized())
      MIN_STAKE.should.be.bignumber.equal(await consensus.minStake())
      owner.should.equal(await consensus.owner())
      let validators = await consensus.getValidators()
      validators.length.should.be.equal(0)
      let pendingValidators = await consensus.getPendingValidators()
      pendingValidators.length.should.be.equal(0)
    })
    it('only owner can set minStake', async () => {
      await consensus.setMinStake(HALF_MIN_STAKE, {from: nonOwner}).should.be.rejectedWith(ERROR_MSG)
      MIN_STAKE.should.be.bignumber.equal(await consensus.minStake())

      await consensus.setMinStake(HALF_MIN_STAKE, {from: owner})
      HALF_MIN_STAKE.should.be.bignumber.equal(await consensus.minStake())
    })
  })
  describe('finalizeChange', async () => {
    it('should only be called by SYSTEM_ADDRESS', async () => {
      await consensus.finalizeChange().should.be.rejectedWith(ERROR_MSG)
      await consensus.setSystemAddress(accounts[0], {from: owner})
      await consensus.finalizeChange().should.be.fulfilled
    })
    it('should set finalized to true', async () => {
      false.should.be.equal(await consensus.finalized())
      await consensus.setSystemAddress(accounts[0])
      await consensus.finalizeChange().should.be.fulfilled
      true.should.be.equal(await consensus.finalized())
    })
  })
  describe('stake using payable', async () => {
    describe('basic', async () => {
      it('should no allow zero stake', async () => {
        await consensus.send(0, {from: firstCandidate}).should.be.rejectedWith(ERROR_MSG)
      })
      it('less than minimum stake', async () => {
        const {logs} = await consensus.sendTransaction({from: firstCandidate, value: HALF_MIN_STAKE})

        // contract balance should be updated
        HALF_MIN_STAKE.should.be.bignumber.equal(await web3.eth.getBalance(consensus.address))

        // sender stake amount should be updated
        HALF_MIN_STAKE.should.be.bignumber.equal(await consensus.getStakeAmount(firstCandidate))

        // pending validators should not be updated
        let pendingValidators = await consensus.getPendingValidators()
        pendingValidators.length.should.be.equal(0)

        // InitiateChange should not be emitted
        logs.length.should.be.equal(0)
      })
      it('more than minimum stake', async () => {
        const {logs} = await consensus.sendTransaction({from: firstCandidate, value: MORE_THAN_MIN_STAKE})

        // contract balance should be updated
        MORE_THAN_MIN_STAKE.should.be.bignumber.equal(await web3.eth.getBalance(consensus.address))

        // sender stake amount should be updated
        MORE_THAN_MIN_STAKE.should.be.bignumber.equal(await consensus.getStakeAmount(firstCandidate))

        // validators state should be updated
        let validatorState = await consensus.validatorsState(firstCandidate)
        validatorState[0].should.be.equal(true)          // isValidator
        validatorState[1].should.be.equal(false)         // isValidatorFinalized
        validatorState[2].should.be.bignumber.equal(0)   // index

        // pending validators should be updated
        let pendingValidators = await consensus.getPendingValidators()
        pendingValidators.length.should.be.equal(1)
        pendingValidators[0].should.be.equal(firstCandidate)

        // finalized should be updated to false
        false.should.be.equal(await consensus.finalized())

        // should emit InitiateChange with blockhash and pendingValidators
        logs[0].event.should.be.equal('InitiateChange')
        logs[0].args['newSet'].should.deep.equal(pendingValidators)
      })
    })
    describe('advanced', async () => {
      it('get to minimum stake amount in more than one transaction', async () => {
        // TODO accumulative amount up to minStake
      })
      it('should be added to pending validators multiple times according to staked amount', async () => {
        // TODO if stakeAmount > minStake should be added as validator X times (where X = stakeAmount/minStake)
      })
    })
  })
  describe('withdraw', async () => {
    // TODO withdrawal functionality (should be able to withdraw everything ?! or part of it and update validators list accordingly ?!)
  })
})