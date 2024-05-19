module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545, // Standard Ganache port
      network_id: "*", // Any network ID
    },
  },
  mocha: {
    // timeout: 100000
  },
  compilers: {
    solc: {
      version: "0.8.20", // Fetch exact version from solc-bin (default: truffle's version)
    },
  },
};
