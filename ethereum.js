const { Web3 } = require('web3');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Load contract ABI and address
const contractABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'eth-nft/build/contracts/RimbaNFT.json'), 'utf8')).abi;
const contractAddress = process.env.CONTRACT_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL));
const contract = new web3.eth.Contract(contractABI, contractAddress);

const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

module.exports = {
  mintNFT: async function (toAddress, metadataURI) {
    try {
      const tx = contract.methods.mint(toAddress, metadataURI);  // Ensure both parameters are passed
      const gas = await tx.estimateGas({ from: account.address });
      const gasPrice = await web3.eth.getGasPrice();
      const data = tx.encodeABI();
      const nonce = await web3.eth.getTransactionCount(account.address);

      const txData = {
        from: account.address,
        to: contractAddress,
        data: data,
        gas,
        gasPrice,
        nonce,
        chainId: 1337  // Ganache local network ID
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
