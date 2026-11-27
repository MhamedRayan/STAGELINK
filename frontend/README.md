# Frontend

The STAGELINK web client is a React 18 + TypeScript single-page application
built with Vite, Tailwind CSS 3.4, React Router 6 and TanStack Query 5.

## Local development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:3000` and proxies `/svc/<service>/`
to the Compose services on ports 8001–8005. Start the backend stack from the
repository root first (see [`../docs/setup.md`](../docs/setup.md)).

Authentication uses `Authorization: Bearer <access>`; the rotated refresh
token is kept in local storage. The client never calls `/api/internal/` routes.

## API types

`src/api/schema/*.d.ts` is generated from `contracts/*.yaml`. Regenerate it
after a contract change:

```bash
npm run gen:api
```

Do not edit the generated files by hand.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test:e2e` runs the Playwright smoke tests against an already-started,
seeded stack on `http://localhost:3000`. Set `E2E_BASE_URL` to use another
origin.
