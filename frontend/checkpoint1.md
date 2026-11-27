# STAGELINK Web Client — Checkpoint 1 (Person A)

Scope: Person A's lane only (foundation, auth, guest, profiles, platform admin, infra, demo data).
Person B's lane is tracked in `personBplan.md`. Rules: `frontend/AGENTS.md`.
Verification at this checkpoint: typecheck, lint, 22 unit tests and production build pass in the
sandbox. **Nothing has been run against the live backend or compared visually in a browser yet.**

---

## 1. Done

### Step 1 — Foundation (`stagelink-step1-scaffold.zip`)
- [x] Vite + React 18 + TypeScript strict + Tailwind 3.4, path alias `@/`, ESLint, Vitest
- [x] Design tokens in `tailwind.config.ts` (colours, pills, radii, sidebar 260 / content 1100), Inter font
- [x] Dev proxy `/svc/<service>` → ports 8001–8005; `npm run gen:api` generates types from `contracts/`
- [x] `api/http.ts`: Bearer header, single-flight refresh with rotation, retry once, session expiry, authenticated download
- [x] `lib/`: `session`, `format` (dd/mm/yyyy, Africa/Algiers), `status` (all status maps), `pagination` (both shapes), `errors`, `ids`, `roles`, `cn`
- [x] `AuthProvider` / `useAuth`, guards (`RootRedirect`, `PublicOnly`, `RequireRole`)
- [x] `ROUTES`, `PATTERNS`, `ROLE_HOME`, per-role `nav.ts`, router with a stub page for every route
- [x] Temporary `AppLayout` (to be replaced by B's `AppShell`)
- [x] `AGENTS.md` rules file (updated with Figma-sampled values)

### Step 2 — Login (`stagelink-step2-login.zip`)
- [x] `AuthLoginPage` matching Figma 24:3 (user confirmed "exactly as the design")
- [x] `Logo`, `Button` (+ `lg` size), `Input`, `Field`
- [x] 401 → "Invalid email or password", 403 → "awaiting platform verification"
- [x] "Forgot password?" removed from Login (no password-reset API)

### Step 3 — Register + guest link (`stagelink-step3-register.zip`)
- [x] `AuthCompanyRegisterPage`, `AuthRegistrationSubmittedPage`
- [x] `PublicHeader`, `StatusPill`; login ↔ guest navigation links

### Step 4 — Guest pages (`stagelink-step4-guest.zip`)
- [x] Register form restored to the 8 designed fields (4 rows × 2)
- [x] Logo on rounded off-white tile (radius 10, `#F8FFF9`)
- [x] `GuestBrowseOffersPage` (search, location filter, 3-column cards, skeleton/empty/error, pager)
- [x] `GuestOfferDetailPage` (brand-only header, back link, apply card)
- [x] Shared `OfferCard`, `OfferFilters`, offers hooks/keys, `api/offers`, `api/companies`, company-name resolver
- [x] `Pill`, `Skeleton`, `EmptyState`, `ErrorState`, `useDebouncedValue`

### Step 5 — Profiles + password (`stagelink-step5-profiles.zip`)
- [x] Student, Company, Supervisor, University, Platform profile pages (Figma 25:1778, 26:185, 27:1013, 28:1555, 24:605)
- [x] `ChangePasswordModal` → `/password-changed`, `AuthPasswordChangedPage` (Figma 62:97)
- [x] `Modal` (focus trap, Esc), `Toast` + `ToastProvider`, `Textarea`
- [x] Supervisor assignment summary derived client-side (unit-tested)

### Your own edits (preserved, never overwrite)
- [x] `GuestBrowseOffersPage.tsx` (bold title, centred grid) and `PublicHeader.tsx` (non-clickable "Companies")
- [x] `ui/index.ts` exports, `roleHome` helper, demo-directory fixes, TS/Tailwind config fixes, `src/pages` excluded from checks

---

## 2. Left to do (Person A)

### 2.1 Platform admin — next step
- [ ] `PlatformDashboardPage` (Figma 24:112): real counts from admin endpoints
- [ ] `PlatformCompanyVerificationPage` (24:285): pending companies table, approve, reject with required reason
- [ ] `PlatformCreateAccountsPage` (24:447): provision student / supervisor / university-admin accounts
- [ ] `ReasonDialog` and `ConfirmDialog` (listed in the frozen UI API, not built yet)

### 2.2 Directory and demo data
- [x] `useUserLabel` + real `src/demo/directory.json`, gated by `VITE_DEMO_DIRECTORY=1`
- [ ] `useOfferSummary` (offer titles are not in applications/internships responses)
- [x] Identity half of the rich seed: 16 accounts, all role profiles, 6 companies
      (3 verified / 2 pending / 1 rejected), deterministic uuid5 ids, directory output
- [ ] Cross-service half of the rich seed (offers in every status, applications,
      internships started/completed, submissions, notifications)
- [x] Re-run seed instructions for Person B (`docs/setup.md` account table + new flags)

### 2.3 Infra and quality
- [ ] Frontend `Dockerfile` + nginx (`/svc/*` proxy, SPA fallback) + compose service
- [ ] CI job for the client (lint, typecheck, test, build)
- [ ] Playwright smoke test (login → dashboard per role)
- [ ] `docs/setup.md` update and ADRs 015–017
- [ ] Demo script (2 runs) before the freeze

### 2.4 Integration with Person B
- [ ] Replace temporary `AppLayout` body with his `AppShell` (and drop the profile-page title conflict: `TopBar` = search + bell only)
- [ ] Replace the guest pager with his `Pagination`
- [ ] Give him the final `AGENTS.md` (mentions `Modal`, `useToast`, `PublicHeader minimal`, new files)
- [ ] Remove unused stubs/`StubPage` once B's pages land

### 2.5 Verification not yet done
- [ ] Manual run against the live backend: login with all 5 demo roles, role redirects, refresh after expiry, logout
- [ ] Company register end-to-end (incl. 400 duplicate email and 429)
- [ ] Each profile: load, save, validation errors, change password → logout flow
- [ ] Visual comparison with Figma at 1440×900 and 1280 for every built screen
- [ ] Tailwind build warning ("invalid empty theme utility"): not reproducible on the clean scaffold; waiting for the exact warning text

---

## 3. Open decisions and known limitations

| # | Item | State |
| --- | --- | --- |
| 1 | Register: legal form, location, registration number, phone are shown but **not stored** (API accepts name/email/password only) | Needs backend support |
| 2 | Forgot password: no API; link removed from Login | Removed by you |
| 3 | Company profile: contact email is read-only text; phone, website, contact person are editable | As designed + plan |
| 4 | Profile save sends the full role body, so blank required fields must be filled first | By API design |
| 5 | Sidebar 260 px / content 1100 px (Figma) instead of 300 / 1140 (plan) | Decided, in `AGENTS.md` |
| 6 | Primary button `#235347` and secondary mint+border follow Figma, not the plan | Decided, in `AGENTS.md` |
| 7 | Guest "Log in to apply" button text copies Figma's left offset literally | Change if it looks off |
| 8 | "Companies" header item is non-clickable (no companies page exists) | Your edit |
| 9 | Location filter options come from one request of ≤ 100 offers | Limitation |
| 10 | Modal (change password) has no Figma frame; styled from tokens | Review |
| 11 | Profile cards keep the frame's fixed heights even where fields were removed | Easy to shrink |

## 4. Gates

| Gate | Status |
| --- | --- |
| G1 Foundation (scaffold, auth core, login) | Done (pending live-backend check) |
| G2 All routes render | Depends on Person B |
| G3 End-to-end workflow | Depends on both lanes + rich seed |
| G4 Docker/nginx | Not started |
| G5 Freeze | Wed 25 Nov 2026 |
