pragma solidity ^0.4.24;

contract VotingEnums {

    enum BallotTypes {
        Invalid,
        MinStake,
        MinThreshold,
        BlockReward,
        ProxyAddress
    }

    enum QuorumStates {
      Invalid,
      InProgress,
      Accepted,
      Rejected
    }

    enum ActionChoice {
      Invalid,
      Accept,
      Reject
    }
}