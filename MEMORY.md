# WishesAndDOOs — Engineering & Design Memory Log (`MEMORY.md`)

> This file records technical patterns, architectural setups, and UI/UX practices that **worked well** alongside pitfalls that **did not work** so the agent never repeats mistakes across screens.

---

## 📌 Next Session Priority Queue (Screen 6: Wishes List — Do Next)

1. **Screen 6: Wishes List Screen (`/(app)/wishes`):**
   - Backend: `WISHES` table, private image upload endpoint (`Pillow` EXIF stripping + signed URLs), `/wishes` CRUD endpoints.
   - Frontend: Status/priority filters, mobile-first Wish cards (uploaded image, title, target price, linked Savings Goal progress bar, linked DOOs step count) + **Quick Add Wish Bottom Sheet** (with image upload picker & explicit **Save & Confirm**).
   - Linking: Wire up linking between Wishes and Screen 5's Savings Goals.

---

## ✅ What Works Well (Repeat These Patterns)

### 1. Frontend / Universal Expo & Theme Engine
- **SPA Mode (`"output": "single"` in `apps/client/app.json`):** Running Expo Web in `"single"` (SPA) output mode avoids Node 26 SSR CommonJS/ESM incompatibilities while delivering fast client-side routing and hot-reloading.
- **Dual Semantic Token Binding (`ThemeProvider.tsx` + `tokens.ts`):** Applying theme tokens via both HTML `data-theme` / `.dark` attributes (for Web CSS variables in `global.css`) AND direct `tokens.*` style props inside core UI primitives (`Button`, `Card`, `Badge`) guarantees 100% visual consistency across Web, Native, and Jest unit tests without flash of unstyled content.
- **True Responsive Mobile-First Layouts (`useWindowDimensions`):** Design base layouts for mobile (`< 768px`) and scale up to multi-column asymmetric grids and split-screen layouts on Tablet (`≥ 768px`) and Desktop PC (`≥ 1024px`, `maxWidth: 1240px`) so testing on a PC shows a real desktop layout rather than a narrow mobile column.
- **Clean Consumer-Grade UI (No Version Badges or Dev Bars):** Keep theme controls inside the **Settings** section (`/(app)/settings` or a Settings sheet), and never show internal version numbers (`v1.0`), `API Online` status pills, or debug bars on user-facing screens.
- **Modern Atmospheric Gradient Backgrounds & Layered Soft Shadows:** Avoid flat/old-feeling beige backgrounds and text-heavy screens. Use a crisp modern gradient canvas (`#F8FAFC` with subtle emerald/violet/blue radial glows), multi-layer soft shadows (`0 20px 40px -15px rgba(15,23,42,0.07)`), `16px–20px` card radii, and concise, visual-first cards with minimal text.
- **Apple HIG & Emil Kowalski Fluid UI Motion (`apps/client/src/lib/motion.ts`):** Use shared fluid curves (`FLUID_EASINGS.outExpo = cubic-bezier(0.16, 1, 0.3, 1)` and `FLUID_EASINGS.outQuint = cubic-bezier(0.22, 1, 0.36, 1)`) and critically damped springs (`FLUID_SPRINGS.snappy` / `FLUID_SPRINGS.fluid`) across all screens:
  - `useStaggerEntrance(index)` for subtle `12px` Y-offset + `0.985` scale staggered reveals.
  - `useInteractiveMotion()` inside `Button`, links, and interactive chips for immediate spring hover lift (`translateY: -1.5px`, `scale: 1.015`, elevated shadow, icon micro-nudge) and tactile press feedback (`scale: 0.97`) without layout shift.
  - `useErrorShake()` for Apple-style horizontal damped spring shake on form validation/auth errors.
  - `usePulseScale()` for tactile spring confirmation when auto-filling or transferring funds.
  - `useReducedMotion()` automatically respects `prefers-reduced-motion: reduce` and short-circuits in `NODE_ENV === "test"` so Jest tests stay fast and deterministic.
  - **Full-Canvas Multi-Stop Radial Gradient with Rotating Perimeter Origin (`AmbientMeshBackground.tsx` + `GRADIENT_PERIMETER_POSES`):** Keeping a module-level `_lastGradientPose` and animating `translate3d(originX%, originY%, 0)` (`950ms cubic-bezier(0.16, 1, 0.3, 1)`) on a `240% × 240%` circular multi-stop `radial-gradient` (`0%` → `24%` → `48%` → `76%` → `100%`) plus an opposite-pole counter-radial glow smoothly shifts the gradient's origin around the perimeter on every screen change (`/welcome` `"bottom-to-top"` → `/login` `"corner-top-right"` → `/register` `"right-to-left"` → `/dashboard` `"corner-bottom-right"` → `/finances` `"top-to-bottom"`).
