// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleToken {
    string public name;
    string public symbol;
    uint8 public decimals = 0;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply, address owner) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[owner] = _supply;
        emit Transfer(address(0), owner, _supply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}

contract TokenFactory {
    event TokenCreated(address indexed tokenAddress, string name, string symbol);

    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address owner
    ) external returns (address) {
        SimpleToken token = new SimpleToken(name, symbol, totalSupply, owner);
        emit TokenCreated(address(token), name, symbol);
        return address(token);
    }
}
