# STAGELINK Web Client — Design Plan

Status: **frozen scope**, version 1.0 — 22 Nov 2026
Delivery: finished product by **25 Nov 2026**
Design source: Figma file `STAGLINK` (`AWX5zvFczxmhQjf8DloPCh`, last modified 2026-11-02),
pages *Guest & Auth*, *Student*, *Company*, *University Admin*, *Supervisor*, *Platform Admin*.

This document is the build reference for the five member lanes. It describes every in-scope
page, the data each page needs, the actions it offers, and everything deliberately left out.
The Figma frames are the visual source of truth; the OpenAPI files in `contracts/` are the
functional source of truth. Where the two disagree, the deviations are marked **Δ** and are
binding.

---

## 1. Scope at a glance

| Area | Screens in scope | Figma page |
| --- | --- | --- |
| Guest & Auth | 6 | Guest & Auth (`24:2`) |
| Student | 12 | Student (`10:2`) |
| Company | 7 | Company (`14:2`) |
| University Admin | 10 | University Admin (`0:1`) |
| Supervisor | 7 | Supervisor (`19:2`) |
| Platform Admin | 4 | Platform Admin (`24:111`) |
| **Total** | **46** | 49 designed, 3 excluded |

Excluded designed screens: *Auth — Forgot Password*, *Auth — Verification Code*,
*Auth — Reset Password*. Identity exposes no password-reset API.

### Locked decisions

| Topic | Decision |
| --- | --- |
| Framework | React 18 + Vite + TypeScript (strict) |
| Styling | Tailwind, tokens taken from the Figma design-system frame |
| Routing / data / forms | React Router, TanStack Query, react-hook-form + zod |
| API types | `openapi-typescript` generated from `contracts/*.yaml` |
| API origins | One origin to the browser: Vite proxy `/svc/*` in dev, nginx path prefixes in production |
| Auth | Bearer access token (15 min) + rotating refresh (7 days); no cookies |
| Target | Desktop only, 1440×900 baseline, supported 1280–1920 |
| Language / locale | English (`en-GB`), `Africa/Algiers`, dates `dd/mm/yyyy` |
| Backend changes | **None.** The client adapts to the existing APIs |

### Design tokens

From the *Design System — STAGLINK* frame (`4:610`):

| Token | Value |
| --- | --- |
| Background / Mint | `#DAF1DE` |
| Forest / 900 | `#051F20` |
| Forest / 800 | `#0B2B26` |
| Surface / 700 | `#163832` |
| Surface / 600 | `#235347` |
| Accent / Sage | `#8EB69B` |
| Content canvas (dashboard frames) | `#F8FFF9` |
| Muted text | `#4D7770` |
| Inverse text | `#F5FFF7` |
| Typeface | Inter (400 / 500 / 600 / 700) |
| Type scale | Page title 28 bold, section heading 18 semibold, body 13 regular |

**Δ** The dashboard frames use `#F8FFF9` as the content canvas while the design-system frame
names `#DAF1DE` as *Background / Mint*. Treat `#DAF1DE` as the muted surface colour for cards
and section bands, and `#F8FFF9` as the page canvas.

---

## 2. Application shell

Every authenticated page uses the same shell, visible in all role frames.

- **Sidebar** — 300 px fixed, Forest 900 background, full-height.
  - Logo tile + `STAGLINK` wordmark + descriptor “University Internship Management Platform”.
  - Role navigation list (see below), 44 px rows, active row uses Surface 600 with a lighter label.
  - Bottom block: avatar circle (initials only), full name, role label.
- **Content area** — page canvas `#F8FFF9`, 48 px padding, max content width 1140 px.
- **Top bar** — page title + one-line subtitle on the left; on the right a search input
  (capped at 360 px) and a bell with an unread dot.
- **Page header pattern** — title (28 bold), muted subtitle, optional primary action button on
  the right.
- **Stat cards** — 4-up row, mint `#DAF1DE` surface, 12 px radius, label / large value / hint.
- **Section cards** — white or mint surface, 12 px radius, 24 px padding, section heading 18.
- **Tables** — header row with 11 px uppercase muted labels, 13 px body, 1 px separators,
  row actions at the right.
- **Buttons** — primary: Forest 900 fill, inverse text; secondary: transparent with 1 px
  Forest border; destructive text in the rejection red.
- **Status pills** — rounded full, tinted background + dark text, one component driven by the
  status maps in §4.

### Navigation per role

The frames are inconsistent (some hide *Notifications*, the supervisor sidebar shows only four
items). The final navigation is fixed here:

| Role | Sidebar items |
| --- | --- |
| Student | Dashboard · Browse Offers · My Applications · My Internship · Final Submission · Notifications · Profile |
| Company | Dashboard · Company Profile · My Offers · Post Internship · Incoming Requests · Cancellations · Notifications |
| University Admin | Dashboard · Students · Supervisors · Applications · Internships · Cancellations · Notifications · Profile |
| Supervisor | Dashboard · My Students · Final Reviews · Notifications · Profile |
| Platform Admin | Dashboard · Companies · Company Verification · Universities · Create Accounts · Profile |

Guest pages use a slim public header: logo, “Browse Offers”, “Log in”.

### Shared behaviour

- **Access control** — every `/app/*` route is guarded by role; a wrong-role visit redirects to
  that role’s dashboard. Public routes redirect authenticated users to their dashboard.
- **Session** — access token in memory, refresh token in `localStorage`; every 401 triggers one
  refresh attempt, then logout. Password change and deactivation revoke all refresh tokens.
- **Dates** — render via one formatter: `dd/mm/yyyy` (dates) and `dd/mm/yyyy HH:mm`
  (timestamps). Notification rows use relative time (“2 hours ago”) with an absolute tooltip.
- **Search** — the top-bar search filters the current page’s list only. There is no global
  search endpoint (**Δ** see §7).
- **Pagination** — one shared component that understands the two response shapes in use:
  DRF pages (`count/next/previous/results` with `page`) and offset pages
  (`results/pagination{limit,offset,total}`). Default page size 20; offers request
  `page_size=20`.
- **Feedback** — toasts for success, inline field errors from the API, a full-page error state
  for failed loads, and an empty state per table.
- **Files** — uploads are multipart; downloads use `fetch` + blob because the download endpoint
  requires the Bearer header.
- **Notifications** — unread count polled every 30 s; opening one marks only that one read.

### Route map

