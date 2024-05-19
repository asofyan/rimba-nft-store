const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const ethereum = require('../ethereum');

dotenv.config();

const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Define the NFT Schema
const nftSchema = new mongoose.Schema({
  name: String,
  description: String,
  image: String,
  metadataURL: String,
  bidPrice: Number,
  minted: { type: Boolean, default: false }
});

// Create the NFT model
const NFT = mongoose.model('NFT', nftSchema);

/**
 * @swagger
 * /api/nfts:
 *   post:
 *     summary: Add a new NFT asset and generate metadata
 *     description: Add a new NFT asset, save the file, generate metadata, and save the metadata to a JSON file. Update the NFT record with the metadata URL.
 *     tags:
 *       - NFTs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               attributes:
 *                 type: string
 *               bidPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: NFT asset added successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       500:
 *         description: Server error.
 */
router.post('/nfts', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, description, attributes, bidPrice } = req.body;
    const imagePath = req.file.path;
    const metadata = {
      name: name,
      description: description,
      image: `${process.env.PROJECT_URL}/${imagePath}`,
      attributes: JSON.parse(attributes)
    };

    const metadataFilename = `metadata-${Date.now()}.json`;
    const metadataPath = path.join('metadata', metadataFilename);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const metadataURL = `${process.env.PROJECT_URL}/${metadataPath}`;

    const nftRecord = new NFT({
      name: name,
      description: description,
      image: metadata.image,
      metadataURL: metadataURL,
      bidPrice: bidPrice
    });

    const savedNFT = await nftRecord.save();

    res.status(201).json({ message: 'NFT asset added successfully', nftRecord: savedNFT });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/nfts/mint:
 *   post:
 *     summary: Mint a new NFT
 *     description: Mint a new NFT to a specified address using the metadata URL.
 *     tags:
 *       - NFTs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toAddress:
 *                 type: string
 *               metadataURI:
 *                 type: string
 *     responses:
 *       201:
 *         description: NFT minted successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       500:
 *         description: Server error.
 */
router.post('/nfts/mint', authenticateToken, async (req, res) => {
  try {
    const { toAddress, metadataURI } = req.body;
    const receipt = await ethereum.mintNFT(toAddress, metadataURI);  // Ensure both parameters are passed
    
    // Update the NFT record as minted
    await NFT.findOneAndUpdate({ metadataURL: metadataURI }, { minted: true });

    res.status(201).json({ message: 'NFT minted successfully', receipt });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/nfts:
 *   get:
 *     summary: List all uploaded NFTs with their minting status
 *     description: Retrieve a list of all uploaded NFTs with their status (not minted or minted).
 *     tags:
 *       - NFTs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all uploaded NFTs with their status.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   image:
 *                     type: string
 *                   metadataURL:
 *                     type: string
 *                   bidPrice:
 *                     type: number
 *                   minted:
 *                     type: boolean
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       500:
 *         description: Server error.
 */
router.get('/nfts', authenticateToken, async (req, res) => {
  try {
    const nfts = await NFT.find({});
    res.status(200).json(nfts);
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/nfts/{id}:
 *   put:
 *     summary: Edit an uploaded NFT asset
 *     description: Edit an uploaded NFT asset.
 *     tags:
 *       - NFTs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The NFT ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               bidPrice:
 *                 type: number
 *               attributes:
 *                 type: string
 *     responses:
 *       200:
 *         description: NFT asset updated successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       404:
 *         description: NFT not found.
 *       500:
 *         description: Server error.
 */
router.put('/nfts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, bidPrice, attributes } = req.body;

    const nft = await NFT.findById(id);
    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    nft.name = name;
    nft.description = description;
    nft.bidPrice = bidPrice;
    nft.attributes = JSON.parse(attributes);

    await nft.save();

    res.status(200).json({ message: 'NFT asset updated successfully', nftRecord: nft });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
