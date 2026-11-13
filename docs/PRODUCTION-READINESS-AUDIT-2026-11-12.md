# Production-Readiness Audit — WishesAndDOOs

**Date:** 2026-11-12 (evening) / 2026-11-13 early UTC
**Auditor:** `opencode:d98c021f` (report-only; no application code changed)
**Concord task:** `PROD-AUDIT-2026-11-12` (workspace `github.com/jliel/wishesanddoos`)
**Scope:** the production scaffolding added alongside the security remediation — `apps/api/Dockerfile`, `apps/api/entrypoint.sh`, `apps/client/Dockerfile`, `apps/client/nginx.conf`, `docker-compose.prod.yml`, `.env.production.example`, `apps/api/.env.example`, `apps/api/app/config.py`, `apps/api/app/__init__.py`, `apps/api/migrations/`, `.github/workflows/ci.yml`, `.gitignore`.
**Not in scope:** application feature code under active edit by `antigravity:072f58c5` (`SECURITY-REMEDIATION-2026-11-12`). Findings below that touch those files are called out so the owner can fold them into that task.

> **Snapshot caveat.** The working tree was being edited during this audit (files changed at 22:57–23:14 local). Line numbers and behaviours are from that snapshot. Items marked *verified* were exercised; items marked *read* are static analysis only.
>
> **Docker is not installed on this machine.** Image builds, `docker compose config`, and container runtime behaviour could **not** be executed. Everything Docker/nginx/compose below is static review plus local equivalents (Flask app factory, Alembic, pytest). Treat container-specific claims as high-confidence-but-unrun until CI builds them.

---

## Verdict

**Not production-ready yet.** The scaffolding is a solid skeleton — multi-stage non-root images, fail-fast secrets, gated demo seeding, a clean initial migration, and a real CI workflow. But there are **4 release blockers** and several deploy-time footguns that will either 500 on first use, silently run with a known database password, or leak signing keys into git.

| Gate | Status |
|---|---|
| Secrets cannot ship as repo defaults | ✅ fixed (`ProductionConfig.validate_secrets`) |
| Alembic initial migration applies cleanly | ✅ verified (fresh DB → `60395320a95b`, `db check` clean) |
| Test suite green | ❌ `1 failed, 33 passed` |
| Authenticated media serving works | ❌ every authenticated image request → **500** |
| `.env.production` cannot be committed | ❌ not gitignored |
| Rate limits survive multiple workers | ❌ `memory://` × 3 workers |
| Health check reflects DB health | ❌ always `200` / `"ok"` |
| TLS / HSTS | ❌ HTTP only |
| Backups / restore runbook | ❌ none |
| Deployment docs | ❌ `README.md` is one line |

---

## Findings

Severity reflects "what breaks or gets compromised when this exact stack is deployed as written".

### P0 — Blocks deployment

#### P0-1. Image tenancy check is broken: every authenticated image request returns 500

`apps/api/app/modules/wishes/routes.py:199-216`

```python
try:
    user_id = decode_access_token(token)      # returns the whole payload dict
except Exception:
    ... 401
membership = (
    db.session.query(WorkspaceMember)
    .filter_by(workspace_id=target_workspace_id, user_id=user_id)  # dict -> SQLAlchemy error
    .first()
)
```

`decode_access_token()` (`app/core/security.py:56-62`) returns `dict[str, Any]`, not a user id. Passing the dict to `filter_by` raises and the generic 500 handler answers.

**Verified live** (throwaway SQLite, `FLASK_ENV=development`, port 5011):

```
login: 200
upload: 201
GET image without token: 401  {"error":"unauthorized", ...}
GET image with ?token=:  500  {"error":"internal_server_error", ...}
GET image with Bearer:   500  {"error":"internal_server_error", ...}
```

**Effect:** the exact regression the remediation was meant to close (H4: unauthenticated image fetch) now fails closed for anonymous users but is unusable for legitimate users. Any screen that renders a wish image breaks.

**Server-side proof** (dev server log, throwaway DB):

```
sqlalchemy.exc.ProgrammingError: (sqlite3.ProgrammingError)
  Error binding parameter 2: type 'dict' is not supported
[SQL: SELECT workspace_members... WHERE workspace_members.workspace_id = ?
        AND workspace_members.user_id = ? LIMIT ? OFFSET ?]
[parameters: ('11e9a535-...', {'sub': '78ed1673-...', 'email': 'demo@wishesanddoos.app',
  'workspace_id': '11e9a535-...', 'type': 'access', 'jti': '...'}, 1, 0)]
```

