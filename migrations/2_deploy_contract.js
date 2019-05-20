require('dotenv').config()
const Consensus = artifacts.require('./Consensus.sol')
const BlockReward = artifacts.require('./BlockReward.sol')
const EternalStorageProxy = artifacts.require('./upgradeability/EternalStorageProxy.sol')
const {toBN, toWei} = web3.utils

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const {
  CONSENSUS_ADDRESS,
  INITIAL_VALIDATOR_ADDRESS,
  MIN_STAKE_GWEI,
  BLOCK_REWARD_GWEI
} = process.env

module.exports = function(deployer, network, accounts) {
  if (network !== 'test') {
    let initialValidatorAddress = INITIAL_VALIDATOR_ADDRESS || ZERO_ADDRESS
    let minStake = toWei(toBN(MIN_STAKE_GWEI || 0), 'gwei')
    let blockRewardAmount = toWei(toBN(BLOCK_REWARD_GWEI || 0), 'gwei')

    let owner = accounts[0]

    let proxy
    let consensusImpl, consenus
    let blockRewardImp, blockReward

    deployer.then(async function() {
      consensusImpl = await Consensus.new()
      proxy = await EternalStorageProxy.new()
      await proxy.methods['upgradeTo(uint256,address)']('1', consensusImpl.address)
      consensus = await Consensus.at(proxy.address)
      await consensus.initialize(minStake, initialValidatorAddress, owner)

      blockRewardImp = await BlockReward.new()
      proxy = await EternalStorageProxy.new()
      await proxy.methods['upgradeTo(uint256,address)']('1', blockRewardImp.address)
      blockReward = await BlockReward.at(proxy.address)
      await blockReward.initialize(blockRewardAmount, owner)

      console.log(`Consensus Implementation     .................... ${consensusImpl.address}`)
      console.log(`Consensus Proxy              .................... ${consensus.address}`)
      console.log(`Block Reward Implementation  .................... ${blockRewardImp.address}`)
      console.log(`Block Reward Proxy           .................... ${blockReward.address}`)
    }).catch(function(error) {
      console.error(error)
    })
  }
}
