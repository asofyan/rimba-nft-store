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

console.log(`Using account: ${account.address}`);  // Log the address

module.exports = {
  mintNFT: async function (toAddress, metadataURI) {
    try {
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

      const txData = {
        from: account.address,
        to: contractAddress,
        data: data,
        gas: gas.toString(),
        gasPrice: gasPrice.toString(),
        nonce: nonce.toString(),
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