| Route | Screen | Role | Figma frame |
| --- | --- | --- | --- |
| `/login` | Login | public | Auth — Login (`24:3`) |
| `/register/company` | Company Register | public | Auth — Company Register (`62:4`) |
| `/register/submitted` | Registration Submitted | public | Auth — Registration Submitted (`62:37`) |
| `/password-changed` | Password Changed | authenticated | Auth — Password Changed (`62:97`) |
| `/offers` | Browse Offers | public | Guest — Browse Offers (`24:18`) |
| `/offers/:offerId` | Offer Details | public | Guest — Offer Details (`24:87`) |
| `/` | redirects to `/offers` or the role dashboard | — | — |
| `/app/student` | Dashboard | student | Student — Dashboard (`25:2`) |
| `/app/student/offers` | Browse Offers | student | Student — Browse Offers (`25:180`) |
| `/app/student/offers/:offerId` | Offer Details | student | Student — Offer Details (`25:375`) |
| `/app/student/applications` | My Applications | student | Student — My Applications (`25:524`) |
| `/app/student/applications/:applicationId` | Application Detail (3 designed states) | student | `25:704`, `25:858`, `25:1004` |
| `/app/student/internship` | My Internship | student | Student — My Internship (`25:1151`) |
| `/app/student/internship/submission` | Final Submission | student | Student — Final Submission (`25:1313`) |
| `/app/student/internship/evaluation` | Evaluation | student | Student — Evaluation (`25:1472`) |
| `/app/student/notifications` | Notifications | student | Student — Notifications (`25:1617`) |
| `/app/student/profile` | Profile | student | Student — Profile (`25:1778`) |
| `/app/company` | Dashboard | company | Company — Dashboard (`26:2`) |
| `/app/company/profile` | Company Profile | company | Company — Profile (`26:185`) |
| `/app/company/offers` | My Offers | company | Company — My Offers (`26:350`) |
| `/app/company/offers/new` | Post Internship | company | Company — Post Internship (`26:525`) |
| `/app/company/offers/:offerId/edit` | Post Internship (edit mode) | company | Company — Post Internship (`26:525`) |
| `/app/company/applications` | Incoming Requests | company | Company — Incoming Requests (`26:697`) |
| `/app/company/cancellations` | Cancellations | company | Company — Cancellations (`26:860`) |
| `/app/company/notifications` | Notifications | company | Company — Notifications (`26:1016`) |
| `/app/university` | Dashboard | university_admin | Admin — Dashboard (`28:2`) |
| `/app/university/students` | Students | university_admin | Admin — Students (`28:184`) |
| `/app/university/supervisors` | Supervisors | university_admin | Admin — Supervisors (`28:373`) |
| `/app/university/applications` | Applications | university_admin | Admin — Applications (`28:541`) |
| `/app/university/applications/:applicationId` | Application Detail | university_admin | Admin — Application Detail (`28:717`) |
| `/app/university/assignments` | Supervisor Assignment | university_admin | Admin — Supervisor Assignment (`28:876`) |
| `/app/university/internships` | Internships | university_admin | Admin — Internships (`28:1043`) |
| `/app/university/cancellations` | Cancellation Requests | university_admin | Admin — Cancellations (`28:1215`) |
| `/app/university/notifications` | Notifications | university_admin | Admin — Notifications (`28:1719`) |
| `/app/university/profile` | University Profile | university_admin | Admin — Profile (`28:1555`) |
| `/app/supervisor` | Dashboard | supervisor | Supervisor — Dashboard (`27:2`) |
| `/app/supervisor/students` | My Students | supervisor | Supervisor — My Students (`27:186`) |
| `/app/supervisor/students/:internshipId` | Student Profile | supervisor | Supervisor — Student Profile (`27:357`) |
| `/app/supervisor/internships/:internshipId` | Internship Progress | supervisor | Supervisor — Internship Progress (`27:534`) |
| `/app/supervisor/reviews/:internshipId` | Final Review & Evaluation | supervisor | Supervisor — Final Review (`27:689`) |
| `/app/supervisor/notifications` | Notifications | supervisor | Supervisor — Notifications (`27:856`) |
| `/app/supervisor/profile` | Profile | supervisor | Supervisor — Profile (`27:1013`) |
| `/app/platform` | Dashboard | platform_admin | Platform — Dashboard (`24:112`) |
| `/app/platform/companies` | Companies | platform_admin | — (addition, no frame) |
| `/app/platform/verification` | Company Verification | platform_admin | Platform — Company Verification (`24:285`) |
| `/app/platform/universities` | Universities | platform_admin | — (addition, no frame) |
| `/app/platform/accounts/new` | Create Accounts | platform_admin | Platform — Create Accounts (`24:447`) |
| `/app/platform/profile` | Profile | platform_admin | Platform — Profile (`24:605`) |

---

## 3. Page specifications

Each page lists its frame, content, data sources, actions and deviations.

### 3.1 Guest & Auth

#### Login — `/login` (`24:3`)
- **Layout:** centred card on Mint background: logo, title, subtitle, email, password, primary
  “Log in”, link “New company? Create an account”.
- **Data:** `POST /api/auth/login/` → `access`, `refresh`, `user` (includes `role`).
- **Behaviour:** on success, redirect by `user.role` to that role’s dashboard. On 401 show
  “Invalid email or password”. On 403 (inactive company) show “This account is awaiting
  platform verification”.
- **Δ** The “Forgot password?” link is removed — there is no reset API.
- **Δ UI (user-directed):** the password field has an eye toggle to show or hide its value.
- **Notes:** students, supervisors and university admins receive accounts from their
  institution; only companies self-register.

#### Company Register — `/register/company` (`62:4`)
- **Layout:** single card, two-column field grid, intro copy explaining post-registration
  verification, primary “Create company account”, link “Back to log in”.
- **Fields kept:** company name, email, password, confirm password.
- **Δ Fields removed:** legal form, registration number, location, phone, separate contact
  email. `POST /api/auth/register/` accepts only `email`, `name`, `password`, `role`; a company
  cannot sign in to finish its profile until it is verified.
- **Data:** `POST /api/auth/register/` with `role: "company"`. The submitted `name` becomes the
  company display name and the initial `legal_name`.
- **Behaviour:** on 201 go to `/register/submitted`; on 400 map field errors (duplicate email,
  weak password); on 429 show a retry message.
- **Δ UI (user-directed):** both password fields have independent eye toggles.

#### Registration Submitted — `/register/submitted` (`62:37`)
- **Layout:** confirmation card: check icon, “Registration received”, status pill “Pending
  verification”, explanatory copy that the platform administrator must verify the company
  before login, button “Back to log in”.
- **Data:** none (static).
- **Notes:** the public API cannot report verification status to an anonymous visitor, so this
  screen must not poll.

#### Password Changed — `/password-changed` (`62:97`)
- **Layout:** confirmation card, “Password updated”, copy “You can now log in with your new
  password.”, button “Back to log in”.
