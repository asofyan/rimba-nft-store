const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
  },
  description: {
    type: String,
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required'],
  },
  bidPrice: {
    type: Number,
    required: [true, 'Bid price is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const NFT = mongoose.model('NFT', nftSchema);

module.exports = NFT;
