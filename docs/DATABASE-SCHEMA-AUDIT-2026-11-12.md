# Database Schema Audit — WishesAndDOOs

**Date:** 2026-11-12 (local) / 2026-11-13 UTC
**Auditor:** `opencode:d98c021f`
**Concord task:** `DB-SCHEMA-AUDIT-2026-11-12`
**Scope:** every SQLAlchemy model in `apps/api/app/modules/*/models.py`, the initial Alembic revision `60395320a95b`, and the service-layer queries that read them (`wishes`, `doos`, `finances`, `dashboard`, `workspaces`, `auth`).
**Method:** static model/migration diff, a throwaway SQLite database built from the real migrations and demo seed, SQLAlchemy statement counting, `EXPLAIN QUERY PLAN`, and constraint probes with `PRAGMA foreign_keys=ON`. Report-only — no application code changed, no dev database touched.

> **Engine caveat:** the API targets PostgreSQL in production but SQLite in dev/test. Query counts and "constraint missing" findings are engine-independent. `EXPLAIN` plans, cascade plans and lock behaviour are **not** — SQLite was used as a proxy. Every index recommendation below is valid for both engines; every plan shown is illustrative, not a Postgres `EXPLAIN ANALYZE`.

---

## Verdict

**The schema is tidy but not defensive.** Models, migration and `alembic check` agree (`flask db check` is clean), naming is consistent, and every tenant-owned table carries `workspace_id`. That is the good part.

The problem is that the database enforces almost none of the rules the application assumes:

- **No foreign key is ever enforced in dev or test.** There is no `PRAGMA foreign_keys=ON` and no `connect_args` anywhere in `apps/api/app`, so SQLite silently ignores every `ON DELETE` rule while Postgres honours it. The test suite runs on the permissive engine.
- **No composite tenancy foreign keys.** `wishes.category_id`, `transactions.account_id`, `doos.wish_id` and `doos.assigned_to` are single-column FKs, so a row in workspace A can legally point at a category, account, wish or user from workspace B. All four were accepted with FK enforcement on.
- **Destructive cascades delete business records.** Deleting an account deletes its transactions (`1 → 0` rows, proven). Deleting a workspace owner deletes the workspace.
- **Zero CHECK constraints and almost no UNIQUE constraints.** Negative amounts, `period_month = '2026-13'`, duplicate categories and duplicate budgets are all accepted by the database.
- **Hot read paths have no composite indexes.** `workspace_members.user_id` — hit on every authenticated request — is a full `SCAN`. Every list endpoint sorts through a temporary B-tree.
- **Read paths are N+1.** The demo workspace (3 wishes, 4 DOOs, 5 transactions) already costs 10–15 queries per screen. These grow linearly with row count.

None of this is exploitable on its own today, because Pydantic validates most enum and range values at the API boundary. It is a correctness and scale problem: the guarantees live in one layer, and the database will happily hold states the application cannot represent.

| Area | State |
|---|---|
| Models ↔ migration drift | ✅ none (`flask db check` clean) |
| Tenant columns present on all domain tables | ✅ yes |
| Composite (tenant-safe) foreign keys | ❌ 0 of 7 cross-module references |
| Foreign keys enforced in dev/test | ❌ off (SQLite default) |
| CHECK constraints | ❌ 0 |
| UNIQUE constraints | ⚠️ 2 (`users.email`, `user_sessions.refresh_token_hash`) |
| Composite indexes | ❌ 0 |
| `updated_at` columns | ❌ 0 of 13 tables |
| List endpoints bounded | ⚠️ transactions only (`limit`, no offset) |
| Queries per main screen (demo data) | ❌ 10–15 |
| Dead / write-only columns | ⚠️ 6 |

---

## Severity legend

| Tier | Meaning |
|---|---|
| **P0** | Silently corrupts data or breaks tenant isolation. Fix before any real user data exists. |
| **P1** | Degrades badly with scale; measurable today. Fix before launch or in the first month. |
| **P2** | Design debt and missing hygiene. Fix opportunistically. |
| **P3** | Nitpicks and future-proofing. |

