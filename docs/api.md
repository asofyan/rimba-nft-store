# API Reference

Base URL: `http://localhost:3000` (or `PROJECT_URL`). Interactive docs with full
schemas: `GET /docs` (Swagger UI, generated from `swaggerConfig.js` + JSDoc
annotations on the route files).

> **Role names in the tables below are the target model** described in
> [rbac.md](rbac.md). Until the role migration lands, the tokens still carry
> `Admin` / `Client` and `Admin` holds every privileged row. Keep
> [development-state.md](development-state.md) in sync when that changes.

## Conventions

| Item | Value |
|---|---|
| Auth header | `Authorization: Bearer <jwt>` |
| JWT | HS256, payload `{ id, role, username }`, **expires in 1 h** |
| Request bodies | JSON, except NFT upload (`multipart/form-data`) |
| Validation errors | `400 {"error":"Invalid input","details":["..."]}` |
| Auth errors | `401 {"error":"No token provided"}` · `401` wrong credentials or deactivated account · `403 {"error":"Invalid token"}` · `403 {"error":"Forbidden: insufficient permissions"}` |
| Rate limit | 20 requests / 15 min per IP on `/login` and `/register` → `429`; disabled when `NODE_ENV=test` |
| BigInt | Web3 v4 returns BigInt; the app serializes it as a string |

`401` vs `403` is a real distinction here: a **missing** token is `401`, an
**invalid/expired** token is `403` (`middleware/authenticateToken.js`).

## Endpoints

| Method | Path | Roles | Summary |
|---|---|---|---|
| POST | `/register` | public | Create a user; role is always `Client` |
| POST | `/login` | public | Exchange credentials for a JWT |
| GET | `/api/users` | SuperAdmin | Active users, `password` excluded |
| PUT | `/api/users` | any authenticated | Update **own** `username` / `password` / `ethAddress` |
| GET | `/api/users/inactive` | SuperAdmin | Soft-deleted users |
| GET | `/api/users/status` 📋 | SuperAdmin | Per-user status: role, active flag, ETH balance, NFT count, last login |
| DELETE | `/api/users/:id` | SuperAdmin | Soft delete (`isActive = false`), keeps the record |
| PUT | `/api/users/:id/reactivate` | SuperAdmin | Undo a soft delete |
| POST | `/api/nfts` | SuperAdmin, Subscriber | Upload image + generate metadata (multipart) |
| GET | `/api/nfts` | any authenticated | All NFT records incl. `minted` |
| PUT | `/api/nfts/:id` | SuperAdmin, Subscriber | Partial update of `name`, `description`, `bidPrice`, `attributes` |
| POST | `/api/nfts/mint` | SuperAdmin, Subscriber | Mint `metadataURI` to the caller's `ethAddress` |
| GET | `/api/wallet/balance` | any authenticated | ETH balance of the caller's `ethAddress` |

`📋` = designed but not implemented yet.

### POST /register

```json
{ "username": "client1", "password": "secret123", "ethAddress": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0" }
```

`201 {"message":"User registered successfully"}` · `400` invalid input /
username taken. Constraints: username ≥ 3, password ≥ 6, valid Ethereum address.

### POST /login

```json
{ "username": "admin", "password": "admin123" }
```

`200 {"token":"eyJ..."}` · `401` wrong credentials or `isActive === false`.

### GET /api/users

`200` array of user documents without `password`. Soft-deleted users are
excluded here — use `/api/users/inactive`.

### PUT /api/users

All fields optional; only the authenticated user's own record is touched.
Passwords are re-hashed by the model's pre-save hook.

`200 {"message":"User updated successfully","user":{...}}`

### GET /api/users/status 📋

Planned response, one object per user:

```json
{ "id": "...", "username": "admin1", "role": "Subscriber", "isActive": true,
  "ethAddress": "0xFFcf...", "balance": "0.5", "nftCount": 0,
  "createdAt": "2026-...", "lastLoginAt": "2026-..." }
```

`balance` is read from the chain (`ethereum.getBalance`), so the endpoint makes
one RPC call per user. Acceptable for small user counts; add caching/pagination
before this grows.

### POST /api/nfts (multipart)

| Field | Type | Required |
|---|---|---|
| `name` | text | yes |
| `description` | text | yes |
| `image` | file (`image/jpeg`, `image/png`, `image/webp`, ≤ 5 MB) | yes |
| `attributes` | JSON **string**, e.g. `[{"trait_type":"Species","value":"Meranti"}]` | no (default `[]`) |
| `bidPrice` | number | no |

`201 {"message":"NFT asset added successfully","nftRecord":{...}}` — the record
contains `image` and `metadataURL` as absolute URLs built from `PROJECT_URL`.

### POST /api/nfts/mint

```json
{ "metadataURI": "http://localhost:3000/metadata/metadata-1716.json" }
```

`201 {"message":"NFT minted successfully","receipt":{...}}` · `400` empty URI ·
`500` contract missing / no funds / revert. The server signs with
`PRIVATE_KEY` (contract owner) and pays gas; the token goes to the caller's
`ethAddress`. `metadataURI` should equal the `metadataURL` of an existing record
so that record is flagged `minted: true`.

### GET /api/wallet/balance

`200 {"address":"0x...","balance":"999.99..."}` — balance in ETH as a string.
`500` if the stored address is invalid.

## Not implemented

| Capability | Status |
|---|---|
| Bid on an NFT | ❌ Only `NFT.bidPrice` (a display number) exists; no endpoint, no bidding logic |
| Buy / settle a sale | ❌ No payment or escrow flow |
| Transfer a minted NFT | ❌ The contract inherits ERC-721 `transferFrom`, but no API exposes it |
| Pagination / filtering | ❌ Both list endpoints return everything |
| Refresh tokens / logout server-side | ❌ JWTs are stateless and valid until they expire |