The payload dict is bound directly as `user_id`, and on Postgres this will be a `ProgrammingError` → `500` too.

**Fix:**
```python
payload = decode_access_token(token)
user_id = payload["sub"]
```
Then update `apps/api/tests/test_wishes.py:137`, which still expects `200` with no credentials (it now gets `401`). The suite is currently `1 failed, 33 passed`.

---

#### P0-2. `?token=` puts a bearer token in URLs (logs, history, Referer, caches)

`apps/api/app/modules/wishes/routes.py:181-182`

Access tokens are accepted as a query parameter so `<img src>` can load them. That means a 15-minute bearer token is written to nginx `access_log`, gunicorn access logs, browser history, and any intermediate cache; it also leaks to third parties via `Referer` if the image is ever opened directly.

**Fix (pick one, in order of preference):**
1. HMAC-signed, short-lived image URLs: `/images/<ws>_<file>.webp?exp=<ts>&sig=<hmac(path+exp, SECRET_KEY)>`, verified server-side; no bearer in the URL.
2. A dedicated, scoped download token (audience `media`, single path, ≤60 s) instead of the API access token.
3. If keeping `?token=`, at minimum send `Cache-Control: private, no-store` on image responses and make sure nginx access logs redact query strings.

---

#### P0-3. `.env.production` is not gitignored

`.gitignore:27-30` covers only `.env`, `.env.local`, `.env.*.local`.

```
$ git check-ignore -v .env.production
(no output, exit 1)
```

`.env.production.example` instructs the operator to create `.env.production` containing the Postgres password and both signing keys. A normal `git add .` commits that file — the same class of leak as the tracked dev DB, but with live production credentials.

**Fix:**
```gitignore
.env.production
.env.production.*
!.env.production.example
```

Add a pre-commit `git-secrets`/`gitleaks` hook as a second line of defence.

---

#### P0-4. No `.dockerignore` in either image

- `apps/client/Dockerfile:12` — `COPY . .` with `context: ./apps/client`. Without a `.dockerignore` this copies host `node_modules/`, `dist/`, `.expo/`, and any local `.env*` into the builder layer (huge context, non-reproducible build, and secrets baked into a cached layer that is shared/pushed).
- `apps/api/Dockerfile:34-36` uses explicit `COPY app/`, but the build *context* is still `./apps/api`, so `.venv/`, `*.db`, `.env`, `__pycache__`, and `tests/` are sent to the daemon and stored in the build cache.

**Fix:** add `apps/api/.dockerignore` and `apps/client/.dockerignore` (`node_modules`, `dist`, `.expo`, `.env*`, `!.env.example`, `*.db`, `.venv`, `__pycache__`, `.git`, `coverage`, test artifacts).

---

### P1 — Deployable, but unsafe or broken in production

#### P1-1. Compose ships a known Postgres password by default

`docker-compose.prod.yml:8` and `:28`:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_this_strong_password_in_prod}
DATABASE_URL: postgresql://...:${POSTGRES_PASSWORD:-change_this_strong_password_in_prod}@postgres:5432/...
```

If the operator forgets `POSTGRES_PASSWORD`, the whole stack comes up healthy with a password that is in the repo, and `validate_secrets()` does **not** cover it (it only checks `SECRET_KEY`/`JWT_SECRET_KEY`). Postgres is not published to the host, which limits exposure, but any container on `wad_network` (or a future SSRF) can log in.

**Fix:** require the variable, don't default it:
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
SECRET_KEY: ${SECRET_KEY:?SECRET_KEY is required}
JWT_SECRET_KEY: ${JWT_SECRET_KEY:?JWT_SECRET_KEY is required}
```
(`SECRET_KEY`/`JWT_SECRET_KEY` are `${VAR}` today → empty string on miss; `validate_secrets()` catches it, but the compose error is earlier and clearer.)

#### P1-2. Rate limiting is per-process in-memory with 3 workers

`apps/api/app/config.py:42-43` defaults `RATELIMIT_STORAGE_URI=memory://`; `docker-compose.prod.yml:36` sets `WEB_CONCURRENCY: 3` and never overrides the storage URI.

Each gunicorn worker keeps its own counters, so the effective brute-force limit is ~3× the decorated value, resets on every deploy/restart, and diverges per worker. The login limiter (`5 per minute`) is the one that matters most.

**Fix:** add a Redis service and set `RATELIMIT_STORAGE_URI=redis://redis:6379/0` (Flask-Limiter supports it), or run a single worker until Redis exists and document the trade-off.

