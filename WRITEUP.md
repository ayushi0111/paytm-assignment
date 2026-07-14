# Write-up

## 1. What did I ask the AI to do, and what did I decide myself?

I used Claude Code for the entire implementation — schema, services, routes, tests,
README — but drove every product decision myself. The base assignment (shorten,
redirect, custom alias, collision-free codes, dedupe policy) was scoped up front. Mid-build
I deliberately expanded it: per-user accounts, a dashboard restricted to the link's
creator, the ability to update a link's destination, and a Bloom filter specifically for
custom-alias uniqueness checks. Because that changes the data model (links need an
owner) and the duplicate-URL policy (dedupe now has to be per-owner, not global), I had
Claude re-enter plan mode and write out a full data model and route plan before touching
any code, rather than let it improvise the model incrementally. I picked the concrete
choices at each fork it surfaced: Node/TS/Express/SQLite over the alternatives it
offered, API-key auth (with a real signup email+password) over full JWT, and
`owner_id`-scoped dedupe over global dedupe.

## 2. Where did I override or correct the AI's output?

- Made it stop and produce a written plan (data model, auth approach, commit
  breakdown) before generating code, once the scope grew past the original single-file
  shortener — a scope change of that size shouldn't be improvised commit-by-commit.
- Rejected the default git branch name (`master`) and had it rename to `main`.
- Told it explicitly not to push to the remote — commits stay local until I push myself.
- Its own test suite caught a real bug before I had to: a "strip trailing slash on
  root path" branch in `normalizeUrl` turned out to be dead code (Node's `URL` class
  snaps an empty pathname back to `/`), and a `tsconfig` with `rootDir: "."` was
  silently nesting the compiled build under `dist/src/…`, so `npm start` (which expects
  `dist/server.js`) would have failed despite `tsc` reporting success. Both were only
  caught because I insisted on running the actual compiled server, not just trusting a
  green typecheck.

## 3. Biggest trade-offs

- **API key over JWT.** Simpler (no refresh/expiry logic), but no revocation or
  rotation story — fine for this scope, not for production.
- **Bloom filter as an optimization, not the uniqueness mechanism.** The ask was to use
  a Bloom filter for custom-alias uniqueness; I kept the DB's `UNIQUE(code)` constraint
  as the actual source of truth and used the filter only to skip a DB read when it's
  certain an alias is free. A Bloom filter alone can false-positive and can't delete
  entries, so it's structurally the wrong tool to rely on for correctness by itself.
- **Per-owner dedupe over global dedupe.** Once links have owners, deduping globally
  would silently hand a second user someone else's code/link — their dashboard would
  show a link they don't control. Scoping the dedupe key to `(owner_id,
  normalized_url)` costs an extra index and a slightly bigger row set, in exchange for
  correct ownership semantics.
- **One-shot reachability probe over no check or a background health-checker.** I
  added a live `HEAD` request against the destination on first creation, surfaced as a
  non-fatal `warning` if it fails, rather than either skipping this entirely or building
  a scheduled recheck job — the latter felt like real scope creep for what was asked.

## 4. What's missing / what I'd do with another day

- The reachability probe has no SSRF hardening (no block on localhost/private IP
  ranges) — the server will make an outbound request to whatever URL a user supplies.
  This is the first thing I'd fix.
- Generated codes are sequential ids run through a reversible encoding, so they're
  enumerable even though they can't collide. I'd swap the plain offset for a reversible
  bit-mixing step (e.g., a small Feistel network over the id space) to keep the
  collision-freedom guarantee while making codes non-predictable.
- No rate limiting anywhere (auth endpoints are brute-forceable; `/shorten` and the
  redirect have no throttling).
- No API key rotation/revocation/expiry.
- `GET /api/links` has no pagination — fine at test scale, not at real scale.
- The "dashboard" is a JSON API only; there's no UI on top of it.
