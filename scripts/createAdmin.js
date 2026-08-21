// Seed script: membuat user Admin pertama.
// Pakai: node scripts/createAdmin.js <username> <password> <ethAddress>
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const [username, password, ethAddress] = process.argv.slice(2);

  if (!username || !password || !ethAddress) {
    console.error('Usage: node scripts/createAdmin.js <username> <password> <ethAddress>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/rimba-nft-store');

  const existing = await User.findOne({ username });
  if (existing) {
    existing.role = 'Admin';
    existing.isActive = true;
    await existing.save();
    console.log(`User "${username}" sudah ada — di-promote menjadi Admin.`);
  } else {
    await User.create({ username, password, role: 'Admin', ethAddress });
    console.log(`Admin "${username}" berhasil dibuat.`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Gagal membuat admin:', err.message);
  process.exit(1);
});