- **Data:** reached after `POST /api/users/me/password/` succeeds; all refresh tokens are
  revoked, so local tokens are cleared before navigation.

#### Browse Offers (guest) — `/offers` (`24:18`)
- **Layout:** public header; title “Available Internship Opportunities”; search input; location
  filter; offer cards in a responsive 2–3 column grid. Card shows title, company, location,
  capacity, deadline, short description and “Log in to apply”.
- **Data:** `GET /api/offers/?search=&location=&ordering=-deadline&page=`; company names are
  resolved per `company_user_id` via `GET /api/companies/{company_user_id}/profile/`.
- **Δ** The “All Places ▾” filter becomes a **location** filter — the API has no capacity
  filter. Deadline is rendered `dd/mm/yyyy`.
- **Notes:** offers are only visible for verified companies; a missing company profile renders
  the fallback label “Company”.

#### Offer Details (guest) — `/offers/:offerId` (`24:87`)
- **Layout:** back link, title, company • location, Description, Required skills, Dates and
  places, Application deadline, Contact, primary “Log in to apply”.
- **Data:** `GET /api/offers/{id}/` + public company profile.
- **Δ Sections removed/changed:** offers carry no start/end dates, no field/specialty, and the
  public company profile exposes no email or phone. Show deadline + capacity instead of
  “Start/End”; map `requirements` to “Required skills”; replace the contact block with company
  address and website (when present).

### 3.2 Student

#### Dashboard — `/app/student` (`25:2`)
- **Layout:** “Welcome back, {first name}”; four stat cards (Active Applications, Awaiting My
  Decision, Current Internship, Unread Notifications); “My Applications” table (Offer, Company,
  Applied on, Status); “Quick Actions” row (Browse offers / View my applications / Submit final
  work).
- **Data:** `GET /api/applications/` (own), `GET /api/internships/?mine=true`,
  `GET /api/notifications/unread-count/`; offer titles and company names resolved by id.
- **Counts:** Active = `SUBMITTED | COMPANY_ACCEPTED | UNIVERSITY_VALIDATED`; Awaiting my
  decision = `UNIVERSITY_VALIDATED`; Current internship = `confirmed | in_progress`.
- **Δ** The top-bar search filters only the applications table on this page.

#### Browse Offers — `/app/student/offers` (`25:180`)
- **Layout:** title + subtitle, search, location filter, offer cards with “View & apply”.
- **Data:** as guest browse, authenticated.
- **Notes:** clicking a card opens the student offer detail, where applying happens.

#### Offer Details — `/app/student/offers/:offerId` (`25:375`)
- **Layout:** back link to Browse Offers, title, company • location, Description, Required
  skills, Dates and places, Application deadline, Company contact, primary “Submit
  application”.
- **Data:** offer + public company profile; also `GET /api/applications/?offer_id=` to detect an
  existing application.
- **Δ** No start/end dates or specialty on offers; no company email/phone. Apply needs a modal
  (**addition**) collecting `start_date` and `end_date`, which `POST /api/applications/`
  requires; prefill with today + 30 days and today + 120 days. Disable the CTA when the
  deadline has passed, the offer is not published, or an application already exists.
- **Errors:** surface `offer_not_available`, duplicate application, and validation messages
  inline.

#### My Applications — `/app/student/applications` (`25:524`)
- **Layout:** title + subtitle (“accept or decline only after university validation”), filter by
  status, table (Offer, Company, Applied on, Status, Action → “View”).
- **Data:** `GET /api/applications/?status=&limit=&offset=`; resolve offer titles and company
  names.
- **Δ** Add a withdraw action on the detail screen (API supports it; the frame omits it).

#### Application Detail — `/app/student/applications/:applicationId` (`25:704`, `25:858`, `25:1004`)
- **Layout:** header “{Offer} at {Company}”, current status pill, “Status history” timeline,
  then a state-specific decision block.
- **Data:** `GET /api/applications/{id}/` + `GET /api/applications/{id}/history/`; offer and
  company resolved by id.
- **States designed:** *Awaiting student decision* → “Accept internship” / “Decline”;
  *Pending university validation* → disabled block “Available after university validation”;
  *Rejected by company* → shows `company_reason`, “This application is closed”.
- **Δ** The remaining statuses reuse the same layout: `COMPANY_REJECTED` shows
  `company_reason`; `UNIVERSITY_REJECTED` shows `university_reason`; `CONFIRMED` shows the
  confirmation and a link to My Internship; `STUDENT_DECLINED` and `WITHDRAWN` show the closed
  state with the stored reason. Add a secondary “Withdraw application” action (optional
  reason) while the status is `SUBMITTED`, `COMPANY_ACCEPTED`, `UNIVERSITY_VALIDATED` or
  `STUDENT_ACCEPTED`.
- **Actions:** `POST /api/applications/{id}/student-decision/` with
  `{decision: "ACCEPT" | "DECLINE"}`; `POST /api/applications/{id}/withdraw/`.

#### My Internship — `/app/student/internship` (`25:1151`)
- **Layout:** internship title, company • location • period, status pill, lifecycle stepper
  (Confirmed → In progress → Completed), supervisor card (name, email, phone), company contact,
  “Request cancellation” panel with required reason textarea and “Submit request”.
- **Data:** `GET /api/internships/?mine=true`, `GET /api/internships/{id}/`,
  `GET /api/internships/{id}/cancellation-requests/`.
- **Δ** Supervisor name/email/phone and company contact details are not exposed by any user
  endpoint; names come from the demo directory (§7), contact lines render “Not provided” when
  unavailable. If a cancellation request already exists, show its status instead of the form.
- **Actions:** `POST /api/internships/{id}/cancellation-requests/` `{reason}` (1–500 chars).

#### Final Submission — `/app/student/internship/submission` (`25:1313`)
- **Layout:** title + 10 MB note, dropzone, submitted-files list (name, size, status), supervisor
  feedback card with rejection reason, primary “Submit final work”.
- **Data:** `GET /api/internships/{id}/submissions/`,
  `GET /api/internships/{id}/submissions/{submissionId}/download/`.
- **Δ** The API accepts **only a file** in the multipart body; repository link and comment are
  removed. A new version is allowed only when no version exists or the latest was rejected;
  surface `submission_already_pending` / `submission_already_approved` as inline errors.
- **Validation:** `.pdf .docx .pptx .jpg .jpeg .png .csv`, ≤ 10 MB. The frame shows a 45 MB file,
  which is invalid — enforce the limit.
- **Actions:** `POST /api/internships/{id}/submissions/` (multipart), download via authenticated
  fetch.

