# Security Penetration Test — WishesAndDOOs (2026-11-12)

> **Target:** current working tree (`apps/api` Flask API + `apps/client` Expo web client)
> **Method:** source review + live HTTP testing against a throwaway instance
> **Environment:** `http://127.0.0.1:5010/api/v1`, temporary SQLite DB, default configuration (`debug=False`)
> **Tester:** OpenCode (`opencode:d98c021f`) — Concord task `SECURITY-PENTEST-2026-11-12`
> **Disclosure scope:** local, owner-authorized testing only. No external host was targeted.

---

## 1. Executive summary

The application has a solid security foundation (Argon2id, pinned HS256, refresh-token
rotation with reuse detection, HttpOnly refresh cookie, consistent workspace checks on most
resources, ORM-only queries, path-traversal-safe image serving). However, several
**release-blocking issues** were confirmed with working proof-of-concept requests:

| # | Severity | Confirmed issue |
| :- | :--- | :--- |
| C1 | **Critical** | Hardcoded default JWT signing secret → a token forged from the repository source is accepted (`200 OK` on `/auth/me`) |
| C2 | **Critical** | `wsgi.py` starts Flask with `debug=True` bound to `0.0.0.0` (Werkzeug debugger exposure; also silently removes the `Secure` cookie flag) |
| H1 | **High** | Demo account with a fixed password is auto-created on every startup, in every environment |
| H2 | **High** | Wish images are served with **no authentication** and no signed/expiring URL (`200` without any token) |
| H3 | **High** | Cross-tenant write: a user can attach a transaction to another workspace's savings goal (confirmed goal balance changed) |
| H4 | **High** | Password change is completely broken (`verify_password` arguments swapped) → users cannot rotate a compromised password |
| H5 | **High** | Every transaction edit returns `500` **after committing** → UI reports failure while data is already changed, and the audit event is lost |
| H6 | **High** | Access **and refresh** tokens are stored in `localStorage` on web; refresh token is also returned in the JSON body, defeating the HttpOnly cookie design |
| H7 | **High** | The development SQLite database is committed to git, containing real email addresses and Argon2 password hashes (PII + offline-crackable material) |

Nine medium and six low/informational findings follow. Dependency scan: **Python packages
clean** (OSV, 16 packages scanned); npm reports 28 advisories (1 critical, 7 high), mostly
build tooling, with one direct runtime package (`query-string`).

**Release recommendation:** do not expose this build to untrusted networks until C1–C2,
H1–H3 and H7 are fixed. H4–H6 are required for a credible "secure by design" claim.

---

## 2. Scope and method

### In scope
- `apps/api/app/**` — Flask app factory, config, decorators, storage, all blueprints/services
- `apps/client/src/**` — auth store, API client
- Dependency manifests (`requirements.txt`, `package.json`)
- Repository hygiene (tracked secrets/data, git history)

### Tested live
Health/headers, login, registration, refresh rotation, logout, forged JWTs
(`alg=none`, HS256 with the repo default secret), cross-tenant IDOR on wishes,
accounts, transactions, savings goals, unauthenticated image retrieval, CORS
preflight/origin reflection, SQL-injection probes, rate limiting/lockout, input
handling on `limit`, and image path traversal.

### Not covered
TLS configuration, production Postgres behaviour, mobile (iOS/Android) binary
storage, e-mail flows (none implemented), third-party hosting/S3 signed URLs
(not implemented), and full browser-based XSS/clickjacking testing.

---

## 3. Detailed findings

### C1 — Hardcoded default JWT / app secrets (Critical)

`apps/api/app/config.py:10-11`

```python
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-32b")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-key-change-in-prod-32b")
```

Anyone with the source can mint a valid access token for **any** user id.

**Evidence (live):**

```
[critical] Default JWT secret forgery:
token signed with "dev-jwt-secret-key-change-in-prod-32b" -> GET /auth/me = 200
```

Good news: `alg=none` is correctly rejected (`401`), and the algorithm is pinned.

**Fix**
- Remove silently-defaulting secrets. Fail fast at startup when `SECRET_KEY` /
  `JWT_SECRET_KEY` are missing outside `TestingConfig`.
- Require ≥32 random bytes, e.g. `python -c "import secrets;print(secrets.token_urlsafe(48))"`.
- Introduce distinct `DevelopmentConfig` / `ProductionConfig` classes.
- Rotate the secret if this build was ever deployed.