---

## P0 — Data loss and tenant isolation

### P0-1. Cross-tenant references are accepted by the database

Each foreign key points at a global primary key, not at a `(workspace_id, id)` pair, so referential integrity and tenant integrity are two different things. With `PRAGMA foreign_keys=ON` (i.e. Postgres behaviour), all four of these were accepted:

| Probe | Result |
|---|---|
| `wishes` row in workspace A with `category_id` from workspace B | **ALLOWED** |
| `transactions` row in workspace A with `account_id` from workspace B | **ALLOWED** |
| `doos` row in workspace A with `assigned_to` = a user who is not a member | **ALLOWED** |
| `doos` row in workspace A with `wish_id` from workspace B | **ALLOWED** |

Models: `app/modules/wishes/models.py:23-27`, `app/modules/finances/models.py:77-81`, `app/modules/doos/models.py:23-27` and `35-39`.

The service layer currently prevents this by always resolving `workspace_id` first (`resolve_user_workspace`) and validating payload ids against `workspace_id` (e.g. `app/modules/finances/service.py:327`). But that is one `if` away from a leak, and it has already been bypassed elsewhere in this audit cycle — the security report found IDOR-able paths. A single missed check turns into cross-tenant data exposure, and there is no second line of defence.

**Fix (P0):** add composite FKs. This requires a unique key on the referenced pair first:

```sql
ALTER TABLE categories     ADD CONSTRAINT uq_categories_ws_id     UNIQUE (workspace_id, id);
ALTER TABLE accounts       ADD CONSTRAINT uq_accounts_ws_id       UNIQUE (workspace_id, id);
ALTER TABLE savings_goals  ADD CONSTRAINT uq_savings_goals_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE wishes         ADD CONSTRAINT uq_wishes_ws_id         UNIQUE (workspace_id, id);

ALTER TABLE wishes
  ADD CONSTRAINT fk_wishes_category_tenant
  FOREIGN KEY (workspace_id, category_id) REFERENCES categories (workspace_id, id)
  ON DELETE SET NULL;
-- …and the same pattern for wishes.savings_goal_id/account_id,
--    transactions.account_id/category_id/savings_goal_id,
--    doos.wish_id/category_id, budgets.category_id.
```

`ON DELETE SET NULL` on a composite FK nulls **both** columns by default in Postgres. Use `ON DELETE SET NULL (category_id)` (Postgres 15+) or an explicit `BEFORE DELETE` trigger / partial-null strategy. This is the one part of the recommendation that needs a design decision — see "Open questions".

For `doos.assigned_to`, the target is membership, not the user:

```sql
ALTER TABLE workspace_members ADD CONSTRAINT uq_wm_ws_user UNIQUE (workspace_id, user_id);
ALTER TABLE doos
  ADD CONSTRAINT fk_doos_assignee_member
  FOREIGN KEY (workspace_id, assigned_to) REFERENCES workspace_members (workspace_id, user_id)
  ON DELETE SET NULL;
```

### P0-2. Deleting an account deletes its transactions

`transactions.account_id` is `ON DELETE CASCADE` (`app/modules/finances/models.py:77-81`). Proven with FK enforcement on: deleting one account removed its transaction (`1 → 0`). A user "cleaning up" an old bank account silently destroys the financial history behind every dashboard total, budget and savings rate.

The API exposes account deletion, so this is reachable by a normal user action, not just a script.

**Fix (P0):** change to `ON DELETE RESTRICT` and make the UI/API archive accounts instead (`accounts.archived_at`), or reassign transactions to a system "Unassigned" account in a `BEFORE DELETE` trigger. Do not use `SET NULL` unless `transactions.account_id` becomes nullable — currently it is `nullable=False`, so `SET NULL` would fail at delete time instead. Archiving is the cleaner answer and also fixes the "closed account still appears in pickers" UX.

### P0-3. Deleting a workspace owner deletes the workspace

