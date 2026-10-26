# RBAC — Roles and Permissions

## Role model

Three tiers. One privileged user is provisioned from the CLI; everyone else
registers as a plain `Client` and cannot escalate themselves.

| Role | Who | Intent |
|---|---|---|
| `SuperAdmin` | `admin` (seeded) | Operator. Full control, including visibility into other users' status |
| `Subscriber` | `admin1`…`admin5` (seeded) | Seller/member. May list and mint NFTs, but sees only its own wallet |
| `Client` | anyone via `POST /register` | Read-only participant: browse the gallery, see own balance |

`role` lives in `models/User.js` (`enum`, default `Client`) and is copied into
the JWT payload at login.

### Status

| Step | Status |
|---|---|
| Two-role model (`Admin` / `Client`) | ✅ done — this is what the code ships today |
| Three-role model (`SuperAdmin` / `Subscriber` / `Client`) | 🚧 being implemented |
| `GET /api/users/status` (superadmin user-status view) | 🚧 being implemented |

Until the migration runs, every `Admin` holds every privileged permission, which
is why the seeded accounts are indistinguishable today.

## Permission matrix

| Capability | SuperAdmin | Subscriber | Client | Endpoint |
|---|---|---|---|---|
| Login / register | ✅ | ✅ | ✅ | `POST /login`, `POST /register` |
| Browse gallery | ✅ | ✅ | ✅ | `GET /api/nfts` |
| Own wallet balance | ✅ | ✅ | ✅ | `GET /api/wallet/balance` |
| Edit own profile | ✅ | ✅ | ✅ | `PUT /api/users` |
| Sell: upload asset | ✅ | ✅ | ❌ 403 | `POST /api/nfts` |
| Edit listing | ✅ | ✅ | ❌ 403 | `PUT /api/nfts/:id` |
| Mint on-chain | ✅ | ✅ | ❌ 403 | `POST /api/nfts/mint` |
| List active users | ✅ | ❌ 403 | ❌ 403 | `GET /api/users` |
| View user status (balance, NFT count, last login) | ✅ | ❌ 403 | ❌ 403 | `GET /api/users/status` |
| List deactivated users | ✅ | ❌ 403 | ❌ 403 | `GET /api/users/inactive` |
| Deactivate / reactivate a user | ✅ | ❌ 403 | ❌ 403 | `DELETE /api/users/:id`, `PUT /api/users/:id/reactivate` |
| Bid / buy / transfer | ❌ | ❌ | ❌ | not implemented — see roadmap |

Deliberate gaps (documented so nobody assumes otherwise):

- `PUT /api/nfts/:id` is **not** owner-scoped: `NFT` has no `ownerId`, so a
  Subscriber can edit any listing. Acceptable while the gallery is shared; fix
  by adding `uploadedBy` to the model when per-user listings are introduced.
- Minting does not require the caller to own a wallet balance — the server's
  owner key pays gas.

## Enforcement points

RBAC is enforced in exactly one place — the API. UI checks are cosmetic.

| Layer | File | Mechanism |
|---|---|---|
| Primitive | `middleware/authenticateToken.js` | `requireRole(...roles)` after `authenticateToken` |
| User management | `routes/userRoutes.js` | `requireRole('SuperAdmin')` on the four admin routes |
| NFT write paths | `routes/nftRoutes.js` | `requireRole('SuperAdmin','Subscriber')` on upload, edit, mint |
| Token issuance | `routes/authRoutes.js` | Role comes from the DB record, never from the request body |
| Frontend (cosmetic) | `frontend/src/auth.js` | `hasRole()`, `isSuperAdmin()`, `canSell()` drive nav/buttons only |

`requireRole` is variable-argument, so adding a role to an existing endpoint is
a one-line change. Example:

```js
router.post('/nfts/mint', authenticateToken, requireRole('SuperAdmin', 'Subscriber'), handler);
```

### Why the role is in the token

Pros: no DB read per request. Cons: a role change (or deactivation) is not felt
until the token expires — max **1 hour**. If instant revocation becomes a
requirement, either shorten the TTL, or look the user up per request and compare
`role`/`isActive`.

## Provisioning and migration

```bash
# Seed a privileged user (defaults to SuperAdmin when role is omitted)
node scripts/createAdmin.js admin s3cret 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1
node scripts/createAdmin.js admin1 s3cret 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 Subscriber

# One-off, idempotent: Admin -> SuperAdmin (for 'admin'), other Admins -> Subscriber
node scripts/migrateRoles.js           # add --dry-run to preview
```

Rules of thumb:

- Never add a back door that lets `/register` set a role.
- After changing roles in the DB, users must log in again to receive a token
  with the new role.
- Seeded privileged users must be given a real (Ganache) address if they are
  expected to hold minted NFTs.

## Adding a new role — checklist

1. Extend the `enum` in `models/User.js`.
2. Add a row to the permission matrix above.
3. Update the `requireRole(...)` lists on the affected routes.
4. Update the frontend helpers (`hasRole`, `canSell`, `isSuperAdmin`) and the
   nav/route guards so the UI matches.
5. Add a test for: allowed → 2xx, one role below → `403`.
6. Log the decision in `development-state.md`.
