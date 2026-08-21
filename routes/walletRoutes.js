const express = require('express');
const { authenticateToken } = require('../middleware/authenticateToken');
const ethereum = require('../ethereum');
const User = require('../models/User');

const router = express.Router();

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     summary: Get the authenticated user's ETH balance
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance in ETH
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/wallet/balance', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const balance = await ethereum.getBalance(user.ethAddress);
    res.status(200).json({ address: user.ethAddress, balance });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