#### Evaluation — `/app/student/internship/evaluation` (`25:1472`)
- **Layout:** status “Completed”, “Final grade 17 / 20”, “Recorded by {supervisor}”, supervisor
  comment, submitted work card with approval date.
- **Data:** `GET /api/internships/{id}/evaluation/`; grade arrives as a decimal string
  (`"17.50"`) → display one or two decimals consistently; comment may be empty.
- **Notes:** the page is reachable only when an evaluation exists; otherwise show an empty
  state (“Your evaluation is visible once your supervisor records it”).

#### Notifications — `/app/student/notifications` (`25:1617`)
- **Layout:** page title + subtitle “Opening a notification marks only that notification as
  read.”; list of rows: title, message, unread/read label, relative time; unread rows tinted.
- **Data:** `GET /api/notifications/?page=`; `PATCH /api/notifications/{id}/read/` on open.
- **Behaviour:** clicking a row marks it read and deep-links via `related_object_type` /
  `related_object_id` when the target is a known page.

#### Profile — `/app/student/profile` (`25:1778`)
- **Layout:** Personal information (full name, email, phone, contact preference), Academic
  information (student ID, university, faculty, department, specialty, academic year), “Save
  changes”, “Change password”.
- **Data:** `PATCH /api/users/me/` for name/email; `GET`/`PUT /api/users/me/profile/` for the
  academic fields.
- **Δ** Phone and contact preference have no fields and are removed. “Faculty” is folded into
  “Department” (the API has one department field). “Student ID” maps to `matricule`.
  `PUT` requires all five values (`university`, `department`, `specialty`, `academic_year`,
  `matricule`), so the form loads them first and submits a complete body.
- **Addition:** “Change password” opens a modal (current, new, confirm) →
  `POST /api/users/me/password/`, then navigate to `/password-changed`.
- **Δ UI (user-directed):** each modal password field has an independent eye toggle.
- **Δ UI (user-directed):** the frame's two fixed cards render as one soft panel — an identity
  strip (avatar, name, role/context), hairline-separated sections, and a single action bar at the
  bottom holding Save, Change password and Log out (confirmation modal).

### 3.3 Company

#### Dashboard — `/app/company` (`26:2`)
- **Layout:** welcome heading; stat cards (Active Offers, Total Places, Pending University
  Validation, Awaiting Student Decision); “Recent Applications” table (Student, Offer, Applied
  on, Status).
- **Data:** `GET /api/offers/?mine=true`, `GET /api/applications/`,
  `GET /api/notifications/unread-count/`.
- **Counts:** Active offers = `published`; Total places = sum of capacity on published offers;
  Pending validation = applications in `COMPANY_ACCEPTED`; Awaiting student = applications in
  `UNIVERSITY_VALIDATED`.
- **Δ** Student names come from the demo directory; unknown ids render `Student · 3f2a9c`.

#### Company Profile — `/app/company/profile` (`26:185`)
- **Layout:** Company information (company name, location, description), Contact (contact
  email, phone), Account verification card (status pill + explanatory copy), “Save changes”,
  “Change password”.
- **Data:** `PATCH /api/users/me/` (name/email); `GET`/`PUT /api/users/me/profile/`.
- **Δ** “Legal form” and “Industry” removed — no model fields. `PUT` requires `legal_name`,
  `address`, `contact_person`, `phone`, `website`, `description`; add two small inputs
  (**addition**) for *Contact person* and *Website* so the required body can be sent truthfully.
- **Verification card:** `pending` → “Awaiting verification”, `active` → “Verified by the
  platform administrator”, `rejected` → reason from `rejection_reason`.
- **Δ UI (user-directed):** one soft panel instead of two cards — identity strip with the
  verification pill, a company-information section, a verification note, and the action bar
  (Save, Change password, Log out).

#### My Offers — `/app/company/offers` (`26:350`)
- **Layout:** title + “+ Create offer”; table (Offer, Places, Deadline, Status, Actions).
- **Data:** `GET /api/offers/?mine=true&status=&page=&page_size=`.
- **Actions:** Edit → edit route; Close → `POST /api/offers/{id}/close/`; Publish (drafts) →
  `POST /api/offers/{id}/publish/`; Delete (drafts only) →
  `DELETE /api/offers/{id}/` with confirmation.
- **Δ** The frame shows “2 total • 1 reserved”; the public offer payload has no reserved count,
  so show capacity only (“2 places”). Editing published offers is constrained by the offers
  lifecycle rules — surface `409` messages from the API.

#### Post Internship — `/app/company/offers/new` and `/offers/:offerId/edit` (`26:525`)
- **Layout:** “Post New Internship Offer”, two-column form, primary “Create offer” /
  “Save changes”, secondary “Save as draft”.
- **Fields kept:** internship title, location, description, required skills (→
  `requirements`), application deadline, number of places.
- **Δ Removed:** field/specialty, workplace type, start date, end date, contact email — none
  exist on offers. Deadline is a `datetime-local` input and is displayed as `dd/mm/yyyy`.
- **Behaviour:** create sends `POST /api/offers/` (draft); “Publish” then calls
  `POST /api/offers/{id}/publish/`. Edit uses `PATCH /api/offers/{id}/`.
- **Validation:** title ≤ 200, location ≤ 255, capacity ≥ 1, deadline in the future.

#### Incoming Requests — `/app/company/applications` (`26:697`)
- **Layout:** title + explanation; filter by status; table (Student, Applied for, Applied on,
  Status, Actions) with Accept / Refuse.
- **Data:** `GET /api/applications/?status=&limit=&offset=` (scoped to the company’s offers);
  offer titles from `mine=true` offers; student names from the demo directory.
- **Actions:** Accept → `POST /api/applications/{id}/company-decision/` `{decision: "ACCEPT"}`;
  Refuse → modal with **required** reason
  `{decision: "REJECT", reason}` (reason is shown to the student).
- **Notes:** accepted applications move to “Pending university validation”; the UI refreshes
  after each decision.

#### Cancellations — `/app/company/cancellations` (`26:860`)
- **Layout:** “Submit a cancellation request” card (ongoing internship selector, required
  reason, “Submit to university”), then “Requests you submitted” table (Internship, Requested,
  Status).
- **Data:** `GET /api/internships/?mine=true` for ongoing internships; per internship
  `GET /api/internships/{id}/cancellation-requests/`.
- **Δ** There is no company-wide cancellation list endpoint; the page aggregates per-internship
  requests client-side (bounded to the first 100 internships, one request each, cached).
- **Actions:** `POST /api/internships/{id}/cancellation-requests/` `{reason}`.