`workspaces.created_by` is `ON DELETE CASCADE` (`app/modules/workspaces/models.py:20-22`). Proven: deleting the creator's `users` row removed the workspace (`ObjectDeletedError` on the follow-up lookup). For a personal workspace that is arguably intended; for a shared workspace it means one member deleting their account destroys everyone's data.

Related: `workspaces.created_by` also has **no index**, so this cascade (and any "workspaces I created" query) is a full scan.

**Fix (P0):** `ON DELETE RESTRICT` on `workspaces.created_by`, plus an explicit ownership-transfer step before account deletion. If single-owner personal workspaces must die with the user, delete them explicitly in `delete_user` where the intent is visible, rather than relying on a schema-level cascade.

### P0-4. Foreign keys are not enforced in dev or test

`grep` for `PRAGMA`, `foreign_keys` or `connect_args` across `apps/api/app` returns nothing. SQLAlchemy's SQLite dialect does not enable FK enforcement, so in dev and in `pytest`:

- `ON DELETE CASCADE` never fires (the earlier probe showed `1 → 1` rows deleted without the pragma),
- orphan rows are accepted,
- and the entire P0-1/P0-2/P0-3 class of bug is invisible to the test suite.

This is why the schema looks fine locally and behaves differently in production.

**Fix (P0):** enable it once, centrally:

```python
# app/extensions.py or create_app()
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def _sqlite_fk(dbapi_connection, _record):
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
```

Then add a regression test that asserts `PRAGMA foreign_keys` is `1`, and expect some tests to start failing — that is the point. Add `PRAGMA foreign_key_check` to CI against a migrated DB.

---

## P1 — Performance

### P1-1. `workspace_members.user_id` is a full scan on every authenticated request

```
EXPLAIN QUERY PLAN select * from workspace_members where user_id='…'
  (2, 0, 216, 'SCAN workspace_members')
```

The primary key is `(workspace_id, user_id)` (`app/modules/workspaces/models.py:44-55`), so `user_id` alone has no usable index. Every single authenticated endpoint calls `resolve_user_workspace` → `filter_by(user_id=…)` (four separate implementations: `wishes/service.py:45`, `doos/service.py:21`, `finances/service.py:34`, `dashboard/service.py:30`). At 10k users this is a scan per request.

**Fix (P1):** `CREATE INDEX ix_workspace_members_user_id ON workspace_members (user_id);` — or better, a covering index `(user_id, workspace_id, role)` so the auth check never touches the heap.

### P1-2. Every list endpoint sorts through a temporary B-tree

Measured plans (SQLite, demo data):

| Query | Plan |
|---|---|
| `transactions WHERE workspace_id ORDER BY transaction_date DESC` | `SEARCH … ix_transactions_workspace_id` + **`USE TEMP B-TREE FOR ORDER BY`** |
| `doos WHERE workspace_id AND status ORDER BY due_date` | `SEARCH … ix_doos_status` + **`USE TEMP B-TREE FOR ORDER BY`** |
| `wishes WHERE workspace_id ORDER BY created_at DESC` | `SEARCH … ix_wishes_workspace_id` + **`USE TEMP B-TREE FOR ORDER BY`** |
| `audit_logs ORDER BY created_at DESC` | **`SCAN audit_logs`** + **`USE TEMP B-TREE FOR ORDER BY`** |
| `transactions WHERE workspace_id AND category_id ORDER BY transaction_date` | `SEARCH … ix_transactions_workspace_id` + **`USE TEMP B-TREE FOR ORDER BY`** |

The schema has 30 single-column indexes and **zero composite indexes**. Every real query filters by `workspace_id` *and* something else, then orders by a third column, so the single-column index only narrows the scan and the sort is done in memory.

**Fix (P1):** replace the single-column indexes with these composites (each also serves its `workspace_id` prefix, so the old one can be dropped):

