const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

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
 * /register:
 *   post:
 *     summary: Register a new user.
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
 *       201:
 *         description: User registered successfully.
 *       400:
 *         description: User registration failed due to missing data or other issues.
 */
router.post(
  '/register',
  body('username')
    .trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('ethAddress')
    .isEthereumAddress().withMessage('Invalid Ethereum address'),
  validate,
  async (req, res) => {
    const { username, password, ethAddress } = req.body;

    try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      const newUser = new User({
        username,
        password, // hashed by pre-save hook in the model
        ethAddress // Store the user's Ethereum address
      });

      await newUser.save();
      res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
      console.error('Registration failed:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a user.
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
 *     responses:
 *       200:
 *         description: Successful login, returns a JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials.
 */
router.post(
  '/login',
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  async (req, res) => {
    const { username, password } = req.body;

    try {
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (user.isActive === false) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { id: user._id, role: user.role, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (err) {
      console.error('Login failed:', err);
      res.status(500).json({ error: 'Server error during authentication' });
    }
  }
);

module.exports = router;
