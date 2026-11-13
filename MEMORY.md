# WishesAndDOOs — Engineering & Design Memory Log (`MEMORY.md`)

> This file records technical patterns, architectural setups, and UI/UX practices that **worked well** alongside pitfalls that **did not work** so the agent never repeats mistakes across screens.

---

## 📌 Screen Progress Status

- ✅ **Screen 1: Welcome & Value Proposition Screen (`/welcome`)** — Approved
- ✅ **Screen 2: Login Screen (`/login`)** — Approved
- ✅ **Screen 3: Registration Screen (`/register`)** — Approved
- ✅ **Screen 4: Workspace Dashboard (`/dashboard`)** — Approved
- ✅ **Screen 5: Finances Screen (`/finances`)** — Approved (+ Edit Support)
- ✅ **Screen 6: Wishes List Screen (`/(app)/wishes`)** — Approved (+ Edit Support)
- ✅ **Screen 7: Wish Detail Screen (`/(app)/wishes/[id]`)** — Approved (+ Fulfill & Expense Deduct)
- ✅ **Screen 8: DOOs (Tasks) Manager Screen (`/(app)/doos`)** — Approved
- ✅ **Screen 9: DOO Detail Screen (`/(app)/doos/[id]`)** — Approved
- 🟡 **Screen 10: Profile & Settings Screen (`/(app)/settings`)** — Constructed & Ready for Review
- 🏁 **All 10 Core Architectural Screens Built**

---

## 📌 Full 10-Screen Architecture Complete — Verification & Polish Queue

1. **Screen 8: DOOs (Tasks) Manager Screen (`/(app)/doos`):**
   - **Backend:** DOO CRUD endpoints, subtasks nested ordering & toggle, wish linking, recurring tasks (`recurrence_rule`), filtering by priority, status, and due date.
   - **Frontend:** Hero task overview, filter chips (`All`, `Pending`, `In Progress`, `Completed`), DOO cards with interactive subtask check-offs, Add/Edit DOO modal with explicit Save & Confirm, and linked Wish badges.

---

## ✅ What Works Well (Repeat These Patterns)

