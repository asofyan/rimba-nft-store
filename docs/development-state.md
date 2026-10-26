# Development State

The project's memory: what works, what does not, and why decisions were made.
Update this file in the same commit as the change it describes.

Snapshot date: **2026-10-26** · Node 22.23 · MongoDB 7.0.14 · Ganache 7.9.2 ·
Hardhat 3.21 · OpenZeppelin 5.0.2

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo scaffold: Express app, Mongo connection, Swagger | ✅ done |
| 1 | Auth: register/login, bcrypt, JWT (1 h), soft delete | ✅ done |
| 2 | Coarse RBAC (`Admin` / `Client`), rate limiting, validation, central error handler | ✅ done |
| 3 | NFT asset upload → metadata, gallery, on-chain mint (`RimbaNFT`) | ✅ done |
| 4 | IPFS/Pinata as optional storage, Hardhat project, 18 API + 5 contract tests, CI | ✅ done |
| 5 | 3-tier RBAC (`SuperAdmin` / `Subscriber` / `Client`) + user-status endpoint | ✅ done |
| 6 | Marketplace: list/bid/buy/transfer (contract + API + UI) | 📋 planned |

## What works today (verifiable)

```bash
npm test            # 24 API tests (Jest + Supertest, needs mongod)
npm run test:contracts   # 5 contract tests (in-memory Hardhat network)
```

Smoke test against a running stack:

```bash
TOKEN=$(curl -s -X POST localhost:3000/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/wallet/balance
```

## Known gaps / backlog

| # | Gap | Impact | Sketch of a fix |
|---|---|---|---|
| 1 | No bid/buy/transfer | The store can mint but not trade | Contract: listings + escrow; API: `/nfts/:id/bid`, `/buy`, `/transfer` |
| 2 | `NFT` has no `uploadedBy` | Cannot scope edits/mint to the owner; "my NFTs" impossible | Add `uploadedBy: ObjectId ref User`, backfill, scope routes |
| 3 | Mint is custodial (single `PRIVATE_KEY`) | Server pays gas; users cannot act on-chain themselves | Per-user signing or meta-transactions |
| 4 | Chain restarts leave `minted: true` stale | Gallery shows tokens that no longer exist | Reconciliation job or `POST /admin/resync` reading `ownerOf` |
| 5 | No pagination on list endpoints | Fine now, breaks at scale | `?page&limit` with defaults |
| 6 | Role change needs re-login (1 h TTL) | Deactivated user keeps access up to 1 h | Shorter TTL or per-request user lookup |
| 7 | No audit log for user/admin actions | Cannot reconstruct who did what | `AuditLog` collection written by middleware |
| 8 | Local disk storage by default | Token URIs break if `PROJECT_URL` or files change | Set `PINATA_JWT` in any real environment |
| 9 | No `GET /api/nfts/:id` | UI fetches the whole list to edit one item | Single-document endpoint |

## Decision log

Newest first. One entry per decision that a future maintainer could otherwise
re-litigate.

**2026-10-26 — Phase 5 implemented: 3-tier RBAC + `GET /api/users/status`.**
`Admin` was migrated to `SuperAdmin` (only `admin`) or `Subscriber`
(`admin1`-`admin5`) by `scripts/migrateRoles.js`. `GET /api/users/status`
combines DB state with on-chain reads: `balance` (ETH) and `nftCount`
(`balanceOf`, i.e. tokens actually held). Two RPC calls per user — acceptable for
single-digit user counts, revisit with caching when that changes. `lastLoginAt`
was added to the User schema and is written on every successful login.
Upload/edit/mint now accept `SuperAdmin` + `Subscriber`; user administration is
`SuperAdmin` only. Tests: 24 passing (was 18).

**2026-10-26 — 3-tier RBAC instead of a boolean admin flag.**
`admin` becomes `SuperAdmin` (only role that can list/deactivate users and read
other users' status), `admin1`-`admin5` become `Subscriber` (sell + mint), public
sign-ups stay `Client` (read-only). Rejected: keeping `Admin` and adding a
`canManageUsers` flag — roles are already in the JWT and `requireRole` is
multi-role, so a third enum value costs less than a parallel permission system.

**2026-10-26 — Bid/buy/transfer deferred out of the RBAC phase.**
Those capabilities have no contract support (only `mint` exists) and no NFT
ownership field in Mongo. Mixing them into an RBAC change would ship half a
marketplace. They stay in Phase 6 with their own design.

**2026-10-26 — `@openzeppelin/contracts` pinned to exactly `5.0.2`.**
`^5.0.2` resolves to 5.6.x, which requires `pragma ^0.8.24` and the Cancun
`mcopy` opcode; the project compiles with solc 0.8.20 / EVM `shanghai`, so the
build fails with `HHE909` / `Function "mcopy" not found`. Pinning beats bumping
the compiler because it keeps the deployed bytecode target unchanged.

**2026-10-26 — Local disk storage remains the default; Pinata is opt-in.**
Requiring a Pinata JWT to upload would make first-run setup depend on a paid
third party. Trade-off accepted: token URIs are only valid while the API serves
`/uploads` and `/metadata`.

## How to continue

1. Read [architecture.md](architecture.md) for the moving parts.
2. Pick the next item from *Known gaps* or *Phases*.
3. Design first if the change touches the contract or the data model.
4. Update: this file (status + decision), `api.md` (endpoints), `rbac.md`
   (permissions) in the same commit.