#### Notifications — `/app/company/notifications` (`26:1016`)
- Shared notifications page (§3.6). Unread example items: student accepted, university
  rejection, cancellation decision, new application.

### 3.4 University Admin

#### Dashboard — `/app/university` (`28:2`)
- **Layout:** welcome heading; stat cards (Students, Awaiting Validation, Unassigned
  Supervisors, Active Internships); “Applications awaiting university validation” table
  (Student, Offer, Company, Status).
- **Data:** `GET /api/applications/?status=COMPANY_ACCEPTED`, `GET /api/internships/`.
- **Δ** “Total Students 482” is not a single aggregate. Label it “Students with activity” and
  count distinct `student_user_id` across applications and internships. Unassigned
  supervisors = internships `confirmed`/`in_progress` with `supervisor_user_id = null`;
  Active internships = `confirmed` + `in_progress`.

#### Students — `/app/university/students` (`28:184`)
- **Layout:** title + “Manage student accounts and academic information”; search; table
  (Student, Student ID, Applications, Placement, Account status, Action); pager.
- **Data:** `GET /api/admin/users/?role=student&q=&page=` (university-admin token), filtered to
  the admin's university; names and matricule via `GET /api/users/lookup/?ids=...`; application
  count and placement status merged from the existing applications/internships activity query.
- **Δ** “+ Add student” calls `POST /api/admin/users/` with `role: "student"` and the
  university-admin token; the backend fills in the caller's university, so the form has no
  university input. Edit uses `PATCH /api/admin/users/{id}/` for name, email, department,
  specialty, academic year and matricule. Account status stays read-only for university admins.
- **Δ UI (user-directed):** the initial-password field has an eye toggle and `autocomplete="off"`
  so browser autofill cannot move the caret to another account form. The provisioning modal only
  focuses on open, not on every parent re-render.
- **Δ** Student ID (matricule) is visible to university administrators through the directory;
  unknown ids fall back to the short UUID.

#### Supervisors — `/app/university/supervisors` (`28:373`)
- **Layout:** title + “Manage supervisor accounts and their assigned students”; search; table
  (Supervisor, Department, Assigned students, Account status, Action); pager.
- **Data:** `GET /api/admin/users/?role=supervisor&q=&page=` scoped to the admin's university;
  names and department via the live directory; assigned count from internships.
- **Δ** “+ Add supervisor” calls `POST /api/admin/users/` with `role: "supervisor"`; the backend
  fills in the caller's university. Edit uses `PATCH /api/admin/users/{id}/` for name, email and
  department. Account status stays read-only for university admins.
- **Δ UI (user-directed):** the Add-supervisor initial-password field has an eye toggle and
  `autocomplete="off"`; the modal keeps focus in the field the user is typing in on re-render.

#### Applications — `/app/university/applications` (`28:541`)
- **Layout:** title + “Validate or reject applications accepted by companies”; status filter;
  table (Student, Offer, Company, Submitted on, Status, Action → Review).
- **Data:** `GET /api/applications/?status=&limit=&offset=`; resolve offer titles and company
  names; student names from the demo directory.
- **Notes:** default filter `COMPANY_ACCEPTED` highlights the actionable queue.

#### Application Detail — `/app/university/applications/:applicationId` (`28:717`)
- **Layout:** header “Application Detail”, status pill, Student block (name, academic line),
  Offer block (title at company • location, dates, places), Company decision history,
  University decision panel.
- **Data:** application + history; offer detail for title/location.
- **Δ** The student academic line (Engineering • Computer Science • Specialty) is not exposed
  by the applications or identity APIs; show name + short id only, and hide the academic line.
- **Actions:** Validate → `POST /api/applications/{id}/university-decision/`
  `{decision: "ACCEPT"}`; Reject → same endpoint with `{decision: "REJECT", reason}`
  (reason required, sent to student and company).

#### Supervisor Assignment — `/app/university/assignments` (`28:876`)
- **Layout:** title + “Assign a supervisor to each confirmed internship”; table (Student,
  Company, Internship, Confirmed on, Status, Action → “Assign supervisor”).
- **Data:** `GET /api/internships/?status=confirmed` (plus `in_progress` for reassignment);
  offer titles resolved by `offer_id`.
- **Actions:** `POST /api/internships/{id}/assign-supervisor/` `{supervisor_user_id}`; on
  reassignment the API also requires a `reason`.
- **Δ** The supervisor picker lists the live, university-scoped supervisor roster from
  `GET /api/admin/users/?role=supervisor`. The custom-UUID input remains only as a fallback for
  legacy assigned ids that are no longer in the roster. Reassignments prompt for a reason.