### 1. Frontend / Universal Expo & Theme Engine
- **Universal Viewport Centering for Modals (`position: "fixed"` on Web):**
  - Modals and sheet overlays inside scrollable views (e.g. `AdaptiveShell`'s main container) must use React Native's `<Modal transparent visible={...}>` together with `{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, alignItems: "center", justifyContent: "center" }` on Web (`Platform.OS === 'web'`).
  - Standard `StyleSheet.absoluteFill` defaults to `position: absolute` in React Native Web, calculating coordinates relative to the nearest positioned/scroll container rather than the active window viewport, which causes modals to render at the bottom of long scroll views. Setting `position: "fixed"` guarantees the modal is locked dead-center in the user's active viewport without requiring any scrolling.
- **Language & Internationalization Engine (`LanguageProvider.tsx`):**
  - Instant toggle between English (`en`) and Spanish (`es`) with local storage persistence and fallback.
  - Available inside the Profile & Settings screen as a dedicated card and in both desktop & mobile navigation bars.
- **Responsive Top Header Cleanup for Mobile:**
  - Removed user avatar and settings trigger buttons from the top bar on mobile/tablet viewports, leaving solely the Hamburger Menu button and workspace currency badge to keep header clean and prevent clutter.
- **Horizontally Scrollable Tab & Filter Pill Bars on Mobile (`finances.tsx`):**
  - Wrapped module sub-navigation tabs (`Transactions`, `Budgets`, `Savings`, `Accounts`) and filter chips in horizontal `ScrollView`s with `flexShrink: 0`, `whiteSpace: "nowrap"`, and thumb-friendly horizontal padding (`14px–16px`). Prevents tab pills from squeezing, wrapping, or overlapping icons/text on small mobile screens (< 380px).
- **Fluid Hamburger Slide-Over Drawer Motion (`AdaptiveShell.tsx`):**
  - Smooth Emil Kowalski `outExpo` curve (`cubic-bezier(0.16, 1, 0.3, 1)`) slides the drawer from `-drawerWidth` to `0` from left to right with concurrent backdrop scrim opacity fade, and crisp `inQuad` exit on dismiss.
- **Universal Date Picker Primitive (`DatePicker.tsx`):**
  - Interactive calendar modal with Month/Year pagination, Quick Select chips (`Today`, `Tomorrow`, `In 1 Week`), day grid selection, and clear actions. Used in DOOs (`due_date`), DOO Detail (`due_date`), Finances (`transaction_date`), and Savings Goals (`target_date`).
- **Responsive Small-Screen Button Bar Wrapping:**
  - Action button rows across hero cards use `flexWrap: "wrap"` with explicit `minWidth: 140` and `flex: 1` so buttons cleanly wrap onto two stacked rows on narrow phone screens (`< 380px`) without overflowing panel bounds.
- **Distinct Active Tab State & Direct User Profile Navigation:**
  - `AdaptiveShell` supports `"settings"` as an `AppTabKey` so screens like `/settings` render with `activeTab="settings"`.
  - Clicking on the user profile row in the desktop left sidebar or mobile drawer immediately navigates to `/settings`.
  - When in Settings, the Dashboard tab is not highlighted as active, clicking Dashboard cleanly navigates to `/dashboard`, and an explicit Settings tab indicator/active button displays the current active location.
- **Mandatory Hover Animations and Distinct Hover Colors on ALL Buttons:**
  - Every button, action pill, icon button, and modal action button MUST feature explicit hover animations (`translateY: -1.5px`, subtle `scale: 1.02` to `1.08`, fluid `cubic-bezier(0.16, 1, 0.3, 1)` transitions) and visible hover color states:
    - **Primary / Wish Buttons:** Shifts to vibrant accent tints (e.g. `#8B5CF6` dark / `#6D28D9` light) with ambient glow shadow.
    - **Finance Buttons:** Shifts to emerald hover tints (`#10B981` dark / `#047857` light) with theme-aware borders.
    - **Destructive Buttons:** Shifts to bold crimson tints (`rgba(239, 68, 68, 0.22)` soft dark / `#FEE2E2` light / `#EF4444` solid) with red border accents.
    - **Secondary & Outline Buttons:** Lifts with elevated background fill and crisp borders (`tokens.foreground` / `tokens.doo`).
  - **Shared `IconButton` & `Button` Primitives:** All card action buttons (Edit, Delete, Details) and modal controls must consume either `<IconButton>` or `<Button>` to guarantee hover animations, distinct hover colors, and container-safe padding across all screens automatically.
- **Responsive 2-Line Transaction Row Layout for Mobile Screens (`finances.tsx`):**
  - On desktop (`isDesktop`), transactions render as a spacious single-line item.
  - On mobile/tablet (`< 1024px`), transactions cleanly split into a 2-line layout: Row 1 holds category icon + description (`flex: 1`) + bold JetBrains Mono amount; Row 2 holds date & account/category metadata pills on the left and thumb-friendly Edit/Delete buttons on the right. Completely eliminates cramped text, overlapping amounts, and accidental misclicks.
- **Narrow Mobile Viewport (< 396px) Button Row Stacking:**
  - On viewports narrower than `396px`, dual-action modal button bars (such as Cancel + Save & Confirm / Delete) dynamically switch from `flexDirection: "row"` to `flexDirection: "column"` with full width (`minHeight: 46px`). This prevents horizontal button blowout or text truncation on small mobile devices.
- **Universal Destructive Action Confirmation Modal (`ConfirmDeleteModal.tsx`):**
  - Deleting transactions, savings goals, accounts, wishes, or tasks now opens an explicit confirmation dialog with item name/amount highlight, "Cancel" and "Delete" buttons, and an immediate 1-click Undo toast. Prevents accidental deletions on mobile touch devices.
- **Comprehensive Bilingual Localization (`LanguageProvider.tsx`):**
  - Seamless English / Spanish translation applied across all core app views (Dashboard, Finances, Wishes, DOOs, and Settings), including navigation tabs, filter chips, action buttons, metadata labels, and confirmation prompts.
- **Small-Card Responsive Grid Layout for Catalog Screens (`wishes.tsx`):**
  - Uses CSS Grid (`gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"`) on Web and flex-wrap on Mobile to present wishes as tangible small cards with 125px cover thumbnails, floating badges, bold titles, JetBrains Mono currency, and bottom action rows.
- **Solid, Non-Transparent Panels Against Ambient Mesh Backgrounds:**
  - Never use alpha transparency (`${tokens.financeSoft}40` or semi-transparent cards) directly against radial/ambient mesh canvas backgrounds. Always use solid, opaque `tokens.card` with clear border and box-shadow elevation so cards pop with crisp contrast.
- **Bounded Floating Gray Backing Panel for Modals:**
  - Instead of aggressive pitch-black full-screen blackouts, use a soft dismiss overlay (`rgba(15, 23, 42, 0.45)`) and center a bounded gray panel (`maxWidth: 520, borderRadius: tokens.radiusCard + 6, backgroundColor: isDark ? "#1E293B" : "#E2E8F0", padding: 8`) framing the modal card without taking over the whole viewport.
- **Fixed Viewport Backdrop for Popovers & Settings Panels:**
  - On web, floating popovers (such as Settings) must use `position: "fixed"` with `StyleSheet.absoluteFill` on their backdrop dismissal scrim to span the full window viewport (`100vw × 100vh`) rather than being clipped by a relative parent column, so clicking anywhere outside the popover reliably closes it.
- **Container-Safe Hover States (No Overflow Clipping):**
  - Buttons and interactive items must not expand beyond their container bounds during hover. Set `hoverScale: 1.0` and `hoverLift: 0` for standard buttons, using surface tint/shadow/icon nudge rather than scale enlargement to avoid visual clipping when parent views have `overflow: "hidden"`.
- **Universal Edit Modals & Buttons on All Modules:**
  - Every created item (**Wishes**, **Transactions**, **Budgets**, **Savings Goals**, **Accounts**) features an explicit **Edit** button with pre-filled state, form validation, and explicit **Save & Confirm**.
  - Provides full 1-click **Undo / Cancel** support via `TimedNotice` for both create and update operations.
- **Bidirectional Cross-Linking Architecture (Wishes ↔ DOOs ↔ Finances Accounts):**
  - **Wish → Account Linking:** Added `account_id` foreign key column to `Wish` model (`wishes.account_id -> accounts.id`) with full workspace tenant validation. Allows users to assign a default paying wallet/card to a wish during creation or editing.
  - **Wish → DOO Linking:** Wishes can link to one or more DOO tasks via `linked_doo_ids` during both creation and editing. The backend synchronizes `doo.wish_id = wish.id` atomically.
  - **DOO → Wish Linking:** DOO creation and editing modals offer a Wish picker. When no wishes exist in the workspace, an informative helper text guides the user to create wishes instead of hiding the selector.
  - **Seamless Fulfillment Workflow:** Fulfilling a wish with an expense deduction automatically defaults to the assigned paying account (`wish.account_id`), while still allowing the user to select any other workspace account.
- **Static Export & SEO Hardening (`apps/client/app.json` + `+html.tsx`):**
  - Using `"output": "static"` in `app.json` enables static site generation (SSG) for all routes without Node SSR issues.
  - Generates full indexable HTML (`welcome.html`, `login.html`, `register.html`, `+not-found.html`) with prerendered text, JSON-LD structured data, open-graph cards, and twitter tags so crawlers and search engines parse complete content without executing JavaScript.
  - Files placed in `apps/client/public/` (`robots.txt`, `sitemap.xml`) are copied verbatim to `dist/`.
  - In `apps/client/nginx.conf`, configuring `try_files $uri $uri.html $uri/index.html $uri/ =404;` and `error_page 404 /+not-found.html;` ensures clean URL routing with real HTTP 404 responses for invalid paths, eliminating soft-404s.
  - Adding `<Head><meta name="robots" content="noindex, nofollow" /></Head>` in `(app)/_layout.tsx` guarantees that private authenticated workspace screens are never indexed by search engines.
- **Micro-Typography & Bold Letter-Spacing Rules (`global.css`):**
  - Added targeted `letter-spacing: 0.025em` to `font-weight: 700+` and `letter-spacing: 0.06em` to small uppercase text/badges (`10px–12px`) to eliminate cramped text while keeping larger headings crisp.
- **Top-Right Floating Notification Badges (`TimedNotice.tsx`):**
  - Displays notifications in the top-right corner on PC/Tablet (`top: 24px, right: 24px`) with dynamic theme-aware action colors: Red (`tokens.destructive`) for deletes, Orange (`tokens.warning`) for edits/updates, and Green (`tokens.finance`) for creates/success.
  - Displays as a bottom toast (`bottom: 84px`) above the bottom nav on mobile.
- **SPA Mode (`"output": "single"` in `apps/client/app.json`):** Running Expo Web in `"single"` (SPA) output mode avoids Node 26 SSR CommonJS/ESM incompatibilities while delivering fast client-side routing and hot-reloading.
- **Dual Semantic Token Binding (`ThemeProvider.tsx` + `tokens.ts`):** Applying theme tokens via both HTML `data-theme` / `.dark` attributes AND direct `tokens.*` style props inside core UI primitives guarantees 100% visual consistency.
- **True Responsive Mobile-First Layouts (`useWindowDimensions`):** Design base layouts for mobile (`< 768px`) and scale up to multi-column asymmetric grids and split-screen layouts on Tablet (`≥ 768px`) and Desktop PC (`≥ 1024px`, `maxWidth: 1240px`).
- **Apple HIG & Emil Kowalski Fluid UI Motion (`apps/client/src/lib/motion.ts`):** Use shared fluid curves (`FLUID_EASINGS.outExpo`) and critically damped springs across all screens.

### 2. Backend / Python Flask & Database
- **Atomic Balance Updates & Reversals (`apps/api/app/modules/finances/service.py`):** Handling transaction creation, deletion, and editing with atomic balance adjustments on `Account` and `SavingsGoal` inside the DB transaction avoids race conditions.
- **Pillow Private Image Uploads & EXIF Stripping (`apps/api/app/core/storage.py`):**
  - Automatically verifies image integrity, extracts orientation via `ImageOps.exif_transpose`, normalizes color spaces, resizes to a maximum dimension of 1600px, and saves clean, unidentifiable `.webp` files without camera metadata / GPS tags.
  - Serves sanitized images securely via `/api/v1/wishes/images/<filename>`.
- **Isolated `.venv` inside `apps/api/.venv`:** Always invoke `.venv/bin/python`, `.venv/bin/pip`, and `PYTHONPATH=. .venv/bin/pytest` explicitly inside `apps/api`.
- **Automatic SQLite Fallback When Docker Daemon Is Absent:** Local SQLite fallback when `DATABASE_URL` is not set allows local development and `/api/v1/health` checks to work seamlessly on any host.
- **In-Memory SQLite (`TestingConfig`) for `pytest`:** Using `sqlite:///:memory:` with `RATELIMIT_ENABLED = False` runs the backend test suite in `< 3s`.
- **WorkspaceMember Association Field (`joined_at`):** Note that `WorkspaceMember` uses `joined_at` rather than `created_at`.

---

## ❌ What Didn't Work & How to Avoid It (Never Repeat)

### 1. Conditional Rendering on Parent Prop for Critical Navigation Controls
- **What Happened:** Rendering the Logout button as `{onSignOut ? <Button onPress={onSignOut} /> : null}` caused the button to disappear entirely on screens where `onSignOut` was omitted.
- **Fix / Rule:** Never condition core navigation or security controls on optional parent props. Always render the button unconditionally and provide an internal fallback action.

### 2. Button Component Children vs. Props
- **What Happened:** Passing JSX children to `<Button>` in `apps/client` fails TypeScript checks because `ButtonProps` extends `Omit<PressableProps, "children">` and expects `label`, `icon`, `variant`, etc. as explicit props.
- **Fix / Rule:** Always render `<Button label="..." variant="..." icon={...} />` instead of `<Button><Text>...</Text></Button>`.

### 3. PowerShell Script Path Parsing With Parentheses `(app)`
- **What Happened:** Unquoted paths containing parentheses like `apps/client/app/(app)/wishes.tsx` treat `(app)` as a subexpression command in PowerShell.
- **Fix / Rule:** Always single-quote paths containing parentheses in PowerShell or use agent file tools directly.
