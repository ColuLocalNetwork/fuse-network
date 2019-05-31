pragma solidity ^0.4.24;

import "../../contracts/Consensus.sol";

contract ConsensusMock is Consensus {
  function setSystemAddressMock(address _newAddress) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("SYSTEM_ADDRESS"))] = _newAddress;
  }

  function addValidatorMock(address _validator) public onlyOwner {
    pendingValidatorsAdd(_validator);
  }

  function setTime(uint256 _newTime) public {
    uintStorage[keccak256(abi.encodePacked("mockTime"))] = _newTime;
  }

  function getTime() public view returns(uint256) {
    uint256 time = uintStorage[keccak256(abi.encodePacked("mockTime"))];
    if (time == 0) {
      return now;
    } else {
      return time;
    }
  }
}
