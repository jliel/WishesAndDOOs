# WishesAndDOOs — Engineering & Design Memory Log (`MEMORY.md`)

> This file records technical patterns, architectural setups, and UI/UX practices that **worked well** alongside pitfalls that **did not work** so the agent never repeats mistakes across screens.

---

## 📌 Next Session Priority Queue (Screen 4 Refinements — Do Before Screen 5)

1. **Dashboard Background & Navbar Integration (`AdaptiveShell.tsx` & `dashboard.tsx`):**
   - The current opaque `tokens.card` sidebar and header stand out too starkly against the ambient radial gradient on `/dashboard`. Soften the dashboard background and use translucent/glassmorphic or seamlessly blended nav surfaces so the navigation bars don't clash with the canvas.
2. **Half-Height Top Nav on Full-Size PC (`isDesktop` in `AdaptiveShell.tsx`):**
   - Reduce the Desktop top header bar to half its current height (~`36px–40px` compact single-line bar).
3. **Desktop Settings Floating Mini-Panel Popover (`AdaptiveShell.tsx`):**
   - Replace the full-width inline profile/settings banner with an anchored **floating mini-panel popover** (`position: "absolute"`, `top: 44, right: 0`, `zIndex: 50`, elevated shadow) that pops open directly under the Settings button without pushing dashboard content down.
4. **Mobile Module Menu & Hamburger Overlap Panel (`AdaptiveShell.tsx`):**
   - Ensure mobile viewports (`< 1024px`) have an unmistakable, always-accessible way to switch between modules (*Dashboard*, *Finances*, *Wishes*, *DOOs*).
   - Add a **Hamburger menu button (`MaterialIcons name="menu"`)** on mobile that opens a full **overlapping drawer/panel** (modal overlay) containing module links and settings.
5. **Theme Switcher Inside Settings Mini-Panel & Mobile Hamburger Drawer:**
   - Put the live **Theme Style (`Classical`, `Pastel`, `Joyful`)** and **Color Mode (`Light`, `Dark`)** controls inside both the Desktop Settings popover and the Mobile Hamburger overlap panel.

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
  - **Full-Canvas Multi-Stop Radial Gradient with Rotating Perimeter Origin (`AmbientMeshBackground.tsx` + `GRADIENT_PERIMETER_POSES`):** Keeping a module-level `_lastGradientPose` and animating `translate3d(originX%, originY%, 0)` (`950ms cubic-bezier(0.16, 1, 0.3, 1)`) on a `240% × 240%` circular multi-stop `radial-gradient` (`0%` → `24%` → `48%` → `76%` → `100%`) plus an opposite-pole counter-radial glow smoothly shifts the gradient's origin around the perimeter on every screen change (`/welcome` `"bottom-to-top"` → `/login` `"corner-top-right"` → `/register` `"right-to-left"` → future screens) without any flat horizontal banding or washed-out white top edge.
- **Material Icons (`MaterialIcons` from `@expo/vector-icons`) + Jest `expo-font` Setup (`jest.setup.js`):** Using `@expo/vector-icons/MaterialIcons` across all screens and components provides crisp, native-grade icons on Web, iOS, and Android with zero third-party SVG dependency bloat. In Jest (`apps/client/jest.setup.js`), mocking `expo-font` (`isLoaded: () => true, loadAsync: () => Promise.resolve()`) avoids `loadedNativeFonts.forEach is not a function` without triggering NativeWind Babel `_ReactNativeCSSInterop` out-of-scope variable errors.

