// Test API Rimba NFT Store.
// Prasyarat: mongod lokal berjalan. DB test terpisah: rimba-nft-store-test
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const NFT = require('../models/NFT');

const ADMIN = { username: 'test-admin', password: 'adminpass123', ethAddress: '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98', role: 'SuperAdmin' };
const SUBSCRIBER = { username: 'test-seller', password: 'sellerpass123', ethAddress: '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98', role: 'Subscriber' };
const CLIENT = { username: 'test-client', password: 'clientpass123', ethAddress: '0x48320dcDDf05474BDEF8bDA9Cb848a1333d94a98' };

async function registerAndLogin(user) {
  await request(app).post('/register').send(user);
  const res = await request(app).post('/login').send({ username: user.username, password: user.password });
  return res.body.token;
}

// Role privileged tidak bisa didapat via /register (selalu Client) — buat langsung
// via model, sama seperti scripts/createAdmin.js
async function createAdminAndLogin() {
  await User.create(ADMIN);
  const res = await request(app).post('/login').send({ username: ADMIN.username, password: ADMIN.password });
  return res.body.token;
}

async function createSubscriberAndLogin() {
  await User.create(SUBSCRIBER);
  const res = await request(app).post('/login').send({ username: SUBSCRIBER.username, password: SUBSCRIBER.password });
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

    // lastLoginAt diisi saat login sukses
    const user = await User.findOne({ username: CLIENT.username });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
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

describe('RBAC /api/users (SuperAdmin only)', () => {
  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('403 Client dilarang lihat daftar user', async () => {
    const token = await registerAndLogin(CLIENT);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('403 Subscriber dilarang lihat daftar user', async () => {
    const token = await createSubscriberAndLogin();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 SuperAdmin bisa lihat daftar user tanpa password', async () => {
    await request(app).post('/register').send(CLIENT);
    const adminToken = await createAdminAndLogin();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const u of res.body) {
      expect(u.password).toBeUndefined();
    }
  });

  it('403 Subscriber dilarang menonaktifkan user', async () => {
    await request(app).post('/register').send(CLIENT);
    const subscriberToken = await createSubscriberAndLogin();
    const client = await User.findOne({ username: CLIENT.username });

    const res = await request(app)
      .delete(`/api/users/${client._id}`)
      .set('Authorization', `Bearer ${subscriberToken}`);
    expect(res.status).toBe(403);

    const stillActive = await User.findById(client._id);
    expect(stillActive.isActive).toBe(true);
  });

  it('soft-delete lalu reactivate oleh SuperAdmin', async () => {
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

describe('GET /api/users/status (SuperAdmin only)', () => {
  it('403 Client dan Subscriber ditolak', async () => {
    const clientToken = await registerAndLogin(CLIENT);
    const subscriberToken = await createSubscriberAndLogin();

    const asClient = await request(app).get('/api/users/status').set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);
    const asSubscriber = await request(app).get('/api/users/status').set('Authorization', `Bearer ${subscriberToken}`);
    expect(asSubscriber.status).toBe(403);
  });

  it('200 SuperAdmin melihat status semua user (aktif & nonaktif)', async () => {
    await request(app).post('/register').send(CLIENT);
    const adminToken = await createAdminAndLogin();

    // buat satu user nonaktif
    const client = await User.findOne({ username: CLIENT.username });
    client.isActive = false;
    await client.save();

    const res = await request(app).get('/api/users/status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const row = res.body.find((u) => u.username === CLIENT.username);
    expect(row).toBeDefined();
    expect(row.role).toBe('Client');
    expect(row.isActive).toBe(false);
    expect(row.ethAddress).toBe(CLIENT.ethAddress);
    expect(row).toHaveProperty('balance');
    expect(row).toHaveProperty('nftCount');
    expect(row).toHaveProperty('lastLoginAt');
    expect(row.password).toBeUndefined();
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
  let adminToken, clientToken, subscriberToken;

  beforeEach(async () => {
    adminToken = await createAdminAndLogin();
    clientToken = await registerAndLogin(CLIENT);
    subscriberToken = await createSubscriberAndLogin();
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

  it('Subscriber boleh upload NFT (sell)', async () => {
    const res = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .field('name', 'Jual Rimba')
      .field('description', 'Dari Subscriber')
      .attach('image', Buffer.from(PNG_BASE64, 'base64'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.nftRecord.name).toBe('Jual Rimba');
  });

  it('Subscriber boleh edit NFT', async () => {
    const created = await request(app)
      .post('/api/nfts')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .field('name', 'Nama Awal')
      .field('description', 'Deskripsi')
      .attach('image', Buffer.from(PNG_BASE64, 'base64'), { filename: 'a.png', contentType: 'image/png' });

    const res = await request(app)
      .put(`/api/nfts/${created.body.nftRecord._id}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({ bidPrice: 1.5 });
    expect(res.status).toBe(200);
    expect(res.body.nftRecord.bidPrice).toBe(1.5);
  });

  it('SuperAdmin upload NFT → attributes & metadataURL tersimpan', async () => {
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
