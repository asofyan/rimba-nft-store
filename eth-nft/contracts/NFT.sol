// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RimbaNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721('RimbaNFT', 'RNFT') Ownable(msg.sender) {}

    function mint(address to, string memory uri) external onlyOwner {
        uint256 tokenId = nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        nextTokenId++;
    }

    function _setTokenURI(uint256 tokenId, string memory uri) internal virtual {
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}