### 2. Backend / Python Flask & Database
- **Isolated `.venv` inside `apps/api/.venv`:** Always invoke `.venv/bin/python`, `.venv/bin/pip`, and `PYTHONPATH=. .venv/bin/pytest` explicitly inside `apps/api`.
- **Automatic SQLite Fallback When Docker Daemon Is Absent:** In `apps/api/app/config.py`, defaulting `SQLALCHEMY_DATABASE_URI` to a local SQLite file (`wishes_and_doos_dev.db`) when `DATABASE_URL` is not set allows local development and `/api/v1/health` database checks to work out-of-the-box on machines without Docker running, while remaining 100% ready for PostgreSQL via `DATABASE_URL`.
- **In-Memory SQLite (`TestingConfig`) for `pytest`:** Using `sqlite:///:memory:` with `RATELIMIT_ENABLED = False` (unless specifically testing rate limits) runs the backend test suite in `< 1s`.
- **SQLite vs PostgreSQL Timezone-Aware Datetimes (`_as_utc` helper):** SQLite returns naive `datetime` objects even when `db.DateTime(timezone=True)` is declared on SQLAlchemy columns. Normalizing retrieved timestamps with `_as_utc(dt)` before comparing against `datetime.now(timezone.utc)` prevents `TypeError: can't compare offset-naive and offset-aware datetimes` across both SQLite and PostgreSQL.
- **Dual Cookie + JSON Refresh Token Delivery:** Setting an `HttpOnly`, `SameSite=Lax` cookie (`wad_refresh_token`) alongside returning `refresh_token` in the JSON body supports both secure Web browser sessions (`credentials: "include"`) and native mobile clients (`expo-secure-store`).

---

## ❌ What Didn't Work & How to Avoid It (Never Repeat)

### 1. Expo Router + Node 26 Static SSR (`"output": "static"`)
- **What Happened:** The default Expo SDK 52 template sets `"web": { "output": "static" }` in `app.json` and omits `query-string` as a direct dependency, causing `http://localhost:8081` to return `HTTP 500` (`Unable to resolve module query-string from expo-router/build/fork/getPathFromState.js`).
- **Fix / Rule:** Keep `"output": "single"` in `apps/client/app.json` and keep `query-string@7.1.3` installed in `apps/client/package.json`. Always verify `http://localhost:8081` AND its `.bundle` URL return `HTTP 200` via `curl` before handing a screen to the user.

### 2. Running Expo Dev Server with `CI=1`
- **What Happened:** Launching `CI=1 npx expo start --web` disables Metro watch mode and hot reloading (`Metro is running in CI mode, reloads are disabled`).
- **Fix / Rule:** Never set `CI=1` when starting the background Expo dev server (`IsDaemon: true`) for user review—run `npx expo start --web --port 8081` directly so live edits hot-reload in the user's browser.

### 3. Jest Hanging After TanStack Query Tests
- **What Happened:** `jest --watchAll` (the default script in `create-expo-app`) blocks in watch mode, and TanStack Query's garbage collection timer keeps Node alive for 1+ second after tests finish.
- **Fix / Rule:** Keep `"test": "jest --watchAll=false --forceExit"` in `apps/client/package.json` so automated test runs exit cleanly and deterministically.

### 4. Global or Unbundled Python Package Checks
- **Rule:** Never run `pip install` globally; always use `apps/api/.venv/bin/pip` and update `apps/api/requirements.txt` via `apps/api/.venv/bin/pip freeze > requirements.txt`.

### 5. Generic Stacked Card Layouts, Version Badges & Constrained Desktop Widths
- **What Happened:** On Screen 1, constraining the container to `maxWidth: 460`, placing a `ThemePreviewBar` in the main window, showing `"v1.0"` / `"API Online"` badges, and using 3 generic stacked cards made the desktop view look like a narrow prototype.
- **Fix / Rule:**
  1. **Never** constrain desktop screens to mobile widths (`460px`); always implement responsive breakpoints (`< 768px` mobile, `768px–1023px` tablet, `≥ 1024px` full desktop up to `1240px`).
  2. **Never** put version badges (`v1.0`), `API Online` badges, or theme switchers in the main screen content—theme controls belong in **Settings**.
  3. Avoid generic 3-card vertical stacks; use editorial typography, asymmetric bento compositions, and interactive workspace previews.
