const express = require('express');
const { query, body, param, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const ethereum = require('../ethereum');
const ipfs = require('../services/ipfs');
const User = require('../models/User');
const NFT = require('../models/NFT');

dotenv.config();

const router = express.Router();

// Middleware kecil untuk memeriksa hasil validasi express-validator
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array().map(e => e.msg) });
  }
  next();
};

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
router.post(
  '/nfts',
  authenticateToken,
  requireRole('Admin'),
  upload.single('image'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  validate,
  async (req, res, next) => {
    try {
      const { name, description, attributes, bidPrice } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      let parsedAttributes;
      try {
        parsedAttributes = attributes ? JSON.parse(attributes) : [];
      } catch (e) {
        return res.status(400).json({ error: 'Attributes must be valid JSON' });
      }

      // Upload image & metadata ke IPFS jika Pinata dikonfigurasi (PINATA_JWT),
      // fallback: simpan di disk lokal (uploads/ & metadata/).
      const imageBuffer = await fs.promises.readFile(req.file.path);
      const pinnedImage = await ipfs.pinFile(imageBuffer, req.file.filename);
      const imageUrl = pinnedImage ? pinnedImage.url : `${process.env.PROJECT_URL}/${req.file.path}`;

      const metadata = {
        name: name,
        description: description,
        image: imageUrl,
        attributes: parsedAttributes
      };

      const pinnedMetadata = await ipfs.pinJSON(metadata);
      let metadataURL;
      if (pinnedMetadata) {
        metadataURL = pinnedMetadata.url;
      } else {
        const metadataFilename = `metadata-${Date.now()}.json`;
        const metadataPath = path.join('metadata', metadataFilename);
        await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        metadataURL = `${process.env.PROJECT_URL}/${metadataPath}`;
      }

      const nftRecord = new NFT({
        name: name,
        description: description,
        image: metadata.image,
        metadataURL: metadataURL,
        bidPrice: bidPrice,
        attributes: parsedAttributes
      });

      const savedNFT = await nftRecord.save();

      res.status(201).json({ message: 'NFT asset added successfully', nftRecord: savedNFT });
    } catch (error) {
      next(error);
    }
  }
);

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
router.post(
  '/nfts/mint',
  authenticateToken,
  requireRole('Admin'),
  body('metadataURI').trim().notEmpty().withMessage('metadataURI is required'),
  validate,
  async (req, res, next) => {
    try {
      const { metadataURI } = req.body;

      // Retrieve the authenticated user's Ethereum address
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const receipt = await ethereum.mintNFT(user.ethAddress, metadataURI);

      // Update the NFT record as minted
      await NFT.findOneAndUpdate({ metadataURL: metadataURI }, { minted: true });

      res.status(201).json({ message: 'NFT minted successfully', receipt });
    } catch (error) {
      next(error);
    }
  }
);

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
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       500:
 *         description: Server error.
 */
router.get('/nfts', authenticateToken, async (req, res, next) => {
  try {
    const nfts = await NFT.find({});
    res.status(200).json(nfts);
  } catch (error) {
    next(error);
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
router.put(
  '/nfts/:id',
  authenticateToken,
  requireRole('Admin'),
  param('id').isMongoId().withMessage('Invalid NFT ID'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description, bidPrice, attributes } = req.body;

      let parsedAttributes;
      if (attributes !== undefined) {
        try {
          parsedAttributes = JSON.parse(attributes);
        } catch (e) {
          return res.status(400).json({ error: 'Attributes must be valid JSON' });
        }
      }

      const nft = await NFT.findById(id);
      if (!nft) {
        return res.status(404).json({ error: 'NFT not found' });
      }

      // Partial update: only overwrite fields that are provided
      if (name !== undefined) nft.name = name;
      if (description !== undefined) nft.description = description;
      if (bidPrice !== undefined) nft.bidPrice = bidPrice;
      if (parsedAttributes !== undefined) nft.attributes = parsedAttributes;

      await nft.save();

      res.status(200).json({ message: 'NFT asset updated successfully', nftRecord: nft });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