```sql
CREATE INDEX ix_transactions_ws_date   ON transactions (workspace_id, transaction_date DESC, created_at DESC);
CREATE INDEX ix_transactions_ws_cat    ON transactions (workspace_id, category_id, transaction_date DESC);
CREATE INDEX ix_doos_ws_status_due     ON doos (workspace_id, status, due_date);
CREATE INDEX ix_doos_ws_due            ON doos (workspace_id, due_date);
CREATE INDEX ix_wishes_ws_status_created ON wishes (workspace_id, status, created_at DESC);
CREATE INDEX ix_budgets_ws_period      ON budgets (workspace_id, period_month);
CREATE INDEX ix_categories_ws_module   ON categories (workspace_id, module);
CREATE INDEX ix_audit_logs_created     ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_logs_ws_created  ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX ix_user_sessions_expires  ON user_sessions (expires_at);
CREATE INDEX ix_wishes_fulfilled_tx    ON wishes (fulfilled_transaction_id);
CREATE INDEX ix_workspaces_created_by  ON workspaces (created_by);
```

Low-selectivity single-column indexes (`transactions.type`, `doos.status`, `wishes.status`, `categories.module`, `audit_logs.event_type`, `user_sessions.is_revoked`) should be folded into the composites above and dropped; on their own they cost write throughput and buy nothing.

### P1-3. N+1 serializers — measured query counts

Throwaway DB, demo seed: 1 user, 1 workspace, 10 categories, 3 accounts, 3 savings goals, 3 wishes, 4 DOOs, 5 transactions, 3 subtasks.

| Operation | Queries | Scales with |
|---|---:|---|
| `get_finances_overview` | **15** | accounts + goals + categories + transactions |
| `get_dashboard_overview` | **14** | same |
| `list_doos` | **13** | **all DOOs in workspace ×2** |
| `list_wishes` | **10** | **all wishes ×3** |
| `get_wish_detail` | 6 | linked DOOs |
| `list_transactions` | 4 | constant (batched `IN`) ✅ |
| `list_budgets` | 4 | constant ✅ |
| `list_savings_goals` | 3 | constant ✅ |
| `get_doo_detail` | 2 | constant ✅ |

Concrete causes:

- **`serialize_wish`** (`app/modules/wishes/service.py:78-133`) does one `db.session.get` each for savings goal, account and category, then executes `select(Doo).where(Doo.wish_id == wish.id)` and materialises **every linked DOO row just to compute two integers** (lines 123-128). Called once per wish from `list_wishes` (line 186), so N wishes = 4N+ queries. Replace with `func.count()` + `func.count().filter(Doo.status == "done")`, and batch the goal/account/category lookups with `IN` exactly as `list_transactions` already does (`finances/service.py:281-290`).
- **`list_doos`** (`app/modules/doos/service.py:156`) loads **all** DOOs in the workspace to compute five summary counters, then re-runs the filtered query at line 165 and serialises with `_serialize_doo`, which does a `db.session.get(Wish, …)` and `db.session.get(Category, …)` per row (lines 64-76). Use one `GROUP BY` aggregate for the summary and eager-load `wish`/`category`/`subtasks` with `selectinload`.
- **`get_wish_detail`** (`wishes/service.py:399-408`) loops `d.subtasks` per DOO — one lazy load per DOO. `selectinload(Doo.subtasks)`.
- **`get_dashboard_overview`** re-implements its own transaction aggregation (`dashboard/service.py:373-405`) instead of reusing `finances` aggregates, so the two screens can disagree.
- **`Workspace.categories` and `Workspace.members` are `lazy="selectin"`** (`workspaces/models.py:25-35`). Every `resolve_user_workspace` → `membership.workspace` therefore eagerly loads *all* categories and *all* members, even for endpoints that only need `workspace.currency`. That is where several of the constant queries in the table come from. Make them `lazy="select"` (or `"raise"` with explicit `selectinload` at the few call sites that need them).

**Fix (P1):** batch serializers, aggregate summaries in SQL, `selectinload` relationships. Target: ≤4 queries per screen regardless of row count. This is a code change, not a migration, and it is the single largest latency win available.

### P1-4. Unbounded lists and full-table aggregation

