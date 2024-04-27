const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define the user schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true, // Ensure usernames are unique
    required: [true, 'Username is required'], // Custom error message for validation
    minlength: [3, 'Username must be at least 3 characters long'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'], // Custom error message for validation
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  createdAt: {
    type: Date,
    default: Date.now, // Default value for the field
  },
});

// Hash password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next(); // Skip hashing if the password hasn't changed
  }
  try {
    this.password = await bcrypt.hash(this.password, 10); // Hash the password with bcrypt
    next();
  } catch (err) {
    next(err); // Pass the error to the next middleware
  }
});

// Method to validate the password
userSchema.methods.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.password); // Compare the hashed passwords
};

// Export the user model
const User = mongoose.model('User', userSchema);
module.exports = User;
