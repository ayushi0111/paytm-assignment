# URL Shortener & Link Analytics

A small URL shortener with per-user accounts, custom aliases, click analytics, and a
collision-free short-code generator. Node.js + TypeScript + Express + SQLite (via
`better-sqlite3`).

## Install & run

Requires Node 18+ (built with Node 22).

```bash
npm install
npm run dev        # dev server with auto-reload, http://localhost:3000
```

For a production-style run:

```bash
npm run build
npm start
```

The SQLite file is created automatically at `data/urls.sqlite` (override with the
`DATABASE_PATH` env var). Other env vars: `PORT` (default `3000`), `BASE_URL` (used to
build the `shortUrl` field in responses; default `http://localhost:<PORT>`).

## Test

```bash
npm test            # all unit + integration tests (Jest + supertest)
npm run test:watch
```

Unit tests use an in-memory SQLite database (`:memory:`); integration tests exercise the
full Express app through `createApp()`. No test makes a real network call — the
reachability checker used by `POST /shorten` is dependency-injected and stubbed in tests.

## API

All request/response bodies are JSON.

### `POST /auth/signup`

```json
{ "email": "you@example.com", "password": "at least 8 chars" }
```

→ `201 { "apiKey": "..." }`. `409` if the email is already registered.

### `POST /auth/login`

```json
{ "email": "you@example.com", "password": "..." }
```

→ `200 { "apiKey": "..." }` (the same key issued at signup — keys aren't rotated).
`401` on bad credentials.

Send the key as `Authorization: Bearer <apiKey>` on every request below.

### `POST /shorten` (auth required)

```json
{ "url": "https://example.com/some/long/path", "customAlias": "optional-alias" }
```

- `201` with the created link, or `200` if the same URL was already shortened by this
  user (see **Duplicate URLs**, below).
- `409` if `customAlias` is already taken.
- `400` for an invalid URL or a malformed alias.
- The response may include a non-fatal `"warning"` field if the destination URL didn't
  respond to a reachability probe — the link is still created (see **Reachability
  warning**, below).

### `GET /:code`

Redirects (`301`) to the original URL and increments its click count. `404` for an
unknown code.

### `GET /api/links` (auth required)

Lists every link owned by the caller, each with its click count and metadata.

### `GET /api/links/:code` (auth required)

Detail for one of the caller's own links. `404` (not `403`) if the code doesn't exist
*or* belongs to someone else — this avoids confirming a code's existence to non-owners.

### `PATCH /api/links/:code` (auth required)

```json
{ "url": "https://example.com/new-destination" }
```

Updates the link's destination. The code, owner, and click count are immutable.
`404` under the same owner-or-unknown rule as above.

## Design decisions

**Short codes can't collide.** Generated codes are a base62 encoding of the row's own
SQLite `AUTOINCREMENT` id. Base62 encoding is a bijection (a positional-numeral-system
conversion), so two different ids can never encode to the same string. Since the id is
already guaranteed unique by the primary key, the code is too — by construction, not by
random-and-hope. See `src/utils/base62.ts` and its round-trip/no-duplicates tests.

**Custom aliases use a Bloom filter, backed by a DB constraint.** A small self-built
Bloom filter (`src/utils/bloomFilter.ts`) is rebuilt from existing custom codes on
startup. On a new alias request: if the filter says "definitely not present," the DB
existence check is skipped entirely (fast path). If it says "maybe present," a DB read
confirms it. Either way, the `UNIQUE(code)` constraint is the actual correctness
guarantee — a Bloom filter alone can't safely enforce uniqueness (false positives, no
deletion), so it's used only to avoid an unnecessary read, never as the source of truth.

**Duplicate URLs are deduplicated per owner, not globally.** Shortening a URL you've
already shortened returns your existing code (`200`, idempotent) instead of creating a
new row. Two different users shortening the same URL get independent codes and
independent click counts — handing user B a code owned by user A would put an entry on
B's dashboard for a link they don't actually control. A custom-alias request always
creates a new row, since picking a name is explicit intent.

**Auth is a plain API key, not JWT.** Signup hashes the password with `bcryptjs` and
issues a random 48-char hex key; login re-issues the same key. No sessions, no
expiry/refresh. This was a deliberate scope trade-off — real accounts with hashed
passwords, without building out a token-refresh story for a take-home.

**Reachability warning, not a hard validation error.** `POST /shorten` still requires a
syntactically valid `http`/`https` URL (`400` otherwise). Separately, on first creation
it probes the destination once (`HEAD`, ~3s timeout). If the destination doesn't
respond, the link is still created — the response just includes a `warning` field. Any
actual HTTP response (even `404`/`500`) counts as reachable; only a network-level
failure counts as unreachable. This does mean the server makes an outbound request to a
user-supplied URL, which in a real deployment would need an allowlist/deny-private-IP
step to avoid SSRF — noted here rather than built, given scope.

## Project structure

```
src/
  db.ts                  SQLite schema + connection
  errors.ts              Typed errors mapped to HTTP status by middleware/errorHandler
  types.ts               Shared row types
  utils/                 base62, URL validation/normalization, Bloom filter, reachability
  auth/                  password hashing, API key generation
  services/               userService, urlService (all business logic)
  middleware/             requireAuth, errorHandler
  routes/                 auth, links (shorten/dashboard/update), redirect
  app.ts / server.ts      Express wiring / bootstrap
tests/
  unit/                   one file per module, in-memory DB, no network calls
  integration/            full app.ts flow via supertest
```

## What's missing / next steps

See the write-up (`WRITEUP.md`) for the fuller list, but briefly: no rate limiting, no
API-key rotation, the reachability probe has no SSRF hardening, and short codes are
still sequentially guessable (an attacker can enumerate low ids) since obscuring that
was out of scope here.
