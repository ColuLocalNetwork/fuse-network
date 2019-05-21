pragma solidity ^0.4.24;

import "./eternal-storage/EternalStorage.sol";
import "./eternal-storage/EternalOwnable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BlockRewardStorage is EternalStorage, EternalOwnable {
    using SafeMath for uint256;

    function systemAddress() public view returns(address) {
      return addressStorage[keccak256(abi.encodePacked("SYSTEM_ADDRESS"))];
    }

    function setSystemAddress() internal {
      addressStorage[keccak256(abi.encodePacked("SYSTEM_ADDRESS"))] = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;
    }

    function setInitialized(bool _status) internal {
      boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _status;
    }

    function isInitialized() public view returns(bool) {
      return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
    }

    function setReward(uint256 _reward) public onlyOwner {
      require(_reward >= 0);
      uintStorage[keccak256(abi.encodePacked("reward"))] = _reward;
    }

    function getReward() public view returns(uint256) {
      return uintStorage[keccak256(abi.encodePacked("reward"))];
    }
}