- **Finances 4-Pill Module Architecture (`apps/client/app/(app)/finances.tsx`):**
  - Instant client-side tab switching across *Transactions*, *Budgets*, *Savings Goals*, and *Accounts*.
  - Explicit Save & Confirm modals with dedicated form validations and tactile error shake.

### 2. Backend / Python Flask & Database
- **Atomic Balance Updates & Reversals (`apps/api/app/modules/finances/service.py`):** Handling transaction creation and deletion with atomic balance adjustments on `Account` and `SavingsGoal` inside the DB transaction avoids race conditions and stale balances across the entire app.
- **Isolated `.venv` inside `apps/api/.venv`:** Always invoke `.venv/bin/python`, `.venv/bin/pip`, and `PYTHONPATH=. .venv/bin/pytest` explicitly inside `apps/api`.
- **Automatic SQLite Fallback When Docker Daemon Is Absent:** In `apps/api/app/config.py`, defaulting `SQLALCHEMY_DATABASE_URI` to a local SQLite file (`wishes_and_doos_dev.db`) when `DATABASE_URL` is not set allows local development and `/api/v1/health` database checks to work out-of-the-box on machines without Docker running, while remaining 100% ready for PostgreSQL via `DATABASE_URL`.
- **In-Memory SQLite (`TestingConfig`) for `pytest`:** Using `sqlite:///:memory:` with `RATELIMIT_ENABLED = False` (unless specifically testing rate limits) runs the backend test suite in `< 1s`.
- **SQLite vs PostgreSQL Timezone-Aware Datetimes (`_as_utc` helper):** SQLite returns naive `datetime` objects even when `db.DateTime(timezone=True)` is declared on SQLAlchemy columns. Normalizing retrieved timestamps with `_as_utc(dt)` before comparing against `datetime.now(timezone.utc)` prevents `TypeError: can't compare offset-naive and offset-aware datetimes` across both SQLite and PostgreSQL.
- **Dual Cookie + JSON Refresh Token Delivery:** Setting an `HttpOnly`, `SameSite=Lax` cookie (`wad_refresh_token`) alongside returning `refresh_token` in the JSON body supports both secure Web browser sessions (`credentials: "include"`) and native mobile clients (`expo-secure-store`).

---

## ❌ What Didn't Work & How to Avoid It (Never Repeat)

### 1. PowerShell Script Path Parsing With Parentheses `(app)`
- **What Happened:** In PowerShell, unquoted paths containing parentheses like `apps/client/app/(app)/finances.tsx` treat `(app)` as a subexpression command, failing `Get-Content` and producing an empty file if piped.
- **Fix / Rule:** Always single-quote paths containing parentheses in PowerShell: `'apps/client/app/(app)/finances.tsx'` or use the agent's built-in file editing tools (`write_file` / `edit_file`).

### 2. Expo Router + Node 26 Static SSR (`"output": "static"`)
- **What Happened:** The default Expo SDK 52 template sets `"web": { "output": "static" }` in `app.json` and omits `query-string` as a direct dependency, causing `http://localhost:8081` to return `HTTP 500`.
- **Fix / Rule:** Keep `"output": "single"` in `apps/client/app.json` and keep `query-string@7.1.3` installed in `apps/client/package.json`.

### 3. Running Expo Dev Server with `CI=1`
- **What Happened:** Launching `CI=1 npx expo start --web` disables Metro watch mode and hot reloading.
- **Fix / Rule:** Never set `CI=1` when starting the background Expo dev server (`IsDaemon: true`) for user review—run `npx expo start --web --port 8081` directly so live edits hot-reload in the user's browser.
