# Rimba NFT Store — Backend

REST API for the Rimba NFT Store. Express + MongoDB + Web3, with JWT auth and
role-based access (Admin/Client), NFT asset upload, and on-chain minting of the
`RimbaNFT` ERC-721 contract (OpenZeppelin 5) on a local Ganache chain.

Everything runs locally: no paid RPC, no cloud database, and IPFS/Pinata is optional.

## Stack

| Layer | Tech |
|---|---|
| HTTP | Express 4, express-validator, express-rate-limit |
| Database | MongoDB 7 + Mongoose 8 |
| Auth | JWT (bcrypt-hashed passwords), roles `Admin` / `Client` |
| Uploads | Multer (JPEG/PNG/WebP, max 5 MB, disk storage) |
| Chain | Web3 4 → Ganache (`chainId 1337`) |
| Contract | Solidity 0.8.20, Hardhat 3, OpenZeppelin 5 (ERC-721 + ERC721URIStorage) |
| Docs | Swagger UI at `/docs` |
| Tests | Jest + Supertest (API), Hardhat/Mocha (contract) |

## Requirements

- **Node.js 20+** (verified on Node 22.23, npm 10.9)
- **MongoDB 7** reachable at `mongodb://127.0.0.1:27017`
  (local install, Docker, or a standalone tarball — see below)
- Nothing else: Ganache and Hardhat are npm dev dependencies.

## Repository layout

```
server.js               entrypoint (Mongo connection + listen)
app.js                  Express app assembly (also imported by tests)
routes/                 authRoutes, userRoutes, nftRoutes, walletRoutes
models/                 User, NFT (Mongoose schemas)
middleware/             authenticateToken (+ requireRole), upload (Multer), errorHandler
services/ipfs.js        optional Pinata IPFS upload
ethereum.js             contract interaction: balance, mint (lazy ABI load)
scripts/createAdmin.js  seed the first Admin user
swaggerConfig.js        OpenAPI definition for /docs
eth-nft/                smart contract + Hardhat project (separate ESM package)
  contracts/NFT.sol           RimbaNFT
  scripts/deploy.js           deploy + write CONTRACT_ADDRESS into ../.env
  test/RimbaNFT.test.js       contract tests (in-memory network)
test/api.test.js        API tests (Jest + Supertest)
uploads/                uploaded images   (gitignored, created at boot)
metadata/               generated ERC-721 metadata JSON (gitignored)
```

`eth-nft/` has no `node_modules` of its own: the Hardhat plugins, ethers and
OpenZeppelin all resolve from the root `node_modules`.

---

## Quick start

```bash
npm install

# 1. MongoDB must be running on 127.0.0.1:27017
#    (brew install mongodb-community / docker run -p 27017:27017 mongo:7)

# 2. Create .env from the template and set JWT_SECRET (openssl rand -hex 32)
cp .env.example .env

# 3. Local chain, funded with the account whose PRIVATE_KEY is in .env (10 ETH)
npx ganache --port 8545 --chain.chainId 1337 \
  --wallet.accounts="0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d,0x3635C9ADC5DEA00000"

# 4. Compile + deploy (writes CONTRACT_ADDRESS back into .env automatically)
(cd eth-nft && npx hardhat compile)
(cd eth-nft && npx hardhat run scripts/deploy.js --network ganache)

# 5. First Admin (password >= 6 chars, ETH address must be a valid address)
node scripts/createAdmin.js admin admin123 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1

# 6. Run
npm run dev      # nodemon, or: npm start
```

Then:

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

The **deploy step must run after every Ganache restart** — a restarted chain has
no bytecode at the old address. `scripts/deploy.js` rewrites `CONTRACT_ADDRESS`
in `.env` for you (the address is usually identical, because it is the first
transaction of the same deployer account).

---

## First-time configuration

### 1. Install dependencies

```bash
npm install
```

> `@openzeppelin/contracts` is pinned to **5.0.2** on purpose. `^5.0.2` resolves
> to 5.6.x, which requires `pragma solidity ^0.8.24` and the Cancun `mcopy`
> opcode — Hardhat here compiles with 0.8.20 / EVM `shanghai` (`HHE909`/`HHE910`
> compile errors otherwise). If you bump the compiler in
> `eth-nft/hardhat.config.js`, you may unpin it.

