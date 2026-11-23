# STAGELINK Web Client

The official Single Page Application for **STAGELINK** (University Internship Management Platform), connecting students, partner companies, academic supervisors, university administrators, and platform administrators.

Built with **React 18 + Vite + TypeScript (strict mode)** and styled with **Tailwind CSS** using tokens extracted directly from the Figma design system (`STAGLINK`).

---

## Architecture & Technology Stack

- **Framework**: React 18, Vite 6, TypeScript 5 (strict).
- **Styling**: Tailwind CSS with custom design tokens:
  - Background / Mint: `#DAF1DE`
  - Forest 900: `#051F20`
  - Forest 800: `#0B2B26`
  - Surface 700 / 600: `#163832` / `#235347`
  - Accent Sage: `#8EB69B`
  - Canvas: `#F8FFF9`
  - Typography: Inter font family
- **Routing**: React Router v6 with `RequireAuth`, `RequireRole`, and `RequireGuest` guards.
- **State & Data Fetching**: TanStack Query v5 + custom typed API client (`client.ts`).
- **Form Management**: `react-hook-form` with `zod` resolvers.
- **API Typing**: `openapi-typescript` auto-generated from `contracts/*.yaml`.
- **Icons**: `lucide-react`.

---

## Role Coverage (46 Designed Screens)

| Role | Screens Covered | Base Route |
| :--- | :--- | :--- |
| **Guest & Auth** | Login, Company Register, Submitted, Password Changed, Browse Offers, Offer Details | `/login`, `/offers` |
| **Student** | Dashboard, Browse Offers, Offer Details (Apply Modal), My Applications, Application Detail (Decision/Rejection/Withdraw), My Internship (Cancellation), Final Submission (Dropzone <= 10MB), Evaluation, Notifications, Profile | `/app/student` |
| **Company** | Dashboard, Profile (Verification badge), My Offers (CRUD/Publish/Close), Post/Edit Internship, Incoming Requests (Accept/Refuse modal), Cancellations, Notifications | `/app/company` |
| **University Admin** | Dashboard, Students Directory, Supervisors Directory, Applications Queue, Application Detail (Validate/Reject modal), Supervisor Assignment, Internships Lifecycle, Cancellation Requests, University Profile, Notifications | `/app/university` |
| **Supervisor** | Dashboard, My Students, Student Profile (Tabs: Overview, Submissions, Evaluation, History), Internship Progress, Final Review & Evaluation (Scoring 0–20), Supervisor Profile, Notifications | `/app/supervisor` |
| **Platform Admin** | Dashboard, Company Verification (Verify & Activate / Reject), Create Accounts (Password generation), Profile | `/app/platform` |

---

## Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate OpenAPI Types
```bash
npm run codegen
```
Regenerates TypeScript types from `../contracts/*.yaml` into `src/types/api/`.

### 3. Run Development Server
```bash
npm run dev
```
Runs at `http://localhost:3000`. The Vite server automatically proxies `/svc/*` routes to backend microservices running on ports 8001–8005.

### 4. Build for Production
```bash
npm run build
```
Typechecks with `tsc --noEmit` and bundles the production app into `dist/`.

---

## Demo Accounts

When running with the local backend seeded via `python manage.py seed_demo`, all accounts share the password: `StagelinkDemo!2026`.

| Role | Demo Email |
| :--- | :--- |
| **Platform Administrator** | `admin@stagelink.demo` |
| **University Administrator** | `university@stagelink.demo` |
| **Faculty Supervisor** | `supervisor@stagelink.demo` |
| **Student** | `student@stagelink.demo` |
| **Company Partner** | `company@stagelink.demo` |
