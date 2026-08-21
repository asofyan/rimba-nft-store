const mongoose = require('mongoose');

// Define the NFT Schema
const nftSchema = new mongoose.Schema({
  name: String,
  description: String,
  image: String,
  metadataURL: String,
  bidPrice: Number,
  attributes: mongoose.Schema.Types.Mixed,
  minted: { type: Boolean, default: false }
});

const NFT = mongoose.model('NFT', nftSchema);
module.exports = NFT;