---

### C2 — Flask debug server exposed on all interfaces (Critical)

`apps/api/wsgi.py`

```python
app.run(host="0.0.0.0", port=5000, debug=True)
```

The Werkzeug debugger can lead to remote code execution when reachable, and stack
traces leak internals. Debug mode also flips the refresh cookie to **not Secure**
(`auth/routes.py:31`), so the cookie can travel over cleartext HTTP.

**Fix**
- `wsgi.py` should export `app` only; run via `flask run` or gunicorn/waitress.
- Never bind `0.0.0.0` with the reloader/debugger outside an isolated dev machine.
- Decouple cookie security from `debug`: always `Secure` unless an explicit
  `ALLOW_INSECURE_COOKIES=true` dev flag is set.

---

### H1 — Permanent backdoor demo account (High)

`apps/api/app/modules/auth/service.py:17-18,142-188`; called unconditionally from
`app/__init__.py:41` on every boot.

```python
DEMO_EMAIL = "demo@wishesanddoos.app"
DEMO_PASSWORD = "DemoPassword123!"
```

Any deployed instance contains a known-credential account (and seeds sample financial
data into it). There is no environment gate.

**Fix**
- Seed only when `ENV == "development"` / `SEED_DEMO_DATA=true`.
- Generate a random password on first seed and log it once, or require the operator to set it.
- Delete/disable the demo user in production migrations.

---

### H2 — Wish images served without authentication (High)

`apps/api/app/modules/wishes/routes.py:168-175`

```python
@wishes_bp.route("/images/<path:filename>", methods=["GET"])
def serve_wish_image_route(filename):   # no @require_auth, no workspace check
    ...
    return send_file(clean_path, mimetype="image/webp")
```

Architecture §4.2 requires private storage with **short-lived signed URLs**. Filenames
are unguessable (`<workspace>_<uuid>.webp`), but any leaked URL (chat, screenshot,
`Referer`, proxy logs) yields permanent public access; deleting a wish never deletes
the file.

**Evidence:** uploaded an image, then `GET /api/v1/wishes/images/...webp` with no
`Authorization` header → `200`.

**Fix**
- Require auth + workspace membership and verify the file's workspace prefix.
- Or issue time-limited signed URLs (HMAC with expiry) and store objects privately.
- Delete the object on wish delete; add a cleanup job for orphans.

---

### H3 — Cross-tenant write through transaction update (High)

`apps/api/app/modules/finances/service.py:395-469`

`account_id` is validated against `tx.workspace_id` (line 424), but
`category_id` (line 429) and `savings_goal_id` (line 431) are assigned without any
workspace check. The goal is then credited on the victim's record.

**Evidence (live, throwaway DB):**

```
PATCH /finances/transactions/<id>  {"savings_goal_id": "<demo workspace goal>"}
→ 500 (see H5) but the demo goal balance changed 2560.0 → 2610.0
```

The `500` is H5; the write is already committed, so this is a real integrity break
across tenant boundaries. IDs are UUIDs (low guessability), which limits mass abuse but
does not justify the missing check.

**Fix**
```python
if payload.category_id not in (None, "", "none"):
    category = db.session.query(Category).filter_by(
        id=payload.category_id, workspace_id=tx.workspace_id).first()
    if not category: raise FinancesError(...)
# same for savings_goal_id
```
Add regression tests that assert cross-workspace IDs are rejected.

---

### H4 — Password change always fails due to swapped arguments (High)

`apps/api/app/modules/workspaces/service.py:69`

```python
if not verify_password(current_password, user.password_hash):   # wrong order
```

`verify_password(password_hash, password)` is defined in `core/security.py:25`.
Verified locally: `verify_password(hash, correct)` → `True`;
`verify_password(correct, hash)` → `False`. Every change-password request returns
`400 invalid_current_password`, so a user who suspects compromise **cannot rotate their
password**. The endpoint also enforces only `len >= 8` (weaker than the 10+ registration
policy) and does not revoke existing sessions.

**Fix** — swap to `verify_password(user.password_hash, current_password)`, reuse the
registration strength validator, rate-limit the endpoint, and revoke all other sessions
on success (`revoke_session_token(user_id=...)` currently does not revoke — see M5).

---

### H5 — Transaction edit returns 500 after committing (High)

`apps/api/app/modules/finances/service.py:456-467`

```python
record_audit_event(..., metadata_json={...})   # auth.record_audit_event expects `metadata`
```

