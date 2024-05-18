const express = require('express');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Retrieve a list of registered users
 *     description: Returns a list of users, can only be accessed by authenticated users with admin privileges.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       403:
 *         description: Forbidden, if the user does not have the right privileges.
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Check if the user is an admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving users', details: error });
  }
});

module.exports = router;