### 2. MongoDB

Either one works — pick one:

```bash
# Homebrew
brew tap mongodb/brew && brew trust mongodb/brew && brew install mongodb-community
brew services start mongodb-community

# Docker
docker run -d --name rimba-mongo -p 27017:27017 mongo:7

# Standalone tarball (no root, data in a local folder)
mkdir -p .local && cd .local
curl -O https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.14.tgz
tar xzf mongodb-macos-x86_64-7.0.14.tgz && mkdir -p mongo-data
./mongodb-macos-x86_64-7.0.14/bin/mongod --dbpath ./mongo-data --bind_ip 127.0.0.1 \
  --port 27017 --logpath ./mongod.log --fork
```

App data lives in DB `rimba-nft-store`; the test suite uses `rimba-nft-store-test`.

### 3. Create `.env`

```bash
cp .env.example .env    # then edit JWT_SECRET (and CORS_ORIGIN if your frontend port differs)
```

Minimum working `.env`:

```dotenv
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/rimba-nft-store
JWT_SECRET=<openssl rand -hex 32>
GANACHE_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=          # leave empty; filled in by eth-nft/scripts/deploy.js
PRIVATE_KEY=0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
PROJECT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (3000) | HTTP port |
| `MONGO_URI` | no (`mongodb://localhost/rimba-nft-store`) | MongoDB connection string |
| `JWT_SECRET` | **yes** | Signs/verifies JWTs. Rotating it invalidates all existing tokens (clients get `403 Invalid token`). Generate: `openssl rand -hex 32` |
| `GANACHE_RPC_URL` | no (`http://127.0.0.1:8545`) | Chain RPC endpoint |
| `CONTRACT_ADDRESS` | **yes for minting** | Deployed `RimbaNFT` address; auto-filled by the deploy script |
| `PRIVATE_KEY` | **yes for minting** | Private key of the **contract owner** (the deployer). Test-only key; never commit |
| `PROJECT_URL` | yes | Public base URL used to build image/metadata URLs stored in the NFT documents |
| `CORS_ORIGIN` | recommended | Allowed browser origin (default `*`). Must match the frontend URL exactly (protocol + port) |
| `PINATA_JWT` | no | Enables IPFS uploads; without it files stay on disk |
| `PINATA_GATEWAY` | no (`https://gateway.pinata.cloud`) | IPFS gateway prefix |

Notes:

- `PRIVATE_KEY` must control the **same account** Ganache funds, and that
  account must be the contract owner — `mint()` is `onlyOwner`.
- Without `PINATA_JWT`, images go to `uploads/` and metadata to `metadata/`,
  both served statically (`/uploads/...`, `/metadata/...`). The NFT therefore
  only resolves while the server runs.
- `CORS_ORIGIN` mismatch is the single most common "frontend can't reach API"
  cause; the error appears in the browser console, not in the server log.

### 4. Ganache

```bash
npx ganache --port 8545 --chain.chainId 1337 \
  --wallet.accounts="0x<PRIVATE_KEY from .env>,0x3635C9ADC5DEA00000"
```

`0x3635C9ADC5DEA00000` = 10 ETH. Keep `chainId` at 1337 (Hardhat network config
expects it). If you also want MetaMask accounts, add more key/balance pairs.

### 5. Compile and deploy the contract

```bash
cd eth-nft
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
cd ..
grep CONTRACT_ADDRESS .env   # sanity check
```

### 6. Seed the first Admin

`POST /register` always creates a **Client** (you cannot self-assign Admin), so
the first Admin is seeded from the CLI:

```bash
node scripts/createAdmin.js <username> <password> <ethAddress>
```

Re-running it on an existing username promotes that user to Admin and
reactivates it. The `ethAddress` is where minted NFTs go — use a valid address,
e.g. another Ganache account.

### 7. Start the server

```bash
npm run dev     # nodemon
npm start       # plain node
```

Expected output:

```
Server running on http://localhost:3000
Connected to MongoDB (mongodb://127.0.0.1:27017/rimba-nft-store)
```