`finances/service.py` imports `record_audit_event` from `auth.service` (signature:
`metadata=`), so every `PATCH /finances/transactions/<id>` raises
`TypeError: unexpected keyword argument 'metadata_json'` **after** `db.session.commit()`.

**Impact:** the client shows an error although the edit and all balance adjustments are
persisted; the audit entry is missing; the API is effectively lying about failure.
Existing tests still pass (34/34) because no test exercises transaction update.

**Fix** — rename the kwarg to `metadata=` and add an update-transaction test asserting
both the response and persisted balance deltas.

---

### H6 — Tokens exposed to JavaScript / localStorage (High)

`apps/client/src/store/authStore.ts:9,71` persists the whole session payload
(access **and** refresh token) in `localStorage`. `src/api/auth.ts:141-143` sends the
refresh token in the request body as well, and the API returns it in JSON
(`auth/service.py:291,514`). This negates the HttpOnly cookie (architecture §4.1.3):
any XSS, malicious browser extension, or injected third-party script can exfiltrate a
14-day refresh token.

**Fix**
- Web: store **only** the access token in memory (Zustand, no persistence); rely on the
  HttpOnly refresh cookie and silent refresh on load.
- Native: `expo-secure-store` (already the documented plan).
- Stop returning `refresh_token` in the response body for cookie clients (keep it only
  for the native flow, gated by an explicit client type).
- Add a strict CSP (see M1) to reduce XSS reach.

---

### H7 — Development database committed to git (High)

`apps/api/wishes_and_doos_dev.db` is tracked (commits `708d8d3`, `fec13a4`) and
contains:

```
users: demo@wishesanddoos.app, example@gmail.com, kiritobaz@gmail.com
       (Argon2id hashes + salts)
user_sessions: 6+ refresh-token SHA-256 hashes (sessions, IPs, user agents)
```

`*.db` is not in `.gitignore`. Even though hashes are Argon2id, the emails are PII and
the file invites offline cracking of weak passwords.

**Fix**
- `git rm --cached apps/api/wishes_and_doos_dev.db` and add `*.db` / `*.sqlite*` to `.gitignore`.
- Purge from history (`git filter-repo`) before any public push.
- Rotate/revoke sessions and treat any password in that DB as compromised.

---

### M1 — Missing modern security headers (Medium)

`app/__init__.py:69-75` sets only `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`. Missing: `Strict-Transport-Security`, `Content-Security-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy`/`Resource-Policy`.

Architecture §3.2 promises Flask-Talisman; it is not in `requirements.txt`.

**Fix** — add Talisman (HSTS, CSP, frame options) behind a config flag, or set headers
manually with a web-specific CSP that permits the Expo bundle. Verify the Expo web build
under `Content-Security-Policy-Report-Only` first.

### M2 — CORS trusts every private-network origin (Medium)

`config.py:22-27`

```python
r"^http://192\.168\.\d+\.\d+(:\d+)?$"
```

Any device on the same LAN can host a page at `http://192.168.x.y:<port>` and receive
`Access-Control-Allow-Origin` **with credentials** (confirmed: `ACAO` echoed,
`ACAC=true`). Combined with H6, a same-LAN attacker page can read API responses if it
obtains a token. External origins are correctly rejected.

**Fix** — allow-list explicit dev origins from an env var; keep the LAN regex only in
`DevelopmentConfig`. Drop `supports_credentials` if cookies are not needed cross-origin.

### M3 — CSRF posture weaker than documented (Medium)

Refresh cookie uses `SameSite=Lax` (`auth/routes.py:32`), architecture says `Strict`.
`/auth/refresh` and `/auth/logout` have no CSRF token, and CORS allows credentials from
LAN origins. Lax blocks most cross-site POSTs, but not same-site/subdomain scenarios.

**Fix** — `SameSite=Strict` (or `None` + Secure + explicit CSRF token if cross-site is
required), and a double-submit CSRF token for state-changing cookie endpoints.

### M4 — Account enumeration (Medium)

- `POST /auth/register` returns `409 "An account with this email address already exists."`
  (confirmed live).
- `POST /auth/login` returns `429 account_locked` only for existing accounts.
- Unknown e-mail returns immediately without the Argon2 verification cost (timing oracle).

**Fix** — generic register response ("If this address is available you will receive…"),
perform a dummy Argon2 verify for unknown e-mails, and return the same
`invalid_credentials` message for locked accounts (log the lock server-side).

