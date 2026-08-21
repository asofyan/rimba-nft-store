# Rimba NFT Store — Backend

API backend untuk marketplace NFT Rimba: Express + MongoDB + Web3 (Ganache lokal),
JWT auth dengan RBAC (Admin/Client), upload aset NFT, dan mint on-chain via smart
contract `RimbaNFT` (ERC-721 + ERC-721URIStorage).

## Struktur

```
server.js              # entrypoint: koneksi DB + listen
app.js                 # assembly Express app (dipakai juga oleh test)
routes/                # authRoutes, userRoutes, nftRoutes, walletRoutes
models/                # User, NFT
middleware/            # authenticateToken (+requireRole), upload (Multer), errorHandler
services/ipfs.js       # upload IPFS via Pinata (opsional)
scripts/createAdmin.js # seed user Admin pertama
ethereum.js            # interaksi kontrak (lazy-load ABI, mint, saldo)
eth-nft/               # smart contract + Hardhat (package ESM terpisah)
test/api.test.js       # test API (Jest + Supertest)
```

## Menjalankan (dev)

1. **MongoDB** — pastikan mongod berjalan di `mongodb://localhost:27017`.
2. **Ganache** — jalankan dengan akun server agar menjadi owner kontrak:

   ```bash
   npx ganache --port 8545 \
     --wallet.accounts="0x<PRIVATE_KEY dari .env>,0x3635C9ADC5DEA00000"
   ```

3. **Deploy kontrak** (sekali, atau setiap restart ganache):

   ```bash
   cd eth-nft && npx hardhat run scripts/deploy.js --network ganache
   ```

   Script otomatis meng-update `CONTRACT_ADDRESS` di `.env`.

4. **Seed Admin** (sekali):

   ```bash
   node scripts/createAdmin.js <username> <password> <ethAddress>
   ```

5. **Start server**: `npm run dev` (nodemon) atau `npm start` → http://localhost:3000
   - Swagger docs: http://localhost:3000/docs

## Environment (.env)

| Variabel | Keterangan |
|---|---|
| `PORT` | Port server (default 3000) |
| `MONGO_URI` | Koneksi MongoDB |
| `JWT_SECRET` | Secret JWT (generate: `openssl rand -hex 32`) |
| `GANACHE_RPC_URL` | RPC node lokal (`http://127.0.0.1:8545`) |
| `CONTRACT_ADDRESS` | Alamat kontrak RimbaNFT |
| `PRIVATE_KEY` | Private key akun owner kontrak (jangan commit!) |
| `PROJECT_URL` | URL publik backend (untuk metadata/image lokal) |
| `CORS_ORIGIN` | Origin frontend yang diizinkan |
| `PINATA_JWT` | (Opsional) aktifkan upload IPFS via Pinata |
| `PINATA_GATEWAY` | (Opsional) gateway IPFS, default gateway.pinata.cloud |

Tanpa `PINATA_JWT`, image & metadata disimpan di disk lokal (`uploads/`, `metadata/`).
Dengan Pinata, metadataURL menunjuk ke IPFS sehingga NFT tetap valid tanpa server.

## Testing

```bash
npm test              # API tests (butuh mongod lokal; DB terpisah rimba-nft-store-test)
npm run test:contracts  # Hardhat test kontrak (in-memory network, tanpa ganache)
```

## Endpoint utama

- `POST /register`, `POST /login`
- `GET/PUT /api/users`, `DELETE /api/users/:id` (soft-delete), `PUT /api/users/:id/reactivate` *(Admin)*
- `POST /api/nfts` *(Admin)*, `GET /api/nfts`, `PUT /api/nfts/:id` *(Admin)*, `POST /api/nfts/mint` *(Admin)*
- `GET /api/wallet/balance`
