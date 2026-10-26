# Architecture

## Runtime topology

```
                      browser (React app on :3001)
                                 │  HTTP + JWT (Bearer)
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│ Express API  :3000                                           │
│  app.js ─ routes/{auth,user,nft,wallet}                      │
│         ─ middleware/{authenticateToken,upload,errorHandler}  │
│         ─ models/{User,NFT}  ── Mongoose ──►  MongoDB :27017  │
│         ─ services/ipfs.js   ──► Pinata (optional)           │
│         ─ ethereum.js        ──► JSON-RPC ──► Ganache :8545  │
│                                   │                          │
│  static: /uploads, /metadata      └─ RimbaNFT (ERC-721)      │
│  docs:   /docs (Swagger UI)                                  │
└──────────────────────────────────────────────────────────────┘
```

Three storage planes, each with a different lifetime:

| Plane | Holds | Lost when |
|---|---|---|
| MongoDB `rimba-nft-store` | users, NFT records, mint flags | DB is dropped |
| Disk `uploads/`, `metadata/` | images and ERC-721 metadata JSON | files are deleted |
| Ganache chain | contract bytecode, token ownership, balances | **every Ganache restart** |

The third plane is the fragile one: after a chain restart the contract must be
redeployed and every `NFT.minted = true` flag refers to a token that no longer
exists. The API does not reconcile this automatically (see
`development-state.md` → Known gaps).

## Module map

| Path | Responsibility |
|---|---|
| `server.js` | Loads `.env`, connects Mongo, starts HTTP listener; exits on DB failure |
| `app.js` | Builds the Express app: middlewares, rate limiter, static dirs, Swagger, routes, error handler. Exported for tests (no `listen`) |
| `routes/authRoutes.js` | `POST /register` (always role `Client`), `POST /login` → JWT `1h` |
| `routes/userRoutes.js` | User administration (list, status report, self-update, soft delete, reactivate) |
| `routes/nftRoutes.js` | Asset upload → metadata, listing, edit, on-chain mint |
| `routes/walletRoutes.js` | Read ETH balance of the caller's `ethAddress` |
| `models/User.js` | Schema: `username` (unique), bcrypt-hashed `password`, `role`, `isActive`, `ethAddress`, `createdAt` |
| `models/NFT.js` | Schema: `name`, `description`, `image`, `metadataURL`, `bidPrice`, `attributes` (Mixed), `minted` |
| `middleware/authenticateToken.js` | Verifies JWT; `requireRole(...roles)` guard (the RBAC primitive) |
| `middleware/upload.js` | Multer disk storage, `image/jpeg|png|webp`, 5 MB cap |
| `middleware/errorHandler.js` | Central mapping: Multer/CastError/duplicate key → 400, everything else → 500 |
| `services/ipfs.js` | Optional Pinata pinning (`pinFile`, `pinJSON`); returns `null` when `PINATA_JWT` is unset |
| `ethereum.js` | Lazy-loads contract ABI/address, reads balances, signs and sends `mint` |
| `eth-nft/` | Hardhat project: `contracts/NFT.sol` (`RimbaNFT`), deploy script, contract tests |
| `scripts/createAdmin.js` | Seeds a privileged user with an explicit role (bypasses `/register`) |
| `scripts/migrateRoles.js` | Idempotent migration `Admin` → `SuperAdmin` / `Subscriber` |
| `swaggerConfig.js` | OpenAPI document served at `/docs` |
| `test/api.test.js` | Jest + Supertest suite against `rimba-nft-store-test` |

## Request flows

### Register / login

```
POST /register {username,password,ethAddress}
  → express-validator (username ≥3, password ≥6, isEthereumAddress)
  → unique username check → User.create (role forced to 'Client')
  → bcrypt.hash (cost 10) via pre-save hook

POST /login {username,password}
  → isActive check → bcrypt.compare → jwt.sign({id, role, username}, 1h)
  → { token }
```

Role is never read from the request body; the only ways to obtain a privileged
role are `scripts/createAdmin.js` and the role migration script.

