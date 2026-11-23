# STAGELINK Web Client — Checkpoint 2 (Person A)

Branch: `feat/web-guest-auth-offers`
Scope: Person A's lane only (foundation, auth, guest, profiles, platform admin, demo data).
Checkpoint 1 is in [`checkpoint1.md`](checkpoint1.md); rules are in [`AGENTS.md`](AGENTS.md).

Verification at this checkpoint:

```
frontend: npm run typecheck ✓   npm run lint ✓   npm run test ✓ (30 tests)   npm run build ✓
identity: python manage.py test api → 54 tests OK
```

Nothing in this checkpoint has been exercised against the live Docker stack yet.
Fidelity was checked by comparing Figma geometry from `get_design_context` with DOM
measurements in a throw-away browser harness (deleted afterwards).

---

## 1. Done since checkpoint 1

### Platform admin — all three Figma screens
- **`24:112` Dashboard** (`PlatformDashboardPage.tsx`): welcome heading, 4 real stat cards
  from the admin endpoints, pending-companies table, Quick Actions. Geometry: content
  x=302, 1080 wide; 260×110 cards on a 13 px pitch; 760 px table + 300 px Quick Actions
  at y=320; 56 px rows.
- **`24:285` Company Verification** (`PlatformCompanyVerificationPage.tsx`): status filter,
  700 px table + 380 px details panel at y=130, 60 px rows, verify / reject with a required
  reason, loading/empty/error states.
- **`24:447` Create Accounts** (`PlatformCreateAccountsPage.tsx`): 540 px cards, password
  or `generate_password: true`, one-time generated password in an accessible modal,
  inline validation and API field errors. Includes the approved third (Supervisor) card.
- **`AppLayout.tsx`** now uses the designed 260 px forest sidebar, not a top nav bar:
  logo/wordmark/descriptor, active row, bottom account menu and logout. Measured against
  all three frames (logo 25,23; divider y=122; nav start y=141; footer divider y=820).
- Shared primitives added: `PageHeader`, `StatCard`, `StatusPill`, `Modal`, `ReasonDialog`,
  `ConfirmDialog`, `Select`, `Textarea`, `Toast`.
- **Root cause of broken styling fixed:** stale `frontend/tailwind.config.js` was shadowing
  the canonical `.ts`, so tokens like `text-page-title`, `bg-pill-warning-bg`, `w-sidebar`
  were never generated. The `.js` is deleted. `src/index.css` also lost the 1280 px
  `min-width` that caused horizontal overflow at 1280.

### Demo data (Identity half)
- `seed_demo.py` now creates **16 accounts**: 1 platform admin, 1 university admin,
  3 supervisors, 5 students and 6 companies (3 verified incl. *ABC Company* and
  *EURL FARISSIA*, 2 pending, 1 rejected with a reason). Only active companies can log in.
- Ids are deterministic `uuid5` values from the email local part; the generated
  `frontend/src/demo/directory.json` therefore matches every fresh seed. New flags:
  `--directory-file`, `--skip-directory`; a verification decision made through the UI is
  preserved on rerun.
- `features/directory/users.ts` adds `useUserLabel` / `useDemoDirectoryUser`, gated by
  `VITE_DEMO_DIRECTORY=1` (added to `.env.example`). Unknown ids degrade to `Role · 3f2a9c`.
- `docs/setup.md` documents the full account table and rerun commands; `design-plan.md`
  records the “5 vs 6 companies” Δ; `checkpoint1.md` §2.2 is updated.

### Δ decisions to remember
- Dashboard “Registered” → “Legal name” (`AdminCompanySummary` has no registration date).
- Company provisioning card has no phone/location; university card has no address/admin name.
- Students cannot be provisioned through `POST /api/admin/users/` (company, university_admin,
  supervisor only) — checkpoint 1 wording was wrong.
- Pending companies have no public profile (404 → “Not provided” for location/phone).
- Platform tables use plain semantic tables + a small DRF pager until B's components land.

---

## 2. To do next time (in order)

1. **Cross-service half of the rich seed** — a workflow script that calls the public APIs,
   not another service's database: ≥6 offers (published/draft/closed/near deadline),
   applications in every status (two rejections with reasons, one confirmed, one withdrawn
   after confirmation, two live for the same student), internships `confirmed` / `in_progress`
   / `completed` (approved submission + `17.50` evaluation) / `cancelled`, one pending
   cancellation request, rejected-then-approved submission versions with real files <10 MB,
   and unread/read notifications per role. **Internships must already be started for evaluation.**
2. **`useOfferSummary`** in `features/directory` — **done** during B integration as
   `features/directory/offers.ts` (`useOfferSummary` + `useOfferTitle`), used by the Student lane.
3. **Infra & quality**: frontend `Dockerfile` + nginx (`/svc/*` proxy, SPA fallback),
   compose service, CI job (lint/typecheck/test/build), Playwright smoke test
   (login → dashboard per role), `docs/setup.md` + ADRs 015–017.
4. **Live verification**: all 5 demo roles log in, role redirects, refresh after expiry,
   logout, company registration (incl. 400 duplicate + 429), every profile save and
   password-change flow, visual comparison at 1440×900 / 1280 / 1920.
5. **Demo script — two clean runs** before the freeze (G5, Wed 25 Nov 2026).

---

## 3. Waiting on Person B

B's lane has been received as a separate completed frontend and is being integrated per
`merge-inventory.md` (keep ours on overlap, copy only missing, adapt all copied code). Completed:

- Shared primitives `DataTable`, `Pagination`, `Tabs`, `Stepper`, `Timeline`, `FileDropzone`,
  `NotificationBell`; `TopBar` exists but is deliberately not wired (would shift Figma-matched
  pages down). No top nav bar is added.
- Student lane: 8 pages + one shared `NotificationsPage`, with our hooks/tokens/status maps.
- Remaining from B's source: University, Supervisor and Company page logic (still stubs here).

**Handoff notes for B (shared files already changed):**
- `frontend/tailwind.config.js` was deleted — the canonical `tailwind.config.ts` now wins.
- `src/index.css` no longer forces `min-width: 1280px`.
- `Modal`, `ToastProvider/useToast`, `ReasonDialog`, `ConfirmDialog`, `PageHeader`,
  `StatCard`, `StatusPill`, `Select`, `Textarea` are implemented in `components/ui`.
- `useUserLabel` and `useCompanyLabel` are available from `features/directory`.
- `router.tsx`, `nav.ts`, `routes.ts`, `lib/*`, `api/http.ts` were kept unchanged except
  for the platform route wiring; coordinate before editing them.

---

## 4. Gates

| Gate | Status |
| --- | --- |
| G1 Foundation + auth + guest | Done (live-backend check still pending) |
| G2 All 46 routes render | Blocked by Person B's pages |
| G3 End-to-end workflow | Blocked by cross-service seed + Person B's pages |
| G4 Docker/nginx/CI | Not started (Person A) |
| G5 Freeze (Wed 25 Nov 2026) | At risk until G2/G4 land |