#### P1-3. Nginx body limit (1 MB default) is smaller than the upload limit (5 MB)

`apps/client/nginx.conf:52-59` has no `client_max_body_size`. Nginx default is **1 MB**; `apps/api/app/core/storage.py:18` allows **5 MB**.

A 1–5 MB image is rejected by nginx with a bare `413` before Flask can return its structured `file_too_large` error. Users see a broken upload with no explanation.

**Fix:**
```nginx
location /api/ {
    client_max_body_size 6m;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    ...
}
```

#### P1-4. Migration failure is swallowed, and the "fallback" does not exist

`apps/api/entrypoint.sh:4-10`:

```sh
flask --app wsgi.py db upgrade || {
    echo "Migration failed or database not ready yet; attempting fallback auto-create..."
}
```

`set -e` does not fire because the failure is handled by `||`. Nothing runs `create_all`, and compose sets `FLASK_AUTO_CREATE_DB=false` (`docker-compose.prod.yml:33`). The API therefore starts against an empty/unmigrated database and every request 500s — while the healthcheck may still pass (see P1-5).

**Fix:** fail closed.
```sh
flask --app wsgi.py db upgrade
```
or a bounded retry (`for i in $(seq 1 30); do ... sleep 2; done; exit 1`) for slow Postgres, then `exec gunicorn ...`. Also move migrations to a one-shot `migrate` service so scaling the API past 1 replica doesn't race.

#### P1-5. Health endpoint always returns `200`, even with the database down

`apps/api/app/modules/system/routes.py:12-40` computes `db_status`, puts it in the body, and returns `200` unconditionally. Both healthchecks (`apps/api/Dockerfile:50-51`, `apps/client/Dockerfile:29-30`) only look at the status code.

**Effect:** Docker/K8s see a healthy container during a DB outage; no restart, no traffic shift, no alert.

**Fix:** `503` when the probe fails, and split liveness (`/health/live`, no DB) from readiness (`/health/ready`, DB + migration head).

#### P1-6. Everything is HTTP; no TLS, no HSTS, no CSP

- `apps/client/nginx.conf:2` — `listen 80;` only.
- `docker-compose.prod.yml:56` — publishes `80:80`.
- `.env.production.example:15` uses `https://` origins, but nothing terminates TLS.
- No `Strict-Transport-Security` in nginx or in Flask's `after_request` (`apps/api/app/__init__.py:140-147`); no `Content-Security-Policy` anywhere.

**Fix:** terminate TLS in front (Caddy/Traefik/Cloudflare, or nginx `443` + certs), redirect 80→443, then add HSTS (`max-age=31536000; includeSubDomains`) and a report-only CSP first, tightened after the Expo bundle is audited.

#### P1-7. Environment selection fails open outside compose

`apps/api/app/__init__.py:21-23` picks `ProductionConfig` only when `FLASK_ENV=production`. The API image sets `FLASK_ENV=production` (`Dockerfile:44`), so compose is covered. But a bare `gunicorn "app:create_app()"`, a k8s manifest, or any other launcher that forgets `FLASK_ENV` silently gets dev `Config`: repo-default signing keys, dev CORS regex, and a SQLite fallback under `/app`.

**Fix:** make production fail closed — e.g. if `DATABASE_URL` is a `postgresql://` URL, require `FLASK_ENV=production`; or default `CONFIG_MAP.get(env, ProductionConfig)` inside the container.

#### P1-8. DB pool can exhaust Postgres

`apps/api/app/config.py:55-60`: `pool_size=10`, `max_overflow=20` → 30 connections/worker. `WEB_CONCURRENCY=3` → **90** against Postgres default `max_connections=100`, before migrations, psql, monitoring, or backup jobs.

**Fix:** document `(pool_size + max_overflow) * workers < max_connections - 10`, lower the defaults (e.g. 5+10), or put PgBouncer in front.

#### P1-9. The API port is published on host loopback, bypassing nginx

`docker-compose.prod.yml:44-45` publishes `127.0.0.1:${API_PORT}:5000`. Nginx already proxies `/api/` internally. The host mapping lets any local process (or an SSRF in another local service) talk to Flask directly, bypassing nginx's body limit and any TLS/security headers added there.

**Fix:** remove the `ports:` mapping; keep `expose: ["5000"]` for the compose network.

#### P1-10. Compose has no `env_file`, and docker compose reads `.env` by default

There is no `env_file:` entry and no `--env-file` in any doc. Operators are told to create `.env.production`, but `docker compose up` will silently read `.env` (or nothing). With `SECRET_KEY` unset the stack fails fast (good), but with only `POSTGRES_PASSWORD` unset it comes up on the known default (P1-1).