### M5 — Revocation is incomplete (Medium)

- Access tokens are stateless and remain valid after logout / session revoke for up to
  15 minutes (confirmed: logout `200`, then `/auth/me` with the same token `200`).
- `revoke_session_token(user_id=...)` (`auth/service.py:547-553`) only writes an audit
  event; it does **not** revoke sessions, contrary to its docstring — so "log out all
  devices" has no effect.
- Password change does not revoke sessions (confirmed: old refresh token still worked
  after the failed change attempt; the code path never revokes).

**Fix** — implement the bulk `UPDATE user_sessions SET is_revoked=1 WHERE user_id=…`,
call it on password change and "revoke all", and consider a `session_version` claim in
the access token checked by `require_auth` for immediate revocation.

### M6 — Unvalidated query/input causing 500s (Medium)

`finances/routes.py:125` — `limit = int(request.args.get("limit", 100))`
(confirmed: `?limit=abc` → `500`; `?limit=-5` and `?limit=999999999` accepted, no cap).

**Fix** — parse with a bounded default (`max(1, min(int_or_default, 200))`) and return
`400 invalid_limit` instead of an unhandled `ValueError`. Add a global JSON 500 handler
so stack traces are never returned.

### M7 — Image pipeline resource limits (Medium)

`core/storage.py` enforces 5 MB compressed size and re-encodes, but:
- no `Image.MAX_IMAGE_PIXELS` cap → decompression bombs can allocate hundreds of MB
  before the resize (`image.thumbnail`) — authenticated memory/CPU DoS;
- no upload rate limit or per-workspace quota → disk exhaustion;
- uploaded-but-unreferenced files and files of deleted wishes are never cleaned up.

**Fix** — set a pixel budget (e.g. 25 MP) and reject larger before decoding, rate-limit
`/wishes/upload-image`, enforce a per-workspace storage quota, add a cleanup job.

### M8 — Schema management and dependency drift (Medium)

`app/__init__.py:40` calls `db.create_all()` on every boot (no Alembic usage), and
`Pillow` (imported by `core/storage.py`) is **absent from `requirements.txt`** while
installed in the venv. Deployments can silently drift or fail.

**Fix** — generate/apply Alembic migrations in deployment; add and pin `Pillow`;
add `pip-audit` to CI.

### M9 — Inconsistent role enforcement (Medium)

`require_workspace_role` in `core/decorators.py:84` is **never used**. Authorization is
re-implemented ad hoc in each service, and `PATCH /workspaces/<id>` accepts any member
(including `viewer`) to rename/change currency. This inconsistency is the root cause of
H3.

**Fix** — standardise on the decorator (or a shared `authorize_workspace()` helper) for
every workspace-scoped route; require `owner`/`editor` for mutations.

### L1 — Client-side trust of stored references (Low)

`wish.image_storage_key` and `user.avatar_url` are accepted from request bodies without
validation. A user can point their wish at another tenant's stored filename (if known)
or store an arbitrary external URL. Path traversal on the image route is correctly
neutralised (`os.path.basename`); traversal probe returned `404`.

**Fix** — verify the storage key belongs to the caller's workspace and exists, or better,
let the server generate the key and accept only the upload token.

### L2 — Refresh rotation is not atomic (Low)

`auth/service.py:421-507` reads `is_revoked`, then writes. Two concurrent refresh calls
can both succeed before either revoke is visible (no `SELECT … FOR UPDATE` / unique
constraint on the replacement). Reuse detection may be bypassed.

**Fix** — perform the revoke-and-replace in one transaction with a row lock
(`with_for_update`) or a conditional `UPDATE … WHERE is_revoked = false` and check the
affected-row count.

### L3 — Minor code issues (Low/Info)

- `wishes/service.py:376-382` reads `wish.title` after `db.session.delete(wish)`.
- `finances/service.py:366-375` treats `transfer` as an expense from one account with no
  destination account — accounting semantics are incomplete.
- `login` rate limit is per-IP in memory (`memory://`), resets on restart, not shared
  across workers; `logout` is unlimited.
- The 5-failure lockout lets an attacker lock a known account for 15 minutes (DoSed
  availability).
- Client defaults to `http://<host>:5000` (`src/api/client.ts`) and `credentials:
  "include"` — tokens and cookies travel in cleartext on LAN.

### L4 — Dependency scan (Low/Info)

