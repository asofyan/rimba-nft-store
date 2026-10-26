const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const User = require('../models/User');
const ethereum = require('../ethereum');

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
 * /api/users:
 *   get:
 *     summary: Get list of all active users (SuperAdmin only)
 *     description: Retrieve a list of all active users. Passwords are excluded.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SuperAdmin role)
 *       500:
 *         description: Server error
 */
router.get('/users', authenticateToken, requireRole('SuperAdmin'), async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('GET /users failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/users/status:
 *   get:
 *     summary: Status of every user (SuperAdmin only)
 *     description: >
 *       One row per user combining database state (role, active flag, last login)
 *       with on-chain state (ETH balance, number of RimbaNFT tokens held).
 *       Makes two RPC calls per user.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user status rows
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SuperAdmin role)
 *       500:
 *         description: Server error
 */
router.get('/users/status', authenticateToken, requireRole('SuperAdmin'), async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: 1 });

    const rows = await Promise.all(
      users.map(async (user) => {
        // Data on-chain tidak boleh menggagalkan seluruh endpoint
        let balance = null;
        try {
          balance = await ethereum.getBalance(user.ethAddress);
        } catch (error) {
          balance = null;
        }

        const nftCount = await ethereum.getNftCount(user.ethAddress);

        return {
          id: user._id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          ethAddress: user.ethAddress,
          balance,
          nftCount,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        };
      })
    );

    res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users:
 *   put:
 *     summary: Update user data
 *     description: Update the details of the authenticated user. Role cannot be changed here.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               ethAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put(
  '/users',
  authenticateToken,
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('ethAddress').optional().isEthereumAddress().withMessage('Invalid Ethereum address'),
  validate,
  async (req, res) => {
  try {
    const { username, password, ethAddress } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (username) user.username = username;
    if (password) user.password = password; // hashed by pre-save hook in the model
    if (ethAddress) user.ethAddress = ethAddress;

    await user.save();

    res.status(200).json({
      message: 'User updated successfully',
      user: { id: user._id, username: user.username, role: user.role, ethAddress: user.ethAddress }
    });
  } catch (error) {
    console.error('PUT /users failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/users/inactive:
 *   get:
 *     summary: Get list of all soft deleted users (SuperAdmin only)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of soft deleted users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SuperAdmin role)
 *       500:
 *         description: Server error
 */
router.get('/users/inactive', authenticateToken, requireRole('SuperAdmin'), async (req, res) => {
  try {
    const users = await User.find({ isActive: false }).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('GET /users/inactive failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Soft delete a user (SuperAdmin only)
 *     description: Deactivate a user by setting isActive to false.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       400:
 *         description: Cannot deactivate yourself
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SuperAdmin role)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/users/:id', authenticateToken, requireRole('SuperAdmin'), async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('DELETE /users/:id failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/users/{id}/reactivate:
 *   put:
 *     summary: Reactivate a soft deleted user (SuperAdmin only)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SuperAdmin role)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/users/:id/reactivate', authenticateToken, requireRole('SuperAdmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({
      message: 'User reactivated successfully',
      user: { id: user._id, username: user.username, isActive: user.isActive }
    });
  } catch (error) {
    console.error('PUT /users/:id/reactivate failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