- **Δ** This screen is reached from the Internships table row action (`?internship={id}` opens
  that placement's modal once, then clears the param); it has no sidebar entry.

#### Internships — `/app/university/internships` (`28:1043`)
- **Layout:** title + “All internships and their lifecycle status”; status filter; table
  (Student, Company, Internship, Period, Status, Supervisor).
- **Data:** `GET /api/internships/?status=&limit=&offset=`; offer titles and names resolved as
  above.
- **Notes:** supervisor column shows “Unassigned” when null; period rendered `dd/mm/yyyy →
  dd/mm/yyyy`.
- **Δ** Live rows (`confirmed` / `in_progress`) carry an “Assign supervisor” / “Reassign
  supervisor” action linking to `/app/university/assignments?internship={id}`; other statuses show
  a dash. The assignment screen opens that row's modal once and then removes the query param.

#### Cancellation Requests — `/app/university/cancellations` (`28:1215`)
- **Layout:** title + explanation; table (Internship, Requested by, On, Status); “Request
  details” panel with the reason and Approve / Reject actions.
- **Data:** per-internship `GET /api/internships/{id}/cancellation-requests/` aggregated
  client-side (no global endpoint).
- **Actions:** `POST .../cancellation-requests/{requestId}/approve/`;
  `.../reject/` with **required** reason.
- **Δ** Aggregation is bounded to the first 100 internships; a “Load more” control extends it.

#### University Profile — `/app/university/profile` (`28:1555`)
- **Layout:** University information (name, email, phone, address), Faculties and departments,
  Account settings (change password, security settings).
- **Data:** `PATCH /api/users/me/` for name/email; change password via modal.
- **Δ** `university_admin` has **no role profile** in Identity, so university name/address/
  phone and the faculty/department reference lists have no storage or endpoint. Keep the card
  headings but render name/email (account) only, plus a read-only note that reference data is
  managed by the platform administrator. Remove “Security settings” (nothing to configure).
- **Δ UI (user-directed):** one soft panel — identity strip, university-information section,
  reference-data note, and the action bar (Save, Change password, Log out).

#### Notifications — `/app/university/notifications` (`28:1719`)
- Shared notifications page.

### 3.5 Supervisor

#### Dashboard — `/app/supervisor` (`27:2`)
- **Layout:** welcome heading; stat cards (My Students, Active Internships, Pending Reviews,
  Evaluations to Complete); “My Assigned Students” table (Student, Company, Position, Status).
- **Data:** `GET /api/internships/?mine=true`; for each internship
  `GET /api/internships/{id}/submissions/` and `/evaluation/`.
- **Counts:** students = distinct ids; active = `confirmed`/`in_progress`; pending reviews =
  latest submission `SUBMITTED`; evaluations to complete = approved submission without an
  evaluation.
- **Δ** These counts need per-internship calls; cap at 50 internships per load and cache
  aggressively.

#### My Students — `/app/supervisor/students` (`27:186`)
- **Layout:** title + “Only students assigned to you are shown.”; table (Student, Student ID,
  Company, Status, Action → View).
- **Data:** internships `mine=true`; names from the demo directory.
- **Δ** Student ID is not readable; use the directory value in demo mode, otherwise hide the
  column.

#### Student Profile — `/app/supervisor/students/:internshipId` (`27:357`)
- **Layout:** header with student name, “Assigned student • {offer} at {company}”, back link;
  tabs: Overview, Internship, Files, Reports, Evaluation, History.
- **Data:** internship detail, `history`, `submissions`, `evaluation`; offer/company resolved
  by id.
- **Δ** Student academic information (university, faculty, department) is not exposed; show
  name/email/phone from the directory only. “Files” and “Reports” both map to submission
  versions — merge into one **Submissions** tab to avoid duplicate tables. Evaluation tab is
  hidden until an evaluation exists.

#### Internship Progress — `/app/supervisor/internships/:internshipId` (`27:534`)
- **Layout:** offer title, company • period, status pill, lifecycle stepper, Student contact,
  Company contact, Related files.
- **Data:** internship detail + submissions.
- **Δ** “Related files” (agreement, monthly reports) does not exist in the API — replace with
  the submission versions list, or hide the card when empty.

#### Final Review & Evaluation — `/app/supervisor/reviews/:internshipId` (`27:689`)
- **Layout:** header with offer • company • student; “Submitted work” file list; review
  decision panel (Approve submission / Request resubmission with required reason); evaluation
  panel (score out of 20, optional comment, “Record evaluation”) with the note that the
  internship is marked Completed afterwards.
- **Data:** submissions + download; evaluation.
- **Actions:** `POST .../submissions/{submissionId}/approve/`;
  `.../reject/` `{reason}` (required); `POST /api/internships/{id}/evaluation/`
  `{grade, comment}` — enabled only after a submission is approved.
- **Validation:** grade 0–20, up to two decimals; serialised as a string (`"17.50"`).
- **Δ** The frame shows “Under review” as a status; the API has no such state — derive it from
  the latest submission (`SUBMITTED` = awaiting review).

#### Notifications — `/app/supervisor/notifications` (`27:856`)
- Shared notifications page.

#### Profile — `/app/supervisor/profile` (`27:1013`)
- **Layout:** Personal information (full name, email, phone, department, faculty), “Save
  changes”, “Change password”, Assignment summary (assigned students, active internships,
  pending reviews, evaluations recorded).
- **Data:** `PATCH /api/users/me/`; `GET`/`PUT /api/users/me/profile/` (`department`, `grade`);
  `GET /api/internships/?mine=true` for the summary.
- **Δ** Phone and faculty have no fields and are removed. `Grade` is required by
  `SupervisorProfileUpdate`, so it is submitted from the loaded profile but is not editable here.
  Summary counts are client-side.
- **Δ UI (user-directed):** one soft panel — identity strip, personal-information section,
  assignment-summary tiles, and the action bar (Save, Change password, Log out).

### 3.6 Platform Admin

#### Dashboard — `/app/platform` (`24:112`)
- **Layout:** welcome heading; stat cards (Pending Verifications, Active Companies, University
  Accounts) plus a STAGELINK brand card; “Companies awaiting verification” table (Company,
  Location, Legal name, Status).
- **Data:** `GET /api/admin/companies/?status=pending|active&page=`,
  `GET /api/admin/users/?role=university_admin&page=` — all counts are real here.
- **Δ** “Location” comes from the company profile `address`, which is empty for companies that
  registered after the form was trimmed; show “Not provided”. `AdminCompanySummary` has no
  registration date, so the “Registered” column is replaced by “Legal name” (`legal_name`).
- **Δ UI (user-directed):** platform admins must not see students, so the Student Accounts card
  and its `?role=student` request are removed. The fourth slot holds the STAGELINK mark and
  wordmark instead of being left empty.

#### Companies — `/app/platform/companies` (addition, no frame)
- **Layout:** title + “Every company account on the platform, with its verification status.”;
  table (Company, Contact email, Verification pill, Account active/inactive) with pagination.
- **Data:** `GET /api/admin/users/?role=company&page=` — the only endpoint that lists companies
  of every status. `AdminCompanySummary` requires `status`, so the verification endpoint cannot
  back this screen.
- **Δ** Added because the “Active Companies” stat card pointed at the status-scoped verification
  queue; the card now opens this directory.

#### Company Verification — `/app/platform/verification` (`24:285`)
- **Layout:** title + “Companies stay inactive until manually verified and activated.”; filter
  by status; table (Company, Location, Status); “Company details” panel (Company, Contact
  email, Phone, Location, Registration) with “Verify & activate” and “Keep inactive” (reject).
- **Data:** `GET /api/admin/companies/?status=&page=`.
- **Actions:** `POST /api/admin/companies/{company_user_id}/verify/`;
  `POST /api/admin/companies/{company_user_id}/reject/` with required reason.
- **Δ** Phone/location come from the company profile and are empty for accounts created with
  the trimmed registration form — show “Not provided”. Remove the “Registration: submitted
  during account creation” line.

#### Create Accounts — `/app/platform/accounts/new` (`24:447`)
- **Layout:** three cards: “University account” (university name, create), “Company account”
  (company name, email, create) with the note that companies stay inactive until verified, and
  “Supervisor account” (name, email, create).
- **Data:** `POST /api/admin/users/` with `{name, email, role, password}` or
  `{generate_password: true}`. Allowed roles: `company`, `university_admin`, `supervisor`.
- **Δ** There are no address or university-specific fields; “University name” becomes `name`.
  The company card's phone and location inputs are dropped (no fields on `AdminUserCreateRequest`);
  those are filled in by the company profile after activation. A **Supervisor account** card is
  added (the only way to provision supervisors). Each card collects an initial password or
  `generate_password: true`; when generated, show it once in a copyable panel.
- **Δ UI (user-directed):** initial-password inputs have an eye toggle, a unique id and
  `autocomplete="off"` to stop browser autofill jumping between the two account cards.

#### Profile — `/app/platform/profile` (`24:605`)
- **Layout:** Account information (full name, email, role), “Save changes”, “Change password”.
- **Data:** `PATCH /api/users/me/`; change password via modal.
- **Δ** `platform_admin` has no role profile; only account fields exist.
- **Δ UI (user-directed):** one soft panel — identity strip, account-information section, and
  the action bar (Save, Change password, Log out).

### 3.7 Shared Notifications page

Used by all five roles at `/app/{role}/notifications` (`25:1617`, `26:1016`, `27:856`,
`28:1719`).

- **Content:** title, subtitle “Opening a notification marks only that notification as read.”,
  paginated list of rows. Each row: title, message, `Unread`/`Read` label, relative timestamp;
  unread rows use the mint surface.
- **Data:** `GET /api/notifications/?page=` (20 per page),
  `PATCH /api/notifications/{id}/read/`, unread count from
  `GET /api/notifications/unread-count/`.
- **Behaviour:** opening a row marks it read, updates the bell badge, and navigates to the
  related page when `related_object_type` is recognised (`application`, `internship`,
  `submission`, `evaluation`); otherwise it stays on the list.
- **Notes:** no “mark all read” control is designed; the API exists but stays unused in v1.

---

## 4. Status maps

### Application (`applications` service)

| API value | UI label | Tone |
| --- | --- | --- |
| `SUBMITTED` | Submitted | neutral |
| `COMPANY_ACCEPTED` | Pending university validation | warning |
| `UNIVERSITY_VALIDATED` | Awaiting student decision | info |
| `STUDENT_ACCEPTED` | Student accepted | info |
| `CONFIRMED` | Confirmed | success |
| `COMPANY_REJECTED` | Rejected by company | danger |
| `UNIVERSITY_REJECTED` | Rejected by university | danger |
| `STUDENT_DECLINED` | Declined by student | neutral |
| `WITHDRAWN` | Withdrawn | neutral |

Terminal: `CONFIRMED`, `COMPANY_REJECTED`, `UNIVERSITY_REJECTED`, `STUDENT_DECLINED`,
`WITHDRAWN`.

### Offer (`offers` service)

| API value | UI label | Tone |
| --- | --- | --- |
| `draft` | Draft | neutral |
| `published` | Open | success |
| `closed` | Closed | neutral |

### Internship (`internships` service)

| API value | UI label | Tone |
| --- | --- | --- |
| `confirmed` | Confirmed | info |
| `in_progress` | In progress | success |
| `completed` | Completed | success |
| `cancelled` | Cancelled | danger |

### Submission

| API value | UI label | Tone |
| --- | --- | --- |
| `SUBMITTED` | Submitted / Under review | warning |
| `APPROVED` | Approved | success |
| `REJECTED` | Resubmission required | danger |

### Cancellation request

| API value | UI label |
| --- | --- |
| `pending` | Pending approval |
| `approved` | Approved |
| `rejected` | Rejected |

### Company verification

| API value | UI label | Tone |
| --- | --- | --- |
| `pending` | Pending verification | warning |
| `active` | Verified | success |
| `rejected` | Rejected | danger |

### Pagination shapes

| Service | Query params | Response |
| --- | --- | --- |
| identity (users, companies) | `page` | `count`, `next`, `previous`, `results` |
| offers | `page`, `page_size` | `count`, `next`, `previous`, `results` |
| applications | `limit`, `offset` | `results`, `pagination {limit, offset, total}` |
| internships | `limit`, `offset` | `results`, `pagination {limit, offset, total}` |
| notifications | `page` | `count`, `next`, `previous`, `results` |

---

## 5. Features that will **not** be included

| # | Excluded feature | Why | What ships instead |
| --- | --- | --- | --- |
| 1 | Forgot password / verification code / reset password | No Identity endpoints exist | “Forgot password?” link removed from Login |
| 2 | Student self-registration | Product decision; only companies self-register | Students are provisioned (seed/demo) and login only |
| 3 | ~~University admin creating students or supervisors~~ | **No longer excluded:** university admins can provision students/supervisors in their own university | “+ Add student” / “+ Add supervisor” use `POST /api/admin/users/` with the caller's token |
| 4 | Company legal form, registration number, industry | No model fields | Fields removed from Register and Company Profile |
| 5 | Company location/phone at registration | Registration accepts only `email/name/password/role` | Collected later on Company Profile (location, phone) |
| 6 | Offer start/end dates, workplace type, field/specialty, contact email | Not part of the offer model | Offer shows deadline, capacity, location, requirements |
| 7 | Reserved-places count per offer | Not exposed in the public offer payload | “N places” (capacity) only |
| 8 | Global sidebar search | No global search endpoint | Search filters the current page’s list; offers keep real search |
| 9 | Mobile and tablet layouts | Out of project scope | Desktop only, 1280–1920 supported |
| 10 | Dark mode | Not designed | Single light theme |
| 11 | Internationalisation / RTL | English only agreed | Strings centralised for a later move to i18n |
| 12 | Realtime notifications | No websocket/SSE channel | 30 s polling of the unread count |
| 13 | Email/SMS notifications | In-app only in v1 | In-app notifications |
| 14 | Avatar upload | No media endpoint for avatars | Initials circle |
| 15 | Account deactivation UI | Not designed (API exists) | Omitted from the client |
| 16 | Notification preferences | No API | Not shown |
| 17 | Faculty/department reference-data management | No storage in Identity for university admins | Read-only note on the profile page |
| 18 | File preview / in-browser viewer | Download endpoint only | Download to disk |
| 19 | Submission version diffing | Not modelled | Version list with statuses |
| 20 | Audit-log export / printing / PDF reports | Out of scope | On-screen history only |
| 21 | Two-factor auth, session management | No API | Password change only |
| 22 | Student academic transcript import | No API | Manual profile fields |
| 23 | ~~University admin editing student/supervisor profiles~~ | **No longer excluded:** scoped `PATCH /api/admin/users/{id}/` is available | Edit the academic fields of students/supervisors in the admin's university |
| 24 | Company-wide cancellation listing endpoint | API is per-internship | Client-side aggregation with a load-more cap |
| 25 | “Mark all notifications read” control | Not designed (API exists) | Per-notification read only |

---

## 6. Backend-derived limitations and workarounds

These are binding design decisions caused by the fixed API surface.

1. **Names are not copied into service payloads.** Offers, applications and internships still
   return UUIDs only. Company names resolve through the public company profile endpoint.
   Student and supervisor names now resolve through the bearer-authenticated Identity
   directory: `GET /api/users/lookup/?ids=<uuid,...>` (max 100, order preserved, unknown ids
   omitted) and `GET /api/users/{id}/`. Supervisors and companies also receive a student's
   `university`, `department`, `specialty` and `academic_year`; email, phone and `matricule`
   stay private. `/api/internal/users/` remains service-token-only.
   `useUserLabel`/`useDirectoryUser` call the live lookup first. *Legacy demo fallback:*
   `src/demo/directory.json` is still written by `seed_demo` and loaded when
   `VITE_DEMO_DIRECTORY=1` only when the live lookup finds no match.
2. **University admin directory is now available.** `GET /api/admin/users/` and
   `POST /api/admin/users/` accept a university-admin token and are scoped to students and
   supervisors of that admin's university; `PATCH /api/admin/users/{id}/` edits those profiles.
   The Students and Supervisors screens use this scoped roster, merged with application and
   internship activity for the existing counts; creation and editing no longer need a
   platform-admin token.
3. **No aggregate endpoints.** Dashboard figures are computed client-side from list responses;
   keep page sizes small and cache with TanStack Query. Figures that cannot be derived are
   relabelled (“Students with activity”, “Active students”).
4. **No offer detail for start/end dates.** `POST /api/applications/` requires `start_date`
   and `end_date`, which the design never collects — the apply modal is mandatory.
5. **No profile for `university_admin` or `platform_admin`.** Those profile pages are
   account-only (name, email, password). `PUT /api/users/me/profile/` is a full replace, so
   role-profile forms must submit every required field.
6. **Submission metadata is not accepted.** Only the file is posted; the repository link and
   comment fields are dropped, and the 10 MB limit is enforced client-side.
7. **Downloads require the Bearer header.** Use `fetch` with the token and a blob URL; plain
   anchors will 401.
8. **No company-wide cancellation list.** Aggregate per internship, capped, with load-more.
9. **Status vocabularies differ.** Application values are uppercase; offer and internship
   values are lowercase; verification values are `pending/active/rejected`. Never compare
   across services with a single shared string.
10. **Error bodies vary.** Expect DRF `{detail}`, field errors, and the documented
    `{code, message, details}` envelope; render `message`/`detail` first, then field errors.
11. **`docs/api-conventions.md` is stale** (it documents an offset envelope that the services
    do not use). Build against `contracts/` and the shapes in §4.

---

## 7. Demo data requirements

The seed must make every screen look alive on the first login.

- **Accounts:** platform admin, 1 university admin, 3 supervisors, 5 students, 5 companies
  (3 verified — including *ABC Company* and *EURL FARISSIA* — 2 pending, 1 rejected).
- **Offers:** at least 6 — published with capacities 1–3 and deadlines across the next months,
  1 draft, 1 closed, 1 with a near deadline.
- **Applications:** at least one in every status, including two rejections with reasons, one
  confirmed, one withdrawn after confirmation, and two live applications for the same student.
- **Internships:** one `confirmed` unassigned, one `in_progress` with a supervisor, one
  `completed` with an approved submission and a `17.50` evaluation, one `cancelled` with an
  approved request; plus one internship with a pending student cancellation request.
- **Submissions:** one rejected version with a reason followed by an approved version, with
  real PDF/DOCX files under 10 MB.
- **Notifications:** unread and read examples per role, matching the copy in the frames.
- **Directory:** `src/demo/directory.json` covering every seeded user and company id.

Demo password stays `StagelinkDemo!2026`; the account list is documented in `docs/setup.md`.

> **Δ (demo accounts):** §7 says "5 companies" but enumerates 3 verified + 2 pending +
> 1 rejected (= 6). The seed creates **6** companies so the verification screen has two
> pending rows and a rejected example; all other counts match the requirement exactly.
> Ids are `uuid5` values derived from the email local part so the committed directory
> matches every fresh seed. `VITE_DEMO_DIRECTORY=1` gates the legacy fallback only; the live
> directory is authoritative and unknown ids still degrade to `Role · 3f2a9c`.

---

## 8. Non-functional requirements

- **Layout:** 1440×900 primary; verify at 1280 and 1920. Content must not overflow at 1280.
- **Browsers:** current Chrome, Edge, Firefox; Safari 16+.
- **Accessibility:** labelled inputs, visible focus rings, keyboard reachable menus and modals,
  focus trapping in dialogs, `aria-live` for toasts, contrast checked for Sage on Mint.
- **Security:** no secrets or service tokens in the bundle; never call `/api/internal/*`;
  access token stays in memory; refresh token in `localStorage` (documented XSS trade-off);
  log out and clear state on 401 after one refresh attempt.
- **Performance:** parallel dashboard queries; cached company/offer lookups; page size 20;
  no waterfall deeper than two requests; skeletons on first load only.
- **Dates:** all display through one formatter (`dd/mm/yyyy`, `Africa/Algiers`); relative times
  only in notification rows.
- **Error/empty states:** every table and card defines empty, loading and error copy.

---

## 9. Delivery gates

| Gate | Exit criteria |
| --- | --- |
| G1 — Foundation | Scaffold, tokens, shell, routing + guards, API client, auth with rotation, shared components; Login and one live list working |
| G2 — Routes live | All 46 screens render at 1440 with real data or the demo directory; loading/empty/error states present |
| G3 — Workflows | Apply → company decision → university validation → student decision → internship → supervisor → submission → evaluation, plus cancellation and notifications, walked end to end |
| G4 — Deployable | `docker compose up` serves the client on one origin; CI job green; Playwright smoke passes on seeded data |
| G5 — Freeze (25 Nov) | Docs and ADRs 015–017 written; demo script rehearsed twice; no open blocker |

Cut order if behind: micro-polish → secondary screens (Platform Dashboard, Supervisor Profile,
Guest Offer Detail, Company Cancellations read-only) → profile editing becomes read-only →
dashboard cards become plain counts. **Never cut:** login and refresh, browse and apply, the
three decision stages, supervisor assignment, internship start/complete, submission upload,
evaluation, company verification, notification read state.

---

## 10. Assumptions and open points

- The Figma file is the visual reference; where a screen shows data the API cannot supply, the
  **Δ** notes above win.
- Sidebar labels are normalised as listed in §2 even where frames differ.
- The demo directory shim is demo-only and gated by `VITE_DEMO_DIRECTORY`.
- Any future backend addition (password reset, user directory, company legal fields, student
  creation) removes the corresponding deviation without altering the page structure.
