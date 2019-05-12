pragma solidity ^0.4.24;

/**
 * @title Interface to be implemented by consensus contract
 * @dev abstract contract
 */
contract ValidatorSet {
    /// Issue this log event to signal a desired change in validator set.
    /// This will not lead to a change in active validator set until finalizeChange is called.
    ///
    /// Only the last log event of any block can take effect.
    /// If a signal is issued while another is being finalized it may never take effect.
    ///
    /// parentHash here should be the parent block hash, or the signal will not be recognized.
    event InitiateChange(bytes32 indexed parentHash, address[] newSet);

    /// Get current validator set (last enacted or initial if no changes ever made)
    function getValidators() public view returns(address[]);

    /// Called when an initiated change reaches finality and is activated.
    /// Only valid when msg.sender == SUPER_USER (EIP96, 2**160 - 2)
    ///
    /// Also called when the contract is first enabled for consensus. In this case, the "change" finalized is the activation of the initial set.
    function finalizeChange() public;
}