**Fix:** document `docker compose --env-file .env.production up -d`, or add `env_file: .env.production` to each service (and keep `.env.production` gitignored, per P0-3).

#### P1-11. `web` does not wait for a healthy `api`

`docker-compose.prod.yml:57-58` — `depends_on: [api]` only. Nginx starts as soon as the container exists, so first requests get `502` until gunicorn is listening. Minor, but avoidable.

**Fix:**
```yaml
depends_on:
  api:
    condition: service_healthy
```

---

### P2 — Hardening, operability, and documentation

#### P2-1. No log rotation or resource limits
No `logging: options: max-size/max-file`, no `mem_limit`/`cpus`/`pids_limit`, no `read_only` + `tmpfs` for nginx, no `security_opt: [no-new-privileges:true]`, no `stop_grace_period`. One noisy client or a leak fills the host disk or starves neighbouring services.

#### P2-2. No backup or restore path
Two stateful volumes (`postgres_data`, `uploads_data`, `docker-compose.prod.yml:62-64`) with no `pg_dump` job, no retention policy, no off-host copy, no restore runbook, and `uploads_data` is not covered by any dump at all. Data loss is currently unrecoverable.

#### P2-3. No observability
No Sentry/OpenTelemetry, no structured/JSON logs, no request IDs, no metrics endpoint, no alerting, no error budget. Only gunicorn access/error logs on stdout, and Docker's default `json-file` driver without rotation.

#### P2-4. No deployment documentation
`README.md` is a single heading. Missing: prerequisites, secret generation (`python -c "import secrets; print(secrets.token_hex(32))"`), which env file to use and how to pass it, first-run migration, TLS setup, backup/restore, upgrade and rollback, health verification, and the fact that `SEED_DEMO_DATA` must stay `false`. This is the single cheapest item to fix and prevents most of P1-1/P1-10.

#### P2-5. Floating base images, no supply-chain checks
`python:3.12-slim-bookworm` (`apps/api/Dockerfile:2,15`), `node:20-alpine` and `nginx:1.27-alpine` (`apps/client/Dockerfile:2,22`), `postgres:15-alpine` (`docker-compose.prod.yml:3`). No digest pinning, no SBOM, no image scanner, no `hadolint`. Patch level can change under you, or not change when you think it did.

#### P2-6. Client build is not deterministic
`apps/client/Dockerfile:10` — `npm ci || npm install` silently falls back when the lockfile drifts. `apps/client/Dockerfile:19` — `npx expo export` can resolve a different CLI than the repo pins. Both undermine "the image built in CI is the image that runs".

**Fix:** fail on `npm ci`; use `npm exec --no-install expo export` (or `./node_modules/.bin/expo export`).

#### P2-7. No upload quota or orphan cleanup
`storage.py` caps one file at 5 MB and 25 MP (`storage.py:18-20`) — both good — but there is no per-workspace count/byte quota, and no evidence that deleting a wish removes its file from `uploads_data`. The volume only grows.

#### P2-8. No Flask `MAX_CONTENT_LENGTH`
`config.py` never sets it. Oversized bodies are buffered by Werkzeug before the 5 MB check in `storage.py:42`. Set `MAX_CONTENT_LENGTH = 6 * 1024 * 1024` so the framework rejects early, and keep the PIL checks as defence in depth.

#### P2-9. CORS base default is LAN-permissive
`config.py:9-14` allows `http://192.168.101.18:8081` plus the regex `^http://192\.168\.\d+\.\d+(:\d+)?$` with credentials when `CORS_ORIGINS` is unset. Compose overrides it (`:31`), so the shipped stack is okay, but any non-compose deployment falls back to allowing the whole LAN. Make the production default deny-all.

#### P2-10. CI gaps
`.github/workflows/ci.yml` is a real improvement (Postgres service, pytest, migration apply, typecheck, jest, `expo export`). Still missing:
- dependency/vulnerability gates (`pip-audit`, `npm audit --omit=dev`),
- Docker build + `docker compose config` validation (the only way to catch P0-4/P1-3/P1-4 before deploy),
- `flask db check` drift gate (models vs migrations),
- coverage threshold,
- documented branch protection / required checks.

Also note the migration step doesn't set `SECRET_KEY`/`JWT_SECRET_KEY`; safe only while `FLASK_ENV` isn't `production` there.