- **Python:** 16 pinned packages queried against OSV — **no known vulnerabilities**.
- **npm** (`npm audit --omit=dev`): 28 advisories — 1 critical (`tar`, build-time via
  `@expo/cli`), 7 high (`@xmldom/xmldom`, `cacache`, `decode-uri-component`,
  `image-size`, `postcss`, `@expo/cli`, direct `query-string`). Most are CLI/build
  supply-chain paths; `query-string` is runtime.

**Fix** — bump `expo` to a patched release (`npm audit fix`), override `query-string` /
`decode-uri-component`, and add `npm audit --omit=dev` + `pip-audit` to CI.

---

## 4. Controls that held up (keep them)

- **Argon2id** with OWASP parameters (`m=19456, t=2, p=1`); no plaintext logging found.
- **HS256 pinned**, `alg=none` rejected (`401`).
- **Refresh-token rotation + reuse detection** works: reusing a consumed token revokes all
  of that user's sessions (`auth/service.py:440-456`).
- **Refresh cookie**: `HttpOnly`, `Secure` (when debug off), `Path=/api/v1/auth`.
- **Tenant isolation on wishes/DOOs/finances objects**: cross-workspace reads returned
  `403`; unknown workspace id returned `403`; SQL-injection probe returned `403` (ORM
  parameterisation).
- **Image path traversal blocked** (`..%2F..%2F` → `404`); EXIF stripped by full
  re-encode to WebP.
- **Rate limiting** engaged as configured (login: `401,401,429,429…`).
- **No secrets in tracked text files** (scanned for common token patterns).
- **Test suite green**: `34 passed` (but see coverage gaps below).

## 5. Test coverage gaps

The suite has no tests for: cross-tenant IDOR on savings goals/categories, JWT
forgery/default secrets, rate-limit/lockout behaviour, password change, transaction
update (which is currently broken), token storage, or CORS policy. Recommended minimum
additions:

1. `update_transaction` happy path + `category_id`/`savings_goal_id` cross-workspace rejection.
2. `change_user_password` success + wrong-current-password + strength policy.
3. Forged-JWT matrix (`alg=none`, wrong secret, expired, `type=refresh` used as access).
4. Cross-tenant matrix for accounts, transactions, goals, wishes, DOOs.
5. Rate-limit test with `RATELIMIT_ENABLED=True`.
6. Upload limits: oversize file, non-image, decompression bomb, quota.

## 6. Prioritised remediation plan

**P0 — before any exposure (same day)**
1. C1: fail fast on missing/weak secrets; rotate.
2. C2: remove `debug=True` / `0.0.0.0` from `wsgi.py`.
3. H1: gate demo seeding to development only.
4. H4: fix `verify_password` argument order.
5. H5: fix `metadata_json` → `metadata` in `update_transaction`.
6. H7: untrack and purge the SQLite DB; rotate affected sessions.

**P1 — before public/live use**
7. H2: authenticate + scope image serving (or signed URLs).
8. H3: validate `category_id` / `savings_goal_id` against the transaction workspace.
9. H6: stop persisting the refresh token in `localStorage`; memory-only access token on web.
10. M9: centralise workspace authorization and apply role checks to mutations.

**P2 — hardening**
11. M1 headers (Talisman/HSTS/CSP), M2 CORS allow-list, M3 SameSite=Strict + CSRF.
12. M4 generic enumeration-safe responses + dummy hash.
13. M5 real session revocation and password-change revocation.
14. M6 bounded `limit` parsing + JSON 500 handler.
15. M7 pixel cap, upload rate limit, quota, orphan cleanup.
16. M8 Alembic migrations + pinned `Pillow`; CI dependency and secret scanning.
17. L1–L4 cleanups and dependency updates.

---

## 7. Reproducing the test

The temporary database (`%TEMP%\wad_pentest.db`) and the test upload were deleted after
the run; no existing dev data was modified. To re-run:

```powershell
cd apps/api
$env:DATABASE_URL="sqlite:///$env:TEMP\wad_pentest.db"
.\.venv\Scripts\python.exe -c "from app import create_app; app=create_app(); app.run(host='127.0.0.1', port=5010, debug=False, use_reloader=False)"
# then run the probe script (kept outside the repo in %TEMP%\wad_pentest.py)
```

Baseline test run after testing: `cd apps/api && PYTHONPATH=. .venv/bin/pytest -q` →
`34 passed`.