- `list_wishes` (`wishes/service.py:163-207`) has no `limit`/`offset` and serialises every wish.
- `list_doos` (`doos/service.py:103-183`) has no `limit`/`offset` and loads the full workspace twice.
- `list_transactions` (`finances/service.py:255-296`) clamps `limit` to 200 but has **no offset**, so a user with 5 000 transactions can never reach row 201. The client cannot paginate.
- `get_dashboard_overview` (`dashboard/service.py:373-379`) loads **every transaction ever recorded** in the workspace and filters the current month in Python (`monthly_txs = [tx for tx in all_txs if …]`). Memory and latency grow with lifetime history, not with the visible month.

**Fix (P1):** add `limit`/`offset` (or keyset `before=<date,id>`) to all four; push the month filter into SQL (`WHERE transaction_date >= :month_start`) and use `SUM(...) FILTER (WHERE type='income')` for the two totals.

### P1-5. `get_finances_overview` recomputes budgets per category

`list_budgets` (`finances/service.py:541-569`) issues a separate `SUM` per category (`spent` per category in a loop). At 40 categories that is 40 queries. One `GROUP BY category_id` replaces it.

---

## P2 — Integrity and schema design

### P2-1. No CHECK constraints

Zero `CheckConstraint` in the migration. The database accepted all of these:

| Value written directly | DB | Pydantic |
|---|---|---|
| `transactions.amount = -500.00` | **ALLOWED** | rejected (`gt=0`, `schemas.py:53`) |
| `transactions.type = 'crypto'` | **ALLOWED** | rejected (`Literal`, `schemas.py:52`) |
| `doos.priority = 'banana'` | **ALLOWED** | rejected (`pattern`, `doos/schemas.py:19`) |
| `doos.status = 'nope'` | **ALLOWED** | rejected (`pattern`, `doos/schemas.py:20`) |
| `doos.recurrence_rule = 'hourly'` | **ALLOWED** | rejected (`pattern`, `doos/schemas.py:22`) |
| `workspace_members.role = 'god'` | **ALLOWED** | no API path creates members at all |
| `budgets.period_month = '2026-13'` | **ALLOWED** | **accepted** — only `max_length=7` (`finances/schemas.py:71`) |
| duplicate `(workspace_id, module, name)` category | **ALLOWED** | no uniqueness check in `create_category` |
| duplicate `(workspace_id, category_id, period_month)` budget | **ALLOWED** | app-level upsert only (`finances/service.py:597-618`) |
| `users.email = 'Demo@…'` when `demo@…` exists | **ALLOWED** | register/login lowercase (`auth/service.py:201,307`) |

The Pydantic layer covers most of it, so this is defence-in-depth rather than a live bug. The exceptions that are **not** covered anywhere are `budgets.period_month` format and the two duplicate-row cases — and the budget upsert is a genuine race: two concurrent `PUT /budgets` calls both `SELECT` nothing and both `INSERT`.

**Fix (P2):** add CHECKs mirroring the Pydantic rules, plus the unique constraints:

```sql
ALTER TABLE transactions ADD CONSTRAINT ck_tx_amount_positive CHECK (amount > 0);
ALTER TABLE transactions ADD CONSTRAINT ck_tx_type CHECK (type IN ('income','expense','transfer'));
ALTER TABLE doos ADD CONSTRAINT ck_doos_priority CHECK (priority IN ('low','medium','high'));
ALTER TABLE doos ADD CONSTRAINT ck_doos_status CHECK (status IN ('todo','in_progress','done'));
ALTER TABLE doos ADD CONSTRAINT ck_doos_recurrence CHECK (recurrence_rule IN ('none','daily','weekly','monthly'));
ALTER TABLE workspace_members ADD CONSTRAINT ck_wm_role CHECK (role IN ('owner','editor','viewer'));
ALTER TABLE budgets ADD CONSTRAINT ck_budget_period CHECK (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE accounts ADD CONSTRAINT ck_account_type CHECK (type IN ('checking','savings','cash','credit','investment'));

CREATE UNIQUE INDEX uq_categories_ws_module_name ON categories (workspace_id, module, lower(name));
CREATE UNIQUE INDEX uq_budgets_ws_cat_period    ON budgets (workspace_id, category_id, period_month);
CREATE UNIQUE INDEX uq_users_email_lower        ON users (lower(email));
```