#### P2-11. `create_all` has no production guard
`apps/api/app/__init__.py:55-69` keeps `FLASK_AUTO_CREATE_DB=true` as the default and only compose turns it off. Add a guard: refuse to start if `create_all` is enabled while `FLASK_ENV=production`.

#### P2-12. Migration verification only proves the empty-DB path
There is exactly one migration (`60395320a95b`). Fresh `upgrade` and `db check` both pass (verified), but there is no upgrade-from-previous-version test because no previous version exists. Keep an explicit "expand/contract" note so the first schema change is tested both ways.

---

## What is right (don't undo it)

- **Multi-stage API image**, non-root `uid 10001`, build tools only in the builder stage, `PYTHONUNBUFFERED`/`PYTHONDONTWRITEBYTECODE`, `curl` healthcheck, `exec` for correct signal handling.
- **Fail-fast secrets verified.** With `FLASK_ENV=production` and no `SECRET_KEY`/`JWT_SECRET_KEY`, the factory raises at startup:
  `RuntimeError: CRITICAL SECURITY: In production, SECRET_KEY must be set to a secure random string of at least 32 characters.`
  The earlier default-secret JWT forgery no longer works.
- **`wsgi.py`** no longer runs `debug=True` or binds `0.0.0.0`; local dev binds `127.0.0.1`.
- **Demo seeding is gated** and defaults to off in production (`__init__.py:60-66`, `docker-compose.prod.yml:34`); verified that only `FLASK_SEED_DEMO_DATA=true` brings the demo account back.
- **Migrations verified:** fresh DB → `0001_initial_schema` at `60395320a95b`; `flask db check` → *"No new upgrade operations detected."*; dev DB at the same head.
- **Upload pipeline is genuinely hardened:** 5 MB cap, `Image.verify()`, `Image.MAX_IMAGE_PIXELS = 25_000_000`, EXIF transpose + full re-encode to WebP, random UUID filename, `os.path.basename` on read.
- **`?limit=` is now safe:** clamped to `1..500` with a graceful fallback instead of a 500 (`finances/routes.py:125-129`).
- **Postgres is not published to the host**, and the API is bound to loopback only — network posture is better than most first-cut compose files.
- **CI runs the real thing:** Postgres service, `pytest`, an actual Alembic upgrade, frontend typecheck, Jest, and a production `expo export`.

---

## Verification log

| Check | Result |
|---|---|
| `flask db upgrade` on fresh SQLite | ✅ exit 0, → `60395320a95b` |
| `flask db check` | ✅ "No new upgrade operations detected" |
| Dev DB `alembic_version` | ✅ `60395320a95b` |
| `pytest` (API, full suite) | ❌ `1 failed, 33 passed` — `test_wish_image_upload_and_exif_stripping` expects `200`, gets `401` |
| Live image auth probe (throwaway DB, :5011) | ❌ no token → `401` (correct); `?token=`/Bearer → `500` (P0-1) |
| `ProductionConfig` with missing secrets | ✅ raises `RuntimeError` at factory time |
| Demo seeding in prod config | ✅ off unless `FLASK_SEED_DEMO_DATA=true` |
| `git check-ignore .env.production` | ❌ exit 1 — not ignored (P0-3) |
| `.dockerignore` present | ❌ none in repo (P0-4) |
| Python dependency scan (OSV, 16 pkgs) | ✅ no known vulnerabilities |
| `npm audit --omit=dev` (client) | ⚠️ 28 advisories (1 critical `tar`, 7 high; `query-string` is the only direct runtime one) — track, unrelated to this scaffolding |
| Docker build / compose config | ⛔ not run — `docker` unavailable on host |

---

## Suggested order

1. **P0-1** fix `payload["sub"]` + update `test_wishes.py` → get the suite green (small, unblocks the rest).
2. **P0-2** replace `?token=` with signed media URLs (design with the client image component).
3. **P0-3 + P0-4** `.gitignore` + two `.dockerignore` files (minutes of work, permanent risk removal).
4. **P1-1, P1-3, P1-4, P1-5, P1-9** compose/nginx/entrypoint/health fixes — these are what actually turn "it builds" into "it runs".
5. **P1-2** Redis-backed limiter (or document single-worker until then).
6. **P1-6** TLS + HSTS + CSP, then **P2-4** the deployment README that encodes all of it.
7. **P1-7, P1-8, P1-10, P1-11** fail-closed config, pool sizing, env file, health dependency.
8. **P2-1/2/3/5/6/10** ops hardening and CI gates.

---

*Report-only. No application code, compose file, Dockerfile, or nginx config was modified by this audit. All live tests used a throwaway SQLite database; the dev database was not touched.*
