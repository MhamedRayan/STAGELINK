# Person B integration — merge inventory (step 1)

Source: `D:\univ\univ projects\GP\stagelinkFrontend\STAGELINK`, branch `new-frontend`,
commit `3732590 frontend react almost done`.
Target: this repo, branch `feat/web-guest-auth-offers` (PR #8).

Rule: **keep ours on overlap, copy only what is missing, adapt everything copied to our
architecture, tokens and exact Figma geometry.** B's code is a guide, never a verbatim import —
it uses tokens that do not exist here (`mint-50/100/200/300`, `mutedText`, `inverseText`,
`shadow-xs`) and breaks the frozen API in `AGENTS.md §6`.

---

## 1. KEEP OURS — never overwrite

| Area | Why |
| --- | --- |
| `tailwind.config.ts` | Canonical. B's `tailwind.config.js` is stale and was the cause of the broken tokens. Do not add the `.js`. |
| `src/index.css` | Ours removed the `min-width: 1280px` that caused overflow. |
| `src/api/http.ts` + `src/api/*.ts` + `src/api/schema/*` | Our single HTTP entry point and generated types. B's `api/client.ts` and `types/api/*` are hand-rolled and use raw `/svc/...` paths. |
| `src/lib/*` | `format.ts`, `status.ts`, `pagination.ts`, `errors.ts`, `ids.ts`, `roles.ts` are already correct; B's `utils/formatters.ts` is a subset with different names. |
| `src/auth/**` (ours: `features/auth/AuthProvider.tsx`) | B's `auth/AuthContext.tsx`, `useAuth.ts`, `guards.tsx` duplicate ours. |
| `src/app/router.tsx`, `routes.ts`, `nav.ts`, guards | Our route map is complete (46 routes) and correctly guarded. |
| `src/app/AppLayout.tsx` | Already Figma-matched: 260 px forest sidebar, correct tokens, no top nav bar. Do not replace with B's `AppShell.tsx` (300 px, wrong tokens, top-bar title — violates the "sidebar only / no top nav" rule). |
| `src/components/layout/PublicHeader.tsx` | Owner A's guest header. Keep. |
| `src/components/ui/*` (18 files) | Our primitives implement the frozen API. B's `Button`, `Input`, `Modal`, `StatCard`, `EmptyState`, `StatusPill`, `SectionCard` are overlap — keep ours. |
| `features/auth/**`, `features/guest/**`, `features/offers/**`, `features/directory/**`, `features/profile/**`, `features/platform/**` | Owner A's completed lanes, Figma-accurate. B's auth/guest/platform/profile pages must NOT land. |
| `src/demo/directory.json` | Ours has 16 deterministic uuid5 users from the Identity seed. B's copy will not match. |
| `services/identity/.../seed_demo.py` and all infra files | Already fixed in `bc70340`. |

## 2. COPY + ADAPT — missing shared components

B has no `Tabs`, `Stepper`, `Timeline` or `NotificationBell` files at all — those four must be
**built fresh** to the frozen API in `AGENTS.md §6`. Three files can be adapted from B:

| B file | Our target | Adaptation required |
| --- | --- | --- |
| `components/ui/Table.tsx` | `components/ui/DataTable.tsx` | Rename to frozen API: `data→rows`, `keyExtractor→getRowKey`, Column `accessorKey/cell→key/render`, add `align?/width?`. Replace `mint-*/mutedText` tokens with `mint/line/muted/forest-900`. Use our `Skeleton`/`EmptyState`. |
| `components/ui/Pagination.tsx` | `components/ui/Pagination.tsx` | Frozen props `page/pageSize/total/onPageChange`. Replace `outline` button variant with `secondary` (or `link`); replace `mint-200`/`mutedText` tokens. |
| `components/ui/FileDropzone.tsx` | `components/ui/FileDropzone.tsx` | Frozen props `accept: string[] / maxBytes / onSelect / error?`. Validate in bytes (not MB), use our `Button`/`Field` styling and `formatFileSize` from `lib/format.ts`. |
| — | `components/ui/Tabs.tsx` | Build to frozen API. |
| — | `components/ui/Stepper.tsx` | Build to frozen API (Confirmed → In progress → Completed). |
| — | `components/ui/Timeline.tsx` | Build to frozen API. |
| `AppShell.tsx` (unread-count poll only) | `components/ui/NotificationBell.tsx` + `components/layout/TopBar.tsx` | Port the 30 s unread-count poll through our `useNotifications` hook, not `apiRequest`. TopBar = search + bell only (no title — profile titles stay in the page). Sidebar stays in `AppLayout`. |

Then export the new primitives from `components/ui/index.ts` and swap the temporary plain
tables/pager on the three platform pages (only after visual parity is confirmed).

**Status — done.** All eight files were added (`DataTable`, `Pagination`, `Tabs`, `Stepper`,
`Timeline`, `FileDropzone`, `NotificationBell`, `TopBar`), plus `api/notifications.ts` and
`features/notifications/{keys,hooks}.ts` for the 30 s unread poll, and exports in
`components/ui/index.ts`. Gates green: typecheck, lint, 30 tests, build.

**Deferred deliberately:** `TopBar` is **not** wired into `AppLayout` yet. `AGENTS.md §5` samples
the content title at y ≈ 42 with no bar; adding a 64 px bar would push all three Figma-matched
platform pages down and break `24:112` / `24:285` / `24:447`. The search + bell need to be placed
against the actual role frames (e.g. `25:2`) before the shell changes. No top nav bar will be added.

## 3. COPY + ADAPT — missing role pages (our stubs → B's logic)

B's per-role `Profile.tsx` files are **dropped** — our `features/profile/**` pages win.
B's five `Notifications.tsx` files collapse into our single `features/notifications/pages/NotificationsPage.tsx`.

| B page | Our stub to replace | B page | Our stub to replace |
| --- | --- | --- | --- |
| `student/Dashboard` | `StudentDashboardPage` | `university/Dashboard` | `UniversityDashboardPage` |
| `student/BrowseOffers` | `StudentBrowseOffersPage` | `university/Students` | `UniversityStudentsPage` |
| `student/OfferDetails` | `StudentOfferDetailPage` | `university/Supervisors` | `UniversitySupervisorsPage` |
| `student/MyApplications` | `StudentApplicationsPage` | `university/Applications` | `UniversityApplicationsPage` |
| `student/ApplicationDetail` | `StudentApplicationDetailPage` | `university/ApplicationDetail` | `UniversityApplicationDetailPage` |
| `student/MyInternship` | `StudentInternshipPage` | `university/SupervisorAssignment` | `UniversityAssignmentsPage` |
| `student/FinalSubmission` | `StudentSubmissionPage` | `university/Internships` | `UniversityInternshipsPage` |
| `student/Evaluation` | `StudentEvaluationPage` | `university/Cancellations` | `UniversityCancellationsPage` |
| `company/Dashboard` | `CompanyDashboardPage` | `supervisor/Dashboard` | `SupervisorDashboardPage` |
| `company/MyOffers` | `CompanyOffersPage` | `supervisor/MyStudents` | `SupervisorStudentsPage` |
| `company/PostInternship` | `CompanyOfferFormPage` (new + edit) | `supervisor/StudentProfile` | `SupervisorStudentProfilePage` |
| `company/IncomingRequests` | `CompanyApplicationsPage` | `supervisor/InternshipProgress` | `SupervisorInternshipProgressPage` |
| `company/Cancellations` | `CompanyCancellationsPage` | `supervisor/FinalReview` | `SupervisorFinalReviewPage` |
| (five role files) | `NotificationsPage` (one shared) | | |

Port each page's behaviour only: build our own hooks in the owning feature's `hooks.ts`, keep
generated API types unchanged, resolve names via `features/directory`, use `lib/status.ts` maps,
`normalize*Page`, `formatDate`, `useToast`, loading/empty/error states, strings in `strings.ts`,
and exact Figma geometry per `design-plan.md §3`.

**Status — Student lane done (step 3).** B's 10 student files were read in full and ported as
behaviour/layout only. New files: `api/applications.ts`, `features/directory/offers.ts`
(`useOfferSummary`/`useOfferTitle` — closes the checkpoint-2 TODO), `features/student/{keys,hooks,strings}.ts`,
`features/student/components/NameCells.tsx`, 8 Student pages and the one shared `NotificationsPage`
(+ `features/notifications/strings.ts`). `api/internships.ts` gained cancellation, upload and
authenticated download helpers. All B-only tokens, raw `/svc/` calls, `any` and duplicated auth
were removed. Observed deltas vs B: dual pagination shapes normalised via `normalizeOffsetPage` /
`normalizeDrfPage`; status labels from `lib/status.ts`; dates from `lib/format.ts`; missing offer
titles resolved via `useOfferTitle`; company names via `useCompanyLabel`; deadline/status gating for
apply; submission upload restricted to file + 10 MB; evaluation reachable with a real empty state.
Gates green: typecheck, lint, 30 tests, build.

**Status — University lane done (step 4).** B's 8 University pages were mapped and ported as
behaviour/layout only: `features/university/{keys,hooks,strings}.ts`, name cells, and 8 pages
(Dashboard, Students, Supervisors, Applications, Application Detail, Supervisor Assignment,
Internships, Cancellations). `api/applications.ts` gained `postUniversityDecision`;
`api/internships.ts` gained assignment, cancellation decisions and broader list filters;
`features/directory/users.ts` gained `demoDirectoryUsers`; `ReasonDialog` gained an optional
description. Deltas honoured: supervisors/students derived from applications + internships,
cancellations aggregated per internship with bounded load-more, reassign requires a reason.
B's Notifications and Profile pages were deliberately not ported — ours already cover them.

**Status — Supervisor lane done (step 4).** B's 7 Supervisor pages were mapped and ported:
`features/supervisor/{keys,hooks,strings}.ts`, name cells and 5 pages (Dashboard, My Students,
Student Profile, Internship Progress, Final Review) — Profile and Notifications stay ours.
`api/internships.ts` gained detail/history/submission review/evaluation/complete helpers.
Per-internship dashboard calls are capped at 50 and cached for a minute; the matricule column is
hidden outside demo mode; Files/Reports are merged into one Submissions tab; grade is validated
0–20 with at most two decimals and serialised as a string.

**Status — Company lane done (step 4).** B's 7 Company pages were mapped and ported:
`features/company/{keys,hooks,strings,schemas}.ts`, name cells and 5 pages (Dashboard, My Offers,
Post/Edit Internship, Incoming Requests, Cancellations) — Profile and Notifications stay ours.
`api/offers.ts` gained list-mine/create/update/publish/close/delete and `OfferWrite`;
`api/applications.ts` gained `postCompanyDecision`. Deltas honoured: capacity only (no reserved
count), datetime-local deadline with future validation, draft delete restricted with a 409-aware
message, cancellations aggregated per internship (bounded to the first 100).

Reference pattern for the remaining lanes: `api/<service>.ts` → `keys.ts` → `hooks.ts` →
`strings.ts` → pages. `AppLayout`/router were not touched. `TopBar` remains intentionally unwired.
All four gates green after each lane: typecheck, lint, 30 tests, build.

## 4. EVALUATE — infra

Inspect B's `infra/docker/**` and any compose/nginx files for frontend pieces we lack. Bring over
only the frontend Dockerfile / nginx `/svc/*` proxy + SPA fallback / compose service if ours are
missing; do not recreate the user's running Docker stack.

## 5. Sequence after this inventory

1. Shared primitives (DataTable, Pagination, Tabs, Stepper, Timeline, FileDropzone,
   NotificationBell, TopBar) + `components/ui/index.ts`. **Done.**
2. First role lane end-to-end (Student: 8 pages + shared notifications) as the reference
   implementation. **Done.**
3. Remaining role lanes (University → Supervisor → Company). Next.
4. Platform table swap + verification, then full gates (typecheck / lint / test / build).
5. Commit + push to `feat/web-guest-auth-offers`, refresh PR #8, then resume the cross-service
   seed, `useOfferSummary`, Playwright smoke test and two clean demo runs.
