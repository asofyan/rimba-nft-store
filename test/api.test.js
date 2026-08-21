// Test API Rimba NFT Store.
// Prasyarat: mongod lokal berjalan. DB test terpisah: rimba-nft-store-test
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const NFT = require('../models/NFT');

const ADMIN = { username: 'test-admin', password: 'adminpass123', ethAddress: '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98', role: 'Admin' };
const CLIENT = { username: 'test-client', password: 'clientpass123', ethAddress: '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98' };

async function registerAndLogin(user) {
  await request(app).post('/register').send(user);
  const res = await request(app).post('/login').send({ username: user.username, password: user.password });
  return res.body.token;
}

// Admin tidak bisa dibuat via /register (role selalu Client) — buat langsung via model,
// sama seperti scripts/createAdmin.js
async function createAdminAndLogin() {
  await User.create(ADMIN);
  const res = await request(app).post('/login').send({ username: ADMIN.username, password: ADMIN.password });
  return res.body.token;
}

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/rimba-nft-store-test');
});

afterEach(async () => {
  await User.deleteMany({});
  await NFT.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /register', () => {
  it('201 registrasi sukses tanpa role (selalu Client)', async () => {
    const res = await request(app).post('/register').send(CLIENT);
    expect(res.status).toBe(201);
    const user = await User.findOne({ username: CLIENT.username });
    expect(user.role).toBe('Client');
    // password harus ter-hash, bukan plaintext
    expect(user.password).not.toBe(CLIENT.password);
  });

  it('400 jika ethAddress tidak valid', async () => {
    const res = await request(app).post('/register').send({ ...CLIENT, ethAddress: 'bukan-address' });
    expect(res.status).toBe(400);
  });

  it('400 jika username sudah dipakai', async () => {
    await request(app).post('/register').send(CLIENT);
    const res = await request(app).post('/register').send(CLIENT);
    expect(res.status).toBe(400);
  });
});

describe('POST /login', () => {
  it('200 mengembalikan token berisi id, role, username', async () => {
    await request(app).post('/register').send(CLIENT);
    const res = await request(app).post('/login').send({ username: CLIENT.username, password: CLIENT.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('Client');
    expect(payload.username).toBe(CLIENT.username);
  });

  it('401 password salah', async () => {
    await request(app).post('/register').send(CLIENT);
    const res = await request(app).post('/login').send({ username: CLIENT.username, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('401 akun yang di-soft-delete tidak bisa login', async () => {
    await request(app).post('/register').send(CLIENT);
    const user = await User.findOne({ username: CLIENT.username });
    user.isActive = false;
    await user.save();
    const res = await request(app).post('/login').send({ username: CLIENT.username, password: CLIENT.password });
    expect(res.status).toBe(401);
  });
});

describe('RBAC /api/users', () => {
  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('403 Client dilarang lihat daftar user', async () => {
    const token = await registerAndLogin(CLIENT);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 Admin bisa lihat daftar user tanpa password', async () => {
    await request(app).post('/register').send(CLIENT);
    const adminToken = await createAdminAndLogin();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const u of res.body) {
      expect(u.password).toBeUndefined();
    }
  });

  it('soft-delete lalu reactivate oleh Admin', async () => {
    await request(app).post('/register').send(CLIENT);
    const adminToken = await createAdminAndLogin();
    const client = await User.findOne({ username: CLIENT.username });

    const del = await request(app).delete(`/api/users/${client._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const inactive = await request(app).get('/api/users/inactive').set('Authorization', `Bearer ${adminToken}`);
    expect(inactive.body.some((u) => u.username === CLIENT.username)).toBe(true);

    const reactivate = await request(app).put(`/api/users/${client._id}/reactivate`).set('Authorization', `Bearer ${adminToken}`);
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.user.isActive).toBe(true);
  });
});

describe('PUT /api/users (profil sendiri)', () => {
  it('ganti password berhasil dan bisa dipakai login', async () => {
    const token = await registerAndLogin(CLIENT);
    const res = await request(app)
      .put('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpass456' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/login').send({ username: CLIENT.username, password: 'newpass456' });
    expect(login.status).toBe(200);
  });

  it('400 password terlalu pendek', async () => {
    const token = await registerAndLogin(CLIENT);
    const res = await request(app)
      .put('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('/api/nfts', () => {
  const PNG_BASE64 = 'iVBORw0KGgo=';
  let adminToken, clientToken;

  beforeEach(async () => {
    adminToken = await createAdminAndLogin();
    clientToken = await registerAndLogin(CLIENT);
  });

  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/nfts');
    expect(res.status).toBe(401);
  });

  it('403 Client tidak bisa upload NFT', async () => {
    const res = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('name', 'X')
      .field('description', 'Y')
      .attach('image', Buffer.from(PNG_BASE64, 'base64'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it('Admin upload NFT → attributes & metadataURL tersimpan', async () => {
    const res = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Rimba Test')
      .field('description', 'Deskripsi')
      .field('bidPrice', '0.1')
      .field('attributes', JSON.stringify([{ trait_type: 'Luas', value: '10 Ha' }]))
      .attach('image', Buffer.from(PNG_BASE64, 'base64'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.nftRecord.attributes[0].trait_type).toBe('Luas');
    expect(res.body.nftRecord.metadataURL).toContain('/metadata/');
  });

  it('400 upload tanpa gambar', async () => {
    const res = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'X')
      .field('description', 'Y');
    expect(res.status).toBe(400);
  });

  it('update parsial tidak menimpa field lain', async () => {
    const created = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Nama Awal')
      .field('description', 'Deskripsi Awal')
      .attach('image', Buffer.from(PNG_BASE64, 'base64'), { filename: 'a.png', contentType: 'image/png' });

    const id = created.body.nftRecord._id;
    const res = await request(app)
      .put(`/api/nfts/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nama Baru' });
    expect(res.status).toBe(200);
    expect(res.body.nftRecord.name).toBe('Nama Baru');
    expect(res.body.nftRecord.description).toBe('Deskripsi Awal'); // tidak hilang
  });

  it('400 ID Mongo tidak valid saat update', async () => {
    const res = await request(app)
      .put('/api/nfts/bukan-mongoid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });
});