Note `recurrence_rule` currently allows `'custom'` in Pydantic but the completion logic only handles `daily`/`weekly`/`monthly` (`doos/service.py:339-352`) — a `custom` task is silently marked done and never recurs. Drop `custom` from the pattern or implement it; don't put it in the CHECK until the code handles it.

### P2-2. No `updated_at` anywhere

All 13 tables have `created_at` and nothing else. There is no way to answer "what changed since…", no optimistic-concurrency token, no cache invalidation key, and no way to detect a stale write. Adding it later means backfilling with a guess.

**Fix (P2):** add `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` with a `moddatetime`/`set_updated_at` trigger, or SQLAlchemy `onupdate=utc_now`. Do it now, while every table is small.

### P2-3. Denormalised money with no reconciliation

`accounts.balance` and `savings_goals.current_amount` are stored totals mutated in Python on every transaction (`finances/service.py:367-375, 413-420, 455-462, 496-503, 814`). There is no source-of-truth recomputation, no ledger, and no check that `balance == opening + Σ(transactions)`. A crash between two `+=` operations, a partial migration, or a manual row edit leaves the total permanently wrong with no way to detect it.

Worse, `SavingsGoalCreateRequest.current_amount` (`finances/schemas.py:79`) lets a user create a goal already holding money with **no backing transaction**, and there is no endpoint that reconciles it afterwards. Two goals can also claim the same account balance with no constraint.

**Fix (P2):** keep the denormalised columns for read speed, but (a) add a `reconcile_balances()` maintenance command that recomputes from transactions and reports drift, (b) run it in CI on the demo seed and assert zero drift, (c) stop accepting `current_amount` on create — seed it with a real `opening_balance` transaction. Long term, derive balances from the ledger and cache them.

### P2-4. `audit_logs` is write-only and loses attribution

`record_audit_event` writes on nearly every mutation, but there is **no route that reads `audit_logs`** (`grep AuditLog` across `*/routes.py` → nothing). The table only grows. It also has `user_id ON DELETE SET NULL` and `workspace_id ON DELETE SET NULL` (`auth/models.py:78-88`), so deleting an account erases who did what — exactly when you need the record. And `ORDER BY created_at` is a full scan (`audit_logs` has indexes on `event_type`, `user_id`, `workspace_id`, none on `created_at`).

**Fix (P2):** add an admin/owner read endpoint with keyset pagination, store `actor_email`/`actor_label` denormalised on the row (so attribution survives deletion), and add `ix_audit_logs_created`. Decide a retention window now.

### P2-5. `user_sessions` is never purged

Expired and revoked rows accumulate forever. There is no cleanup job and no index on `expires_at`, so a future cleanup would scan. `refresh_token_hash` is uniquely indexed, so re-issuing a token can't collide, but the table grows without bound.

**Fix (P2):** `DELETE FROM user_sessions WHERE expires_at < now() - interval '30 days'` on a schedule, plus `ix_user_sessions_expires`. Consider partial index `WHERE is_revoked = false`.

### P2-6. `budgets.period_month` is a string

`String(7)` (`finances/models.py:123`), compared and grouped as text. It sorts correctly only because `YYYY-MM` is lexicographic, and it accepts `'2026-13'`, `'2026-1'`, `'abcd-ef'`. Month arithmetic (budget rollover, "last 6 months") is done in Python on strings.

**Fix (P2):** `DATE` truncated to the first of the month, or `INTEGER` `YYYYMM`. Both sort and range-scan correctly. If you keep the string, add the regex CHECK above.

### P2-7. UUIDv4 stored as `String(36)`

Every PK and FK is `String(36)` holding a random UUIDv4 (`auth/models.py:16` and siblings). Consequences: 36-byte keys in every index and every FK, no temporal locality on insert (random B-tree page splits), and no compact ordering. On Postgres the native `UUID` type halves storage and sorts better; UUIDv7 (time-ordered) fixes the locality problem.

