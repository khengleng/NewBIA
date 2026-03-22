// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LaunchpadEscrow {
    mapping(bytes32 => mapping(bytes32 => uint256)) public committed;
    mapping(bytes32 => mapping(bytes32 => uint256)) public allocated;

    event Commit(bytes32 indexed offeringId, bytes32 indexed investorId, uint256 amount);
    event Allocate(bytes32 indexed offeringId, bytes32 indexed investorId, uint256 tokenAmount);
    event Refund(bytes32 indexed offeringId, bytes32 indexed investorId, uint256 amount);

    function commit(bytes32 offeringId, bytes32 investorId, uint256 amount) external {
        committed[offeringId][investorId] += amount;
        emit Commit(offeringId, investorId, amount);
    }

    function allocate(bytes32 offeringId, bytes32 investorId, uint256 tokenAmount) external {
        allocated[offeringId][investorId] += tokenAmount;
        emit Allocate(offeringId, investorId, tokenAmount);
    }

    function refund(bytes32 offeringId, bytes32 investorId, uint256 amount) external {
        emit Refund(offeringId, investorId, amount);
    }
}