Mongo is connected asynchronously at boot: if the database is unreachable the
process prints `Error connecting to MongoDB` and exits with code 1 (it does not
keep serving with a broken DB).

---

## Verify it works

```bash
# login
TOKEN=$(curl -s -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

# on-chain wallet read
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/wallet/balance
# -> {"address":"0x90F8...","balance":"999.99..."}

# list NFTs
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/nfts

# upload an asset (Admin)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "name=Rimba Test" -F "description=Local run" \
  -F "image=@./some.png" -F "bidPrice=0.5" \
  http://localhost:3000/api/nfts

# mint it on-chain (Admin). metadataURI must equal the returned metadataURL
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"metadataURI":"http://localhost:3000/metadata/metadata-....json"}' \
  http://localhost:3000/api/nfts/mint
```

## API

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | public | body `{username, password, ethAddress}` → always `Client` |
| POST | `/login` | public | → `{ token }` (JWT: `id`, `role`, `username`) |
| GET | `/api/users` | Admin | list users |
| PUT | `/api/users` | auth | update **own** profile (`username`, `password`, `ethAddress`) |
| GET | `/api/users/inactive` | Admin | soft-deleted users |
| DELETE | `/api/users/:id` | Admin | soft delete (`isActive = false`) |
| PUT | `/api/users/:id/reactivate` | Admin | reactivate |
| POST | `/api/nfts` | Admin | multipart: `name`, `description`, `image`, `attributes` (JSON string), `bidPrice` |
| GET | `/api/nfts` | auth | all NFTs + `minted` flag |
| PUT | `/api/nfts/:id` | Admin | partial: `name`, `description`, `bidPrice`, `attributes` |
| POST | `/api/nfts/mint` | Admin | body `{ metadataURI }`; mints to the caller's `ethAddress` |
| GET | `/api/wallet/balance` | auth | ETH balance of the caller's `ethAddress` |

Full request/response schemas: <http://localhost:3000/docs>.

Auth: send `Authorization: Bearer <token>`. `401` = missing token, `403` =
invalid/expired token or insufficient role. `/login` and `/register` are rate
limited to 20 requests / 15 min (disabled when `NODE_ENV=test`).

## Tests

```bash
npm test                     # API tests — needs a running mongod, uses DB rimba-nft-store-test
NODE_ENV=test npx jest --runInBand
npm run test:contracts       # contract tests — in-memory network, no ganache needed
```

Current status: 18 API tests passing, 5 contract tests passing.

The API suite connects to `mongodb://localhost:27017/rimba-nft-store-test` and
clears the User/NFT collections between tests; it never touches your dev data.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Error connecting to MongoDB: connect ECONNREFUSED` | mongod not running, or `MONGO_URI` wrong |
| Login returns `{"error":"Too many attempts..."}` | rate limiter (20/15 min). Wait, or restart with `NODE_ENV=test` |
| `403 Invalid token` on every request | `JWT_SECRET` changed since the token was issued → log in again |
| Mint fails: `Contract build not found` | run `npx hardhat compile` in `eth-nft/` |
| Mint fails: `CONTRACT_ADDRESS is not set` | deploy step skipped → run the deploy script |
| Mint fails: `Invalid address` / tx reverts | Ganache restarted (chain state wiped) → redeploy contract; also verify `PRIVATE_KEY` is the owner |
| Mint fails: `Insufficient funds for gas * price + value` | funded account missing — start Ganache with `--wallet.accounts="0x<PRIVATE_KEY>,0x3635C9ADC5DEA00000"` |
| `HHE909` / `No solc version enabled …` or `Function "mcopy" not found` | OpenZeppelin drifted to 5.6.x → `npm i -E @openzeppelin/contracts@5.0.2` |
| Browser: CORS error | `CORS_ORIGIN` must equal the frontend origin exactly (`http://localhost:3001`) |
| Upload rejected | only `image/jpeg`, `image/png`, `image/webp`, max 5 MB |
| `EADDRINUSE :3000` | another process holds the port (`lsof -nP -iTCP:3000 -sTCP:LISTEN`) — also do not run the frontend on 3000 |

## Related

Frontend: see `../frontend/README.md` (React app, must run on a port other than
3000 and point `REACT_APP_API_URL` at this server).
