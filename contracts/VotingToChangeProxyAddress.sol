pragma solidity ^0.4.24;

import "./Voting.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract VotingToChangeProxyAddress is Voting {

  function initialize(uint256 _minBallotDuration) public {
    init(_minBallotDuration);
  }

  function newBallot(uint256 _startTime, uint256 _endTime, uint256 _proposedValue, string _description) public {

  }

  function getBallotInfo(uint256 _id, address _votingKey) public view returns(uint256 startTime, uint256 endTime, uint256 totalVoters, int256 progress, bool isFinalized, uint256 proposedValue, address creator, string description, bool canBeFinalizedNow, bool alreadyVoted) {

  }

  function finalizeBallotInner(uint256 _id) internal returns(bool) {

  }

  function getProposedValue(uint256 _id) internal view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("votingState", _id, "proposedValue"))];
  }

  function setProposedValue(uint256 _id, uint256 _value) private {
    uintStorage[keccak256(abi.encodePacked("votingState", _id, "proposedValue"))] = _value;
  }
}
