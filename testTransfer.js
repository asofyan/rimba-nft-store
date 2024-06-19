const { Web3 } = require('web3');
require('dotenv').config();

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL));

const fromAddress = '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98';  // Replace with your funded Ganache account address
const toAddress = '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98';      // Replace with your destination address
const privateKey = '0xef552a73cb7e19831a81405ab8bcf6c07f6052f00bbe6d7a2e67267f380ef0a0';    // Replace with your private key for the fromAddress

const sendTransaction = async () => {
  const amount = web3.utils.toWei('1', 'ether');  // Amount to send (1 ether)
  
  const tx = {
    from: fromAddress,
    to: toAddress,
    value: amount,
    gas: 21000,
    gasPrice: await web3.eth.getGasPrice(),
    nonce: await web3.eth.getTransactionCount(fromAddress, 'latest')
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log('Transaction receipt:', receipt);
};

sendTransaction().catch(console.error);
