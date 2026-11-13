# WishesAndDOOs — Agent Engineering & Design Rules

You are working on **WishesAndDOOs**, a personal & shared Wishlist, Task ("DOOs"), and Finance Manager. You MUST strictly follow every rule in this file on every turn.

---

## 1. Single Source of Truth: `docs/ARCHITECTURE.md`

- **Mandatory Pre-Read:** Before writing or modifying any backend or frontend code, read and follow [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- **No Unapproved Architectural Deviations:**
  - **Frontend (`apps/client`):** Universal Expo (React Native + React Native Web) + Expo Router v4 + TypeScript + NativeWind v4 + `shadcn/ui` primitives + TanStack Query v5.
  - **Backend (`apps/api`):** Modular Python Flask (Application Factory + Blueprints) + SQLAlchemy 2.0 + Alembic + Pydantic v2.
  - **Interaction Model:** Strictly **Explicit Save & Confirm** buttons on all mutations. Never introduce unsolicited real-time websockets or auto-save without confirmation.
  - **Security Requirements:** Argon2id password hashing (`argon2-cffi`), short-lived JWT access tokens (15m) + rotating hashed refresh tokens (`USER_SESSIONS`), `Flask-Limiter` brute-force protection, workspace-scoped authorization (`WORKSPACE_MEMBERS`), and `Pillow` EXIF stripping on private image uploads.
  - **Multi-Tenancy Ready:** Every domain record (`WISHES`, `DOOS`, `ACCOUNTS`, `TRANSACTIONS`, `BUDGETS`, `SAVINGS_GOALS`, `CATEGORIES`) MUST belong to a `workspace_id`.

---

## 2. Mandatory UI/UX Design Intelligence (`ui-ux-pro-max`)

- **Always Use `ui-ux-pro-max` When Designing Screens:**
  - Consult [design-system/wishesanddoos/MASTER.md](./design-system/wishesanddoos/MASTER.md) and run the `ui-ux-pro-max` search tool (`/home/chii/.gemini/config/plugins/ui-ux-pro-max/skills/ui-ux-pro-max/scripts/search.py`) when designing new screens, components, forms, or interactions.
  - Enforce the canonical pre-delivery checklist in `ui-ux-pro-max/references/pro-rules.md`.
- **Mobile-First Approach (`390×844` Base Viewport):**
  - Every screen and modal MUST be designed for mobile portrait viewports first (`375px–430px`), with thumb-friendly controls (`minHeight: 44px–52px`), safe-area compliance, and zero horizontal scroll, then scaled cleanly to larger viewports.
- **Strict 2-Axis Semantic Theme Token Engine:**
  - **NEVER** hardcode hex colors (`#...`), raw Tailwind palette classes (`bg-zinc-900`, `text-emerald-500`), or arbitrary border radii inside screens or UI components.
  - Always consume semantic tokens from `useAppTheme()` ([apps/client/src/theme/ThemeProvider.tsx](./apps/client/src/theme/ThemeProvider.tsx)) and [apps/client/src/theme/tokens.ts](./apps/client/src/theme/tokens.ts) so all 3 minimalist theme styles (`classical`, `pastel`, `joyful`) × 2 color modes (`light`, `dark`) work automatically.
- **Visual Polish Standards:**
  - Never use emojis as UI icons; use `MaterialIcons` (`@expo/vector-icons`) vector icons exclusively.
  - Always use `tabular-nums` / monospace (`JetBrains Mono`) for currency amounts, balances, and percentages, and `Plus Jakarta Sans` for UI/headings.
- **Mandatory Fluid UI Motion & Tactile Hover States (Apple HIG & Emil Kowalski):**
  - Every screen and interactive component MUST use the shared fluid motion engine ([apps/client/src/lib/motion.ts](./apps/client/src/lib/motion.ts)):
    - **Staggered Entrances:** Use `useStaggerEntrance(index)` (`cubic-bezier(0.16, 1, 0.3, 1)` + subtle `12px` Y-offset + `0.985` scale) for major sections and cards.
    - **Hover & Press Micro-Interactions:** Never leave buttons, links, icon toggles, or interactive rows feeling flat. Every button, link, and interactive chip MUST respond to both **hover** (subtle spring lift `translateY: -1.5px`, `scale: 1.015`, elevated shadow / surface tint, and directional icon nudge) and **press** (`scale: 0.97` critically damped spring) without shifting layout bounds.
    - **Form & State Feedback:** Use `useErrorShake()` on validation/auth failures, `usePulseScale()` when auto-filling or transferring values, and fluid spring morphing between screen states while respecting `prefers-reduced-motion`.
    - **Full-Canvas Radial Gradient with Rotating Perimeter Origin (`AmbientMeshBackground`):** Every screen MUST render `<AmbientMeshBackground variant={...} />` ([apps/client/src/components/ui/AmbientMeshBackground.tsx](./apps/client/src/components/ui/AmbientMeshBackground.tsx)) with its distinct perimeter start position (`"bottom-to-top"` → `"corner-top-right"` → `"right-to-left"` → `"corner-bottom-right"` → `"top-to-bottom"` → `"corner-top-left"` → `"left-to-right"` → `"corner-bottom-left"`) so the multi-stop circular radial gradient smoothly glides (`cubic-bezier(0.16, 1, 0.3, 1)` over `950ms`) around the perimeter on every screen change without leaving stark white/flat areas.

---

## 3. Screen-by-Screen Construction & Verification Loop

Follow the **10-Screen Construction Plan** in Section 9 of [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md):
1. **Build One Screen Slice at a Time:** Construct only the current target screen (and its required DB models, Flask endpoints, and UI components). Do NOT jump ahead to future screens until the user reviews and approves the current screen.
2. **Automated Testing Gate (Mandatory Before Handoff):**
   - Run backend tests: `cd apps/api && PYTHONPATH=. .venv/bin/pytest -v`
   - Run frontend typecheck & unit tests: `cd apps/client && npm run typecheck && npm test`
   - Verify live HTTP responses from both Flask (`http://localhost:5000/api/v1/health`) and Expo Web (`http://localhost:8081`).
3. **Pause for Live User Review:** Leave both dev servers running so the user can test the screen, adjust colors/layout/functionality, and explicitly approve moving to the next screen.

---

## 4. Continuous Project Memory: `MEMORY.md`

- Read @[MEMORY.md](./MEMORY.md) before starting each task.
- Whenever you discover a pattern that works particularly well, or encounter an error/pitfall and fix it, immediately log it in [MEMORY.md](./MEMORY.md) under **"What Works Well"** or **"What Didn't Work & How to Avoid It"** so mistakes are never repeated.

---

## 5. Priority Next-Session Queue (Complete Before Moving to Screen 5)

Before constructing **Screen 5: Finances Screen (`/finances`)**, complete the following **Screen 4 (`/dashboard` & `AdaptiveShell.tsx`) UI/UX Refinements** requested by the user:
1. **Harmonize Dashboard Background & Nav Surfaces:** Adjust the dashboard background and make the sidebar/top-nav surfaces translucent/integrated so the navigation bars do not stand out starkly against the canvas.
2. **Compact Desktop Top Header (Half Height on PC):** Make the top navigation bar on Desktop (`isDesktop`) half its current height (slim ~`36px–40px` bar, compact single-line layout).
3. **Floating Settings Mini-Panel Popover (Desktop):** Clicking the Settings button on Desktop MUST open an anchored floating mini-panel popover (`position: "absolute"`, `zIndex`) right beneath the button—never a full-width inline banner inside the dashboard flow.
4. **Mobile Module Navigation + Hamburger Overlap Drawer:**
   - Ensure mobile viewports have a clear, always-visible menu to move between modules (*Dashboard*, *Finances*, *Wishes*, *DOOs*).
   - Add a **Hamburger Button (`menu` icon)** on mobile that opens an **overlapping slide-over panel / drawer** for navigation and settings.
5. **Embed Live Theme Switcher in Settings Panel:** Include the **2-Axis Theme Switcher** (`Classical` / `Pastel` / `Joyful` + `Light` / `Dark` mode) inside both the Desktop floating Settings mini-panel and the Mobile Hamburger overlap panel.

<!-- concord:start -->
## Concord — shared work-state for coding agents

<!-- concord:workflow-version=7 -->

This project uses Concord MCP. Keep coordination to the five workflow tools:

- **Before editing**, call `start_work` with the task, your agent kind, and
  expected files or modules. It registers presence, accepts assigned work when
  appropriate, claims the scope, and returns overlap warnings. Concord derives
  your `agent_id` from your session — omit it unless your client told you one.
- Use `inspect_work` to read the workspace, one task, one agent, or one message
  thread. Use `update_work` for durable progress and for live prompts/replies
  to another promptable workspace agent, including while that agent is busy.
- Use `transfer_work` for assignment, acceptance, decline, release,
  reassignment, evidence-bearing handoff offers, and reopening.
- **Before finishing**, call `finish_work` once with the outcome, changed
  files, tests, assumptions, decisions, risks, guardrails, and provenance. It
  records evidence and can mark work review-ready or terminal.
- Before handing work to cloud Devin, use `transfer_work` to hand off or
  release your local claim; cloud Devin cannot access this local Concord state.

Keep each claim small and resolve reported overlaps before editing. Concord
regenerates human-readable review artifacts in `.concord/`.

Enforcement remains client-dependent. `concord doctor` reports setup and
workflow adoption; optional hooks can block exact-file collisions.

Replace <agent-id> with the id the SessionStart hook printed for this session.
A monitor may not inherit the session's environment, so it cannot work the id out itself.

In Grok Build, keep this session reachable while idle by starting one persistent
monitor for `concord inbox watch --agent <agent-id> --provider grok`. Do not start a duplicate when that monitor is active.

In Cursor, start exactly one Cursor background Shell task for `concord inbox watch --agent <agent-id> --provider cursor --once`.
Leave it active when the turn ends. When Cursor resumes you with its completion,
answer the emitted peer message and immediately start a fresh background monitor.

In Gemini CLI, start the exact monitor command supplied by the SessionStart hook
(`concord inbox watch --agent <agent-id> --provider gemini --once`) with `run_shell_command` and `is_background: true`. Project
settings inject background completion into the agent. Answer the peer message,
then immediately start a fresh background monitor.

In Antigravity, start exactly one background command for `concord inbox watch --agent <agent-id> --provider antigravity --once`
and end the turn without waiting on it. Its completion wakes the idle session:
answer the peer message, then immediately start a fresh background monitor.
<!-- concord:end -->
