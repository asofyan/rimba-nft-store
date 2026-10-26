const { Web3 } = require('web3');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL || 'http://127.0.0.1:8545'));

// Lazy-load contract: ABI & address baru dibaca saat pertama kali dipakai,
// agar server tetap bisa start meskipun contract belum di-compile/deploy.
let _contract = null;

function getContract() {
  if (_contract) return _contract;

  // Cari artifact: Hardhat (utama) atau Truffle (legacy)
  const candidates = [
    path.resolve(__dirname, 'eth-nft/artifacts/contracts/NFT.sol/RimbaNFT.json'),
    path.resolve(__dirname, 'eth-nft/build/contracts/RimbaNFT.json'),
  ];
  const buildPath = candidates.find((p) => fs.existsSync(p));
  if (!buildPath) {
    throw new Error(
      'Contract build not found. Run "npx hardhat compile" in eth-nft/ first.'
    );
  }

  const contractABI = JSON.parse(fs.readFileSync(buildPath, 'utf8')).abi;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS is not set in .env — deploy the contract first.');
  }

  _contract = new web3.eth.Contract(contractABI, contractAddress);
  return _contract;
}

async function getAccount() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in .env');
  }
  const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
  if (!web3.eth.accounts.wallet.find(a => a.address === account.address)) {
    web3.eth.accounts.wallet.add(account);
  }
  return account;
}

module.exports = {
  getBalance: async function (address) {
    if (!web3.utils.isAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
    const balanceWei = await web3.eth.getBalance(address);
    return web3.utils.fromWei(balanceWei, 'ether');
  },

  // Jumlah token RimbaNFT yang dipegang sebuah address (on-chain balanceOf).
  // Return null jika kontrak belum dideploy / address tidak valid.
  getNftCount: async function (address) {
    if (!web3.utils.isAddress(address)) return null;
    try {
      const contract = getContract();
      const count = await contract.methods.balanceOf(address).call();
      return Number(count);
    } catch (error) {
      return null;
    }
  },

  mintNFT: async function (toAddress, metadataURI) {
    try {
      const contract = getContract();
      const account = await getAccount();
      const contractAddress = process.env.CONTRACT_ADDRESS;

      if (!web3.utils.isAddress(toAddress)) {
        throw new Error(`Invalid Ethereum address: ${toAddress}`);
      }

      const tx = contract.methods.mint(toAddress, metadataURI);
      const gas = BigInt(await tx.estimateGas({ from: account.address }));
      const gasPrice = BigInt(await web3.eth.getGasPrice());
      const data = tx.encodeABI();
      const nonce = BigInt(await web3.eth.getTransactionCount(account.address));
      const balance = BigInt(await web3.eth.getBalance(account.address));

      const transactionCost = gas * gasPrice;
      console.log(`Gas: ${gas.toString()}, Gas Price: ${gasPrice.toString()}, Transaction Cost: ${transactionCost.toString()}, Balance: ${balance.toString()}`);

      if (balance < transactionCost) {
        throw new Error('Insufficient funds for gas * price + value');
      }

      const chainId = await web3.eth.getChainId();
      const txData = {
        from: account.address,
        to: contractAddress,
        data: data,
        gas: gas.toString(),
        gasPrice: gasPrice.toString(),
        nonce: nonce.toString(),
        chainId: Number(chainId)
      };

      const signedTx = await web3.eth.accounts.signTransaction(txData, account.privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      return receipt;
    } catch (error) {
      console.error('Minting NFT failed:', error);
      throw error;
    }
  }
};
