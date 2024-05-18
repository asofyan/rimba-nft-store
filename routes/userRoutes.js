const express = require('express');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Retrieve a list of active registered users
 *     description: Returns a list of users excluding those who have been soft-deleted. Can only be accessed by authenticated users with admin privileges.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of active users.
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
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find({ isActive: true });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving users', details: error });
  }
});

module.exports = router;


/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user's details
 *     description: Update user details, can only be accessed by authenticated users with admin privileges.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *       - oauth2: ['write:users']
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       403:
 *         description: Forbidden, if the user does not have the right privileges.
 *       404:
 *         description: User not found.
 */
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { username, role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { username, role }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input', details: error });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Soft delete a user
 *     description: Soft delete a user, can only be accessed by authenticated users with admin privileges.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *       - oauth2: ['write:users']
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User soft-deleted successfully.
 *       401:
 *         description: Unauthorized, if the user is not authenticated.
 *       403:
 *         description: Forbidden, if the user does not have the right privileges.
 *       404:
 *         description: User not found.
 */
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User soft-deleted successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Error updating user', details: error });
  }
});

module.exports = router;
