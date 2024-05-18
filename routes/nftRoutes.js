const express = require('express');
const multer = require('multer');
const path = require('path');
const NFT = require('../models/NFT');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

/**
 * @swagger
 * /api/nfts:
 *   post:
 *     summary: Add a new NFT asset
 *     description: Allows users to add a new NFT asset with a bid price.
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
 *               bidPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: NFT added successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 */
router.post('/nfts', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, description, bidPrice } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image upload failed' });
    }

    const newNFT = new NFT({
      ownerId: req.user.id,
      name,
      description,
      imageUrl,
      bidPrice,
    });

    await newNFT.save();

    res.status(201).json({ message: 'NFT added successfully', nft: newNFT });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input', details: error.message });
  }
});

module.exports = router;
