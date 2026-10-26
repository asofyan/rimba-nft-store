// Seed script: membuat/mempromosikan user dengan role tertentu.
// Pakai: node scripts/createAdmin.js <username> <password> <ethAddress> [role]
//   role: SuperAdmin (default) | Subscriber | Client
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ROLES = ['SuperAdmin', 'Subscriber', 'Client'];

async function main() {
  const [username, password, ethAddress, roleArg] = process.argv.slice(2);
  const role = roleArg || 'SuperAdmin';

  if (!username || !password || !ethAddress) {
    console.error('Usage: node scripts/createAdmin.js <username> <password> <ethAddress> [SuperAdmin|Subscriber|Client]');
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Role tidak valid: "${role}". Pilih salah satu: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/rimba-nft-store');

  const existing = await User.findOne({ username });
  if (existing) {
    existing.role = role;
    existing.isActive = true;
    existing.ethAddress = ethAddress;
    await existing.save();
    console.log(`User "${username}" sudah ada — role di-set ke ${role} dan diaktifkan kembali.`);
  } else {
    await User.create({ username, password, role, ethAddress });
    console.log(`User "${username}" dengan role ${role} berhasil dibuat.`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Gagal membuat user:', err.message);
  process.exit(1);
});
