import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  plugins: [hardhatEthers, hardhatToolboxMochaEthers],
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache-hardhat',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainId: 1337,
    },
    // Jalankan ganache dulu:
    // npx ganache --port 8545 --wallet.accounts="0x<PRIVATE_KEY>,0x3635C9ADC5DEA00000"
    ganache: {
      type: 'http',
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },
  },
};

export default config;