### Upload an asset (`POST /api/nfts`)

```
multer → uploads/<field>-<ts>-<rand>.<ext>
  → attributes JSON string parsed (invalid → 400)
  → read file buffer
  → ipfs.pinFile() if PINATA_JWT, else imageUrl = ${PROJECT_URL}/uploads/<file>
  → metadata = { name, description, image, attributes }
  → ipfs.pinJSON() if configured, else write metadata/metadata-<ts>.json
      metadataURL = ${PROJECT_URL}/metadata/<file>
  → NFT.create({... , minted: false}) → 201
```

`PROJECT_URL` must be the URL the *client* can reach, because the stored
`image`/`metadataURL` are absolute URLs.

### Mint (`POST /api/nfts/mint`)

```
{ metadataURI }
  → requireRole (privileged roles)
  → User.findById(req.user.id) → recipient = user.ethAddress
  → ethereum.mintNFT(recipient, metadataURI)
      getContract()  ← ABI from eth-nft/artifacts/.../RimbaNFT.json
                       address from CONTRACT_ADDRESS
      sign with PRIVATE_KEY (contract owner — mint() is onlyOwner)
      pre-flight: estimateGas, gasPrice, balance check
      sendRawTransaction → receipt
  → NFT.findOneAndUpdate({ metadataURL: metadataURI }, { minted: true })
  → 201 { receipt }
```

Consequences worth remembering:

- Minting is **custodial**: the server holds the owner key and pays gas; the
  user never signs. The token is minted *to* the user's address.
- `NFT.minted` is linked to the record only by exact `metadataURL` string match.
- An admin can mint the same `metadataURI` twice — the contract does not dedupe
  by URI, so this mints a second token id.

## Data model

```
User                NFT                         RimbaNFT (on-chain)
────                ───                         ──────────────────
_id                 _id                         nextTokenId
username (unique)   name                        ownerOf(tokenId)
password (bcrypt)   description                 tokenURI(tokenId)
role                image          ────────┐
isActive            metadataURL ────┐       │
ethAddress          bidPrice        │       └── points at metadata JSON
createdAt           attributes      └────────── points at uploads/ or IPFS
lastLoginAt          minted
```

There is **no foreign key between `User` and `NFT`** — an NFT record does not
say who uploaded it, and on-chain ownership is only visible on the chain. This
is the main structural obstacle to per-user listings/„my NFTs" (see
`development-state.md`).

## Error handling

Single place, `middleware/errorHandler.js`, mounted last:

| Condition | Response |
|---|---|
| `MulterError` (size/limit) or rejected MIME type | `400 {"error": "..."}` |
| Mongoose `CastError` (bad ObjectId) | `400 {"error":"Invalid ID format"}` |
| Duplicate unique key (`11000`) | `400 {"error":"Duplicate value","field":[...]}` |
| Anything else | logged, `500 {"error":"Server error"}` |

Route-level validation (express-validator) answers `400 {"error":"Invalid
input","details":[...]}` instead — that shape is what the frontend renders.

## Extension points

- **New privileged capability** → `requireRole(...)` on the route; role matrix in
  `rbac.md`; UI gate in the frontend (`hasRole`).
- **Marketplace (bid/buy/transfer)** → requires contract changes (listings,
  escrow, payment) *and* an `ownerId`/`uploadedBy` field on `NFT`; see the
  roadmap in `development-state.md`.
- **Per-user nonces or user-signed transactions** → would replace the single
  `PRIVATE_KEY` model in `ethereum.js` and move gas cost to users.

## Constraints and tech debt

| Item | Note |
|---|---|
| Single owner key | One key mints everything; no per-user signing, no user-funded gas |
| Local disk default | Without Pinata, token URIs break if `PROJECT_URL` changes or files are deleted |
| No pagination | `GET /api/nfts` and `GET /api/users` return everything |
| No reconciliation | Chain restarts leave stale `minted: true` flags |
| Role in JWT | A role change only takes effect after the token expires (1 h) or re-login |
| No audit log | User deactivation and role changes are not recorded anywhere |
