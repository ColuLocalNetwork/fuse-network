pragma solidity ^0.4.24;

import "./abstracts/ThresholdTypesEnum.sol";
import "./eternal-storage/EternalStorage.sol";
import "./eternal-storage/EternalOwnable.sol";
import "./ProxyStorage.sol";
import "./Consensus.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BallotsStorage is EternalStorage, EternalOwnable, ThresholdTypesEnum {
  using SafeMath for uint256;

  event ThresholdChanged(uint256 indexed thresholdType, uint256 newValue);

  modifier onlyVotingToChangeThreshold() {
    require(msg.sender == getVotingToChangeThreshold());
    _;
  }

  function initialize(uint256[] _thresholds) public onlyOwner {
    require(!isInitialized());
    require(_thresholds.length == uint256(ThresholdTypes.Keys));
    uint256 thresholdType = uint256(ThresholdTypes.Keys);
    for (; thresholdType <= _thresholds.length; thresholdType++) {
      uint256 thresholdValue = _thresholds[thresholdType - uint256(ThresholdTypes.Keys)];
      if (!setThreshold(thresholdValue, thresholdType)) {
        revert();
      }
    }
    setInitialized(true);
  }

  function setInitialized(bool _value) internal {
    boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _value;
  }

  function isInitialized() public view returns(bool) {
    return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
  }

  function getBallotLimitPerValidator() public view returns(uint256) {
    uint256 validatorsCount = getTotalNumberOfValidators();
    if (validatorsCount == 0) {
      return getMaxLimitBallot();
    }
    uint256 limit = getMaxLimitBallot().div(validatorsCount);
    if (limit == 0) {
      limit = 1;
    }
    return limit;
  }

  function setBallotThreshold(uint256 _value, uint256 _thresholdType) public onlyVotingToChangeThreshold returns(bool) {
    if (_value == getBallotThreshold(_thresholdType)) return false;
    if (!setThreshold(_value, _thresholdType)) return false;
    emit ThresholdChanged(_thresholdType, _value);
    return true;
  }

  function setThreshold(uint256 _value, uint256 _thresholdType) internal returns(bool) {
    if (_value == 0) return false;
    if (_thresholdType == uint256(ThresholdTypes.Invalid)) return false;
    if (_thresholdType > uint256(ThresholdTypes.Keys)) return false;
    uintStorage[keccak256(abi.encodePacked("ballotThresholds", _thresholdType))] = _value;
    return true;
  }

  function getBallotThreshold(uint256 _ballotType) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("ballotThresholds", _ballotType))];
  }

  function getProxyStorage() internal view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("proxyStorage"))];
  }

  function getVotingToChangeThreshold() public view returns(address) {
    return ProxyStorage(getProxyStorage()).getVotingToChangeMinThreshold();
  }

  function getTotalNumberOfValidators() internal view returns(uint256) {
    return Consensus(ProxyStorage(getProxyStorage()).getConsensus()).currentValidatorsLength();
  }

  function getProxyThreshold() public view returns(uint256) {
    return getTotalNumberOfValidators().div(2).add(1);
  }

  function getMaxLimitBallot() public pure returns(uint256) {
    return 200;
  }
}
