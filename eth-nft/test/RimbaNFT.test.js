import { expect } from 'chai';
import { network } from 'hardhat';

describe('RimbaNFT', function () {
  let ethers;
  let rimba;
  let owner, alice;

  before(async function () {
    ({ ethers } = await network.create());
  });

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();
    rimba = await ethers.deployContract('RimbaNFT', owner);
  });

  it('memiliki nama & simbol yang benar', async function () {
    expect(await rimba.name()).to.equal('RimbaNFT');
    expect(await rimba.symbol()).to.equal('RNFT');
  });

  it('owner bisa mint dan tokenURI tersimpan', async function () {
    const uri = 'https://example.com/metadata/1.json';
    await rimba.mint(alice.address, uri);
    expect(await rimba.ownerOf(0)).to.equal(alice.address);
    expect(await rimba.tokenURI(0)).to.equal(uri);
  });

  it('nextTokenId bertambah setiap mint', async function () {
    expect(await rimba.nextTokenId()).to.equal(0);
    await rimba.mint(alice.address, 'ipfs://a');
    await rimba.mint(alice.address, 'ipfs://b');
    expect(await rimba.nextTokenId()).to.equal(2);
    expect(await rimba.tokenURI(1)).to.equal('ipfs://b');
  });

  it('menolak mint dari non-owner', async function () {
    await expect(
      rimba.connect(alice).mint(alice.address, 'ipfs://hack')
    ).to.be.revertedWithCustomError(rimba, 'OwnableUnauthorizedAccount');
  });

  it('tokenURI untuk token yang tidak ada akan revert', async function () {
    await expect(rimba.tokenURI(99)).to.be.revert(ethers);
  });
});