**Fix (P2):** switch to `postgresql.UUID(as_uuid=True)` with `uuid7` defaults. This is a wide migration — do it before there is production data or accept it as permanent.

### P2-8. Money is `Numeric` in the DB but `float` in the API

`Numeric(12,2)` columns are converted with `float()` / `_to_float()` before serialisation (`finances/service.py:104, 127`, `wishes/service.py:84-85`, and throughout `dashboard/service.py`). Values like `0.1 + 0.2` are then summed as floats for the dashboard totals. It is masked today by 2-dp data, but budget comparisons (`is_over_budget`) and savings-rate percentages are float comparisons.

**Fix (P2):** serialise as decimal strings (some endpoints already do — `finances/service.py:717` returns `str(goal.current_amount)`), and sum with `Decimal` in Python or `SUM()` in SQL. Don't mix.

### P2-9. Multi-tenancy is schema-only

`workspace_members` exists, `role` exists, `WORKSPACE_MEMBERS` scoping exists — but there is **no endpoint to add a member**. Every membership row is created with `role="owner"` (`workspaces/service.py:176, 244`), and `grep` finds no invite route. So today the product is single-user with a multi-tenant schema, and `role` is dead data (only two authorization checks read it: `workspaces/routes.py:62`, `workspaces/service.py:647`).

That is a legitimate v1 choice, but it means the schema's tenancy guarantees are untested. Before shipping invites, the P0-1 composite FKs matter a lot more.

---

## Dead, write-only and redundant data

| Table.column | References | Verdict |
|---|---|---|
| `users.totp_secret_encrypted` | **0** | **Unused.** No read, no write, no encryption helper. Drop, or implement 2FA. |
| `users.is_email_verified` | 4, all hardcoded `True` | **Always true.** Stored, serialised, never verified. Either build verification or drop. |
| `users.is_2fa_enabled` | 4, all hardcoded `False` | **Always false.** Same. |
| `workspaces.type` | 1 read (`workspaces/service.py:116`), no write path | **Effectively constant `"personal"`.** No API sets it. Drop or add a schema field. |
| `workspace_members.role` | 2 authorization checks; always `"owner"` | **Constant today**, but the two checks are real. Keep, and add the CHECK. |
| `doos.assigned_to` | written (`doos/service.py:224`), echoed (`:87`), never validated or filtered | **Inert.** A user can assign a task to any user id, including a non-member or a nonexistent one (probe: ALLOWED). No "assigned to me" filter exists. Either wire it up (with the membership FK from P0-1) or drop it. |
| `doos.recurrence_rule = 'custom'` | accepted by schema, unhandled by code | **Unimplemented value.** Remove from the pattern. |
| `doos.completed_at` | set, then cleared for recurring tasks | Fine, but note recurring tasks never retain a completion timestamp — so "completed today" history is lost. |
| `savings_goals.account_id` | set, read for display | Fine, but it duplicates `wishes.account_id` in intent; no constraint ties a goal's account to the account its transactions use. |
| `accounts.icon` / `color`, `categories.icon` / `color` | read for display | Used, but free-form strings with no palette constraint — a `color` value outside the theme token set will render inconsistently. |
| `audit_logs.*` | written only | **Write-only** (see P2-4). |
| `users.sessions` (`lazy="dynamic"`) | used by session revocation | Fine. |
| `wishes.account_id` | read via `getattr(wish, "account_id", None)` (`wishes/service.py:99, 144`) | The `getattr` default suggests uncertainty about whether the column exists. It does. Drop the `getattr`. |

---

## Measured query counts

Reproduction: `apps/api` with `FLASK_ENV=development`, `FLASK_AUTO_CREATE_DB=true`, `FLASK_SEED_DEMO_DATA=true`, `DATABASE_URL=sqlite:///<temp>/wad_schema_audit.db`, counting `before_cursor_execute` events.

