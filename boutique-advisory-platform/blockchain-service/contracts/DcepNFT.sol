// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DcepNFT {
    string public name;
    string public symbol;
    address public issuer;

    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => string) public moneyTypeOf;
    mapping(uint256 => string) public serialOf;
    mapping(uint256 => string) public signatureOf;

    mapping(address => uint256[]) private ownedTokens;
    mapping(uint256 => uint256) private ownedTokensIndex;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyIssuer() {
        require(msg.sender == issuer, "issuer_only");
        _;
    }

    constructor(address _issuer, string memory _name, string memory _symbol) {
        issuer = _issuer;
        name = _name;
        symbol = _symbol;
    }

    function mint(
        address to,
        uint256 tokenId,
        string memory moneyType,
        string memory serialNumber,
        string memory signature
    ) external onlyIssuer {
        require(to != address(0), "invalid_to");
        require(ownerOf[tokenId] == address(0), "token_exists");

        ownerOf[tokenId] = to;
        moneyTypeOf[tokenId] = moneyType;
        serialOf[tokenId] = serialNumber;
        signatureOf[tokenId] = signature;
        _addTokenToOwner(to, tokenId);

        emit Transfer(address(0), to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(to != address(0), "invalid_to");
        require(ownerOf[tokenId] == from, "not_owner");
        require(msg.sender == from || msg.sender == issuer, "not_authorized");

        ownerOf[tokenId] = to;
        _removeTokenFromOwner(from, tokenId);
        _addTokenToOwner(to, tokenId);

        emit Transfer(from, to, tokenId);
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return ownedTokens[owner];
    }

    function tokenData(uint256 tokenId)
        external
        view
        returns (
            address owner,
            string memory moneyType,
            string memory serialNumber,
            string memory signature
        )
    {
        return (ownerOf[tokenId], moneyTypeOf[tokenId], serialOf[tokenId], signatureOf[tokenId]);
    }

    function _addTokenToOwner(address owner, uint256 tokenId) internal {
        ownedTokensIndex[tokenId] = ownedTokens[owner].length;
        ownedTokens[owner].push(tokenId);
    }

    function _removeTokenFromOwner(address owner, uint256 tokenId) internal {
        uint256 lastIndex = ownedTokens[owner].length - 1;
        uint256 index = ownedTokensIndex[tokenId];
        if (index != lastIndex) {
            uint256 lastTokenId = ownedTokens[owner][lastIndex];
            ownedTokens[owner][index] = lastTokenId;
            ownedTokensIndex[lastTokenId] = index;
        }
        ownedTokens[owner].pop();
        delete ownedTokensIndex[tokenId];
    }
}
