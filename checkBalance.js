const { Web3 } = require('web3');
require('dotenv').config();

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL));
const account = web3.eth.accounts.privateKeyToAccount('0xef552a73cb7e19831a81405ab8bcf6c07f6052f00bbe6d7a2e67267f380ef0a0');

const checkBalance = async () => {
  const balance = await web3.eth.getBalance(account.address);
  console.log(`Balance of ${account.address}: ${web3.utils.fromWei(balance, 'ether')} ETH`);
};

checkBalance().catch(console.error);