```
list_wishes                            queries=  10
list_doos                              queries=  13
get_dashboard_overview                 queries=  14
get_finances_overview                  queries=  15
list_transactions(limit=100)           queries=   4
list_budgets                           queries=   4
list_savings_goals                     queries=   3
get_wish_detail                        queries=   6
get_doo_detail                         queries=   2
```

With 3 wishes / 4 DOOs / 5 transactions. `list_wishes` and `list_doos` grow roughly linearly; the others grow with categories/accounts/goals.

---

## Recommended migration sequence

Do these in order — each step is independently deployable and testable.

1. **Turn on SQLite FK enforcement** (`PRAGMA foreign_keys=ON`). Fix the tests that start failing. This is the gate for everything else.
2. **Add `updated_at`** to all tables (cheap now, expensive later).
3. **Add composite indexes** (P1-2) and the missing FK indexes (`workspace_members.user_id`, `workspaces.created_by`, `wishes.fulfilled_transaction_id`, `user_sessions.expires_at`, `audit_logs.created_at`). No data change, immediate read win.
4. **Add UNIQUE constraints** (`uq_*` from P0-1 and P2-1) after a dedupe query proves no existing duplicates.
5. **Add CHECK constraints** mirroring Pydantic.
6. **Change delete rules**: `transactions.account_id` CASCADE → RESTRICT (+ account archiving), `workspaces.created_by` CASCADE → RESTRICT (+ ownership transfer).
7. **Add composite tenant FKs** (P0-1) — needs the partial-null decision.
8. **Fix the N+1 serializers** (P1-3) — code only, no migration.
9. **Bound the list endpoints** and push month filtering into SQL (P1-4).
10. **Reconcile balances** and add the drift check (P2-3).
11. **UUID type / UUIDv7** and `period_month` type — only if you are willing to do a full-table rewrite; otherwise schedule for v2.

---

## Open questions for the owner

1. **Composite FK `ON DELETE SET NULL`:** with a two-column FK, deleting a category would null both `workspace_id` and `category_id`, which is invalid. Options: Postgres 15 `ON DELETE SET NULL (category_id)`, a `BEFORE DELETE` trigger that nulls the child column, or keep the single-column FK and add a trigger-based tenant check. Which do you prefer?
2. **Account deletion semantics:** archive (recommended), or block deletion while transactions exist?
3. **Shared workspaces:** is multi-member support actually planned for v1? If not, `workspace_members` could collapse into `workspaces.owner_id` and the whole tenancy-FK problem shrinks. If yes, the P0-1 work is mandatory before invites ship.
4. **`doos.assigned_to`:** wire it up or drop it?
5. **2FA columns:** build it or drop it?
6. **Production data:** is there any yet? If the answer is "no", do steps 2, 6 and 11 now and skip the backfill work entirely.

---

## Not covered

- **Real PostgreSQL plans.** No Postgres instance was reachable without Docker, and `docker` is not installed on this host. Composite-index recommendations are engine-independent, but the specific plan shapes should be re-verified with `EXPLAIN (ANALYZE, BUFFERS)` on Postgres.
- **Lock behaviour and isolation levels.** Not exercised.
- **Backup / restore / PITR.** Out of scope (see the production-readiness audit).
- **Data migration safety on existing rows.** Assumed empty; the demo seed is the only data.
- **`apps/client` query patterns.** Only the API-side query shape was measured; the client's refetch behaviour is in the SEO/frontend audits.
- **Index bloat / `VACUUM` / autovacuum tuning.** Postgres-only, not testable here.

---

## Reproduction artifacts

Temporary scripts used (safe to delete, they live in `%TEMP%`, not the repo):

- `wad_schema_measure.py` — query counts + `EXPLAIN QUERY PLAN`
- `wad_schema_integrity.py` — CHECK/UNIQUE probes on a scratch DB
- `wad_schema_fk.py`, `wad_schema_fk2.py` — cross-tenant and cascade probes with `PRAGMA foreign_keys=ON`
- `wad_col_usage.py` — per-column reference counter across `apps/api/app`

The throwaway database is `%TEMP%\wad_schema_audit.db`. The dev database was never opened.
