# STAGELINK: Project Overview

> University internship management platform: M'hamed Bougara University, Boumerdès, Faculty of Sciences, Computer Science Dept.
> Academic year 2026–2027 · Supervisor: Dr. Yahiaten · Specs version 1.2 (14/10/2026)
> Team: AITZEKAGH M'hamed, BOUDRA Ismail, ETTOUIL Abdelhak, ZERZOUR Islam, BRAHMIA Islam

This file summarizes both *cahiers des charges* (functional + technical) so any team member can understand the whole system. Source documents win over this file if they disagree.

---

## 1. What we are building

A single web platform that replaces email/paper/spreadsheets for the university internship process: companies publish offers, students apply, the university validates, a supervisor is assigned, the student submits a final report and gets graded out of 20. **One university only** in v1.

## 2. Actors

| Actor | Main abilities |
|---|---|
| Guest | Browse public pages and offers only |
| Student | Profile, browse offers, apply, track status, accept/decline **only after university validation**, request cancellation, submit final work, view supervisor/feedback/grade/notifications |
| Company | Profile, publish/edit/close **own** offers, view applications to own offers, accept/reject (reason mandatory on reject), view university decisions, initiate cancellation. Account inactive until platform admin verifies it |
| University administration | Manage student/supervisor accounts, **validate/reject company-accepted applications** (reason mandatory on reject), assign supervisor to confirmed internships, approve/reject cancellation requests |
| Supervisor | See only assigned students/internships, review submissions (approve / reject with reason), grade out of 20 + optional comment |
| Platform administrator | Create university & company accounts, manually verify/activate companies. **No implicit validation authority** |

## 3. Tech stack (fixed)

- **Frontend:** React (+ Next.js)
- **Backend:** Django + Django REST Framework, one project per service
- **DB:** PostgreSQL, one server, **one database per service**, no cross-service joins or FKs
- **Auth:** JWT issued by Identity & Profiles (access 15 min, refresh 7 days). Every service validates the token **locally** and enforces permissions itself
- **Communication:** synchronous REST only, no message broker in v1
- **Deploy:** Docker Compose on one Linux server, HTTPS via reverse proxy, persistent volumes for DBs and uploads
- **Files:** max 10 MB; PDF, DOCX, PPTX, JPG/JPEG, PNG, CSV
- **Tooling:** Git (GitHub/GitLab), feature branches + reviewed merges, README per project, secrets only in env vars

## 4. Services (per technical spec)

| Service | Owns |
|---|---|
| **Identity & Profiles** | Users, roles, JWT issue/refresh, student/company/supervisor profiles, university/department/specialty data, company verification |
| **Offers & Applications** | Offers, applications, status history, company decisions, university validation, student confirm/decline, provisional place reservations, automatic Withdrawn |
| **Internship Management** | Internships + lifecycle, cancellation requests, supervisor assignment, final submissions + file metadata, reviews, evaluations, audit history, **notifications** (per the tech spec) |

> ⚠️ **Important discrepancy:** the technical spec lists **3 services** and puts notifications inside Internship Management, but the team guide splits the work among **5 members**, giving Member 1 a standalone **Notifications & Communication** service. See `service.md` §9, where this must be confirmed with the team/supervisor. Our design keeps the API contract compatible either way.

## 5. Core workflow

1. Platform admin creates/activates company account.
2. Company publishes offer with N places.
3. Student applies → **Submitted**.
4. Company accepts → **Pending university validation** + provisional place reservation (or rejects with reason → terminal).
5. University validates → **Awaiting student decision**, or rejects with reason → terminal, reservation released, student + company notified.
6. Student accepts → Offers & Applications asks Internship Management to create the internship (application ID = idempotency key) → only then **Confirmed**, reservation becomes occupied place. Or student declines → **Declined by student**, reservation released.
7. On confirmation, the student's other open applications → **Withdrawn**, reservations released.
8. University admin assigns a supervisor.
9. Internship: **Confirmed → In progress** (auto on start date) **→ Completed** (after supervisor evaluation of an approved submission). **Cancelled** only via cancellation request approved by university admin.
10. Final submission: Submitted → Approved, or Rejected (with reason) → resubmit.

## 6. Status reference

- **Application:** Submitted, Rejected by company, Pending university validation, Rejected by university, Awaiting student decision, Confirmed, Declined by student, Withdrawn. Terminal: all except Submitted / Pending / Awaiting.
- **Internship:** Confirmed → In progress → Completed; Cancelled (via request only).
- **Final submission:** Submitted → Approved | Rejected → Submitted (resubmission).

## 7. Cross-cutting rules (every service)

- Separate Django project + PostgreSQL DB per service.
- Talk to other services **only** through documented REST APIs.
- Other services' IDs are stored as **plain fields**, never foreign keys.
- Validate JWTs locally; enforce role **and** object permissions server-side.
- Internal endpoints must authenticate trusted services.
- Secrets in environment variables; write migrations and tests.
- Cross-service operations must be **idempotent, retryable, reconcilable**; never duplicate internships, reservation releases or notifications.

### 7.1 Python naming conventions (mandatory for all members)

These rules **must be followed** in every service.

| Element | Convention | Example |
|---|---|---|
| Variables | `snake_case` | `company_user_id` |
| Functions and methods | `snake_case` | `create_offer()` |
| Classes | `PascalCase` | `OfferSerializer` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_CAPACITY` |
| Python files / modules | `snake_case.py` | `offer_management.py` |
| Packages / directories | `snake_case` | `offers_applications` |
| Private methods / variables | prefix with `_` | `_validate_offer()` |

## 8. Notification requirements (project-wide, FR-13)

- In-app only (no email/SMS in v1); each notification read **individually** when opened.
- Events: company accepts → notify university admin · university validates → notify student · university rejects → notify student **and** company · student final decision → notify company · automatic withdrawals → notify relevant parties · cancellation request decisions → notify other parties.
- Requests must be **retryable and deduplicated** using a stable event identifier.
- Opening one notification changes only that notification.

## 9. Non-functional targets

Usability per role · role-restricted private data · reliable storage + backup procedure · dashboard/search API < 2 s on test data (excluding uploads) · modern desktop/mobile browsers · one university only.

## 10. Milestones

| # | Technical objective | Target |
|---|---|---|
| 1 | Design: stack, boundaries, data ownership, API approach | 14 Oct 2026 |
| 2 | MVP: core workflows + initial tests | **21 Oct 2026** |
| 3 | Technical validation: finalized code, tests, fixes, setup docs | 11 Nov 2026 |
| 4 | Delivery: deployable app, migrations, docs, demo | 28 Nov 2026 |
| - | Final demo / oral presentation | 29 Nov 2026 |

## 11. Required deliverables

React frontend · Django/DRF services · PostgreSQL models + migrations (ownership documented) · API docs + architecture description · README.md · automated tests + notes · deployment instructions + env examples (no secrets) · technical documentation + demo.

## 12. Team assignment

| Member | Service |
|---|---|
| **Member 1 (me)** | **Notifications & Communication**, see `service.md` |
| Members 2–5 | Other services (to be filled in: Identity & Profiles, Offers & Applications, Internship Management, …) |

## 13. Integration points for my service

Services that will call my internal endpoint (to be confirmed with each member):

- **Offers & Applications** → company accepted, university validated, university rejected, student accept/decline, automatic withdrawals.
- **Internship Management** → internship created, cancellation request/decision, submission review, evaluation, supervisor assigned.
- **Identity & Profiles** → needed to resolve *who* the recipients are (e.g. all university-admin user IDs); also the source of the JWT signing key/public key.
