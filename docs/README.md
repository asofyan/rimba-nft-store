# Backend Docs

Living documentation for the Rimba NFT Store backend. The repository root
`README.md` covers *install and first run*; this folder covers *how the system
works and where it is going*.

| File | Contents | Update when |
|---|---|---|
| [architecture.md](architecture.md) | Runtime topology, module map, request flows, data model, storage, error handling, extension points | A module, flow, or dependency is added/removed |
| [api.md](api.md) | Endpoint reference, auth header, status codes, error shapes, pagination/limits | Any route, payload, or status code changes |
| [rbac.md](rbac.md) | Role model, permission matrix, enforcement points, seeding & migration, how to add a role | Roles or permissions change |
| [development-state.md](development-state.md) | Phase status, known gaps, decision log, verification commands | Every meaningful change — this is the project's memory |

## Conventions

- **English.** Same language as the root README.
- **Status markers** are used consistently:
  `✅ done` · `🚧 in progress` · `📋 planned` · `⚠️ known gap` · `❌ not implemented`
- **Evidence over prose.** Reference real paths (`routes/nftRoutes.js:158`) so a
  claim can be re-checked. If a statement can be verified by a command or a
  test, name that command/test.
- **Docs move with the code, in the same commit.** If a change makes a doc
  wrong, the doc is part of the change — not a follow-up.
- **Planned ≠ implemented.** Anything not yet in the code is marked `📋` and
  listed in `development-state.md`. Never describe a plan as if it were a fact.

## Where to write what

- New endpoint → matrix row in `api.md` + role row in `rbac.md` + a bullet in
  `development-state.md`.
- Changed data model → `architecture.md` (Data model) + one line in the
  decision log if it was a trade-off.
- New module/file → `architecture.md` module map.
- Bug with a permanent lesson → short entry in the decision log of
  `development-state.md` (what happened, what was decided, why).
