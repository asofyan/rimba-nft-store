// Migrasi role 2 tingkat -> 3 tingkat (idempoten).
//
//   Admin  -> SuperAdmin  untuk username "admin"
//   Admin  -> Subscriber  untuk Admin lain (admin1..admin5, dsb)
//   Client -> Client      (tidak berubah)
//
// Pakai: node scripts/migrateRoles.js [--dry-run]
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'admin';
const LEGACY_ADMIN = 'Admin';
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost/rimba-nft-store';
  await mongoose.connect(uri);
  console.log(`Terhubung ke ${uri}${dryRun ? ' (dry-run)' : ''}`);

  const legacyAdmins = await User.find({ role: LEGACY_ADMIN }).select('username role');
  if (legacyAdmins.length === 0) {
    console.log('Tidak ada user dengan role lama "Admin". Tidak ada yang diubah.');
  }

  for (const user of legacyAdmins) {
    const target = user.username === SUPERADMIN_USERNAME ? 'SuperAdmin' : 'Subscriber';
    console.log(`  ${user.username.padEnd(12)} ${LEGACY_ADMIN} -> ${target}`);
    if (!dryRun) {
      user.role = target;
      await user.save();
    }
  }

  // Ringkasan akhir
  const counts = await User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  console.log('\nJumlah user per role' + (dryRun ? ' (setelah migrasi)' : ''));
  for (const { _id, n } of counts) {
    const shown = dryRun && _id === LEGACY_ADMIN ? 'Admin (akan dimigrasi)' : _id;
    console.log(`  ${String(shown).padEnd(12)} ${n}`);
  }

  if (legacyAdmins.length > 0) {
    console.log('\nUser yang role-nya berubah harus login ulang — role disimpan di dalam JWT (TTL 1 jam).');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});
