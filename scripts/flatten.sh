#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir flats

./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
./node_modules/.bin/truffle-flattener contracts/Consensus.sol > flats/Consensus_flat.sol
./node_modules/.bin/truffle-flattener contracts/BlockReward.sol > flats/BlockReward_flat.sol
./node_modules/.bin/truffle-flattener contracts/VotingToChangeMinStake.sol > flats/VotingToChangeMinStake_flat.sol
./node_modules/.bin/truffle-flattener contracts/VotingToChangeMinThreshold.sol > flats/VotingToChangeMinThreshold_flat.sol
./node_modules/.bin/truffle-flattener contracts/VotingToChangeReward.sol > flats/VotingToChangeReward_flat.sol
