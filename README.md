# Study Room Management System

A maintained, full-stack application to manage study room seats, students, payments, and expenses. This README has been updated to reflect the current developer and deployment flow used by the repository.

## At a glance

- Frontend: React + Vite + Material UI (live development with `vite`, E2E tests with Playwright)
- Backend: Node.js + Express + PostgreSQL (pg) with environment-based DB switching and secure SSL handling
- Database: PostgreSQL (Neon or any managed Postgres)

Project layout (top-level):

```
frontend/   # React app (vite)
backend/    # Express API, DB config, scripts
db_schema_postgres.sql
README.md
```

## What changed (short)

- README updated to match current npm scripts and DB flow.
- Documented DB_MODE and DEV_DATABASE_URL behavior used by the backend.
- Added clearer local dev, build, and deployment steps.

Checklist (requirements from your request)
- Update README to reflect latest flow: Done
- Make README more descriptive and actionable: Done

## Developer quick start

Prerequisites
- Node.js 18+
- PostgreSQL (Neon recommended for cloud)
- Git

1) Clone

```powershell
git clone <your-repo-url>
cd study-room-management-app
```

2) Backend

```powershell
cd backend
npm install
# copy example env (if present) and set values
copy .env.example .env  # PowerShell equivalent of cp
# Edit .env: set DATABASE_URL, JWT_SECRET, CORS_ORIGIN, etc.

# Start in fast development mode (auto-restart):
npm run dev

# Start using the "dev" database variant (uses DEV_DATABASE_URL or DATABASE_URL_DEV):
npm run devdb

# Start normally (production-like):
npm start
```

Notes about backend scripts
- `npm run dev` runs `nodemon server.js` for local dev.
- `npm run devdb` (alias) starts the server with DB_MODE=dev to prefer `DEV_DATABASE_URL` / `DATABASE_URL_DEV`.
- `npm start` runs `node server.js` (recommended for production deployments).
- A `postinstall` step runs `node ./scripts/build-and-copy.js` — this script copies frontend build files into the backend public assets when installing on servers.

3) Frontend

```powershell
cd frontend
npm install
npm run dev    # starts vite development server

# Build for production
npm run build
```

The frontend expects the backend API base to be provided via `VITE_API_URL` in production builds.

## Database setup

1. Create a Postgres database (Neon recommended).
2. Apply schema:

```powershell
# from repo root
psql <CONNECTION_STRING> -f db_schema_postgres.sql
```

3. Environment variables
- `DATABASE_URL` — production database connection string
- `DEV_DATABASE_URL` or `DATABASE_URL_DEV` — optional development DB when using `DB_MODE=dev` (used by `npm run devdb`)
- `DB_MODE` — set to `dev` to force the dev DB selection (alternatively set `USE_DEV_DB=1`)
- `DB_SSL_DISABLE` — set to `true` / `1` to disable SSL handling (default attempts to enable SSL for managed hosts)
- `JWT_SECRET` — secret for signing JWTs
- `CORS_ORIGIN` — allowed origin for frontend when using CORS

Backend database selection behavior (summary)
- If `DB_MODE=dev` (or `USE_DEV_DB` truthy), the backend prefers `DEV_DATABASE_URL` -> `DATABASE_URL_DEV` -> fallback to `DATABASE_URL`.
- SSL is automatically enabled for common managed DB hosts unless `DB_SSL_DISABLE` is set.

## API overview

The backend exposes REST endpoints under `/api`:

- Authentication:    `/api/auth/*`
- Seats management:  `/api/seats/*`
- Students:          `/api/students/*`
- Payments:          `/api/payments/*`
- Expenses:          `/api/expenses/*`

## Pages & functionality

This repository ships a single-page React frontend. Below is a concise list of the main pages (files under `frontend/src/pages`) and what each page does so the README is a complete reference for developers.

- Seat Chart (`frontend/src/pages/SeatChartReport.jsx`)
	- Interactive seat grid with color-coded seats (occupied, vacant, expiring, removed/maintenance).
	- Search seats by number or student name, auto-refresh option, quick stats (occupied/available/expiring/occupancy rate).
	- Admin Mode: toggleable controls to remove, put under maintenance, restore or add seats (FAB to add seats).
	- Seat details dialog: shows student info, membership expiry, last payment and quick actions (View Profile).
	- Uses `/api/seats` and `/api/students` / `getSeatChartData()`.

- Students (`frontend/src/pages/Students.jsx`)
	- Main students and seats management screen with tabs: Seats, Active Students, Deactivated Students.
	- Add / Edit / View student dialogs with Aadhaar conflict handling.
	- Assign, change or unassign seats; reactivate / deactivate students with refund handling.
	- Payment dialog reuse for adding payments and computing membership extension days.
	- Rich filters (status, gender, membership type, seat number, name, contact) and stat-driven quick filters.
	- Calls endpoints under `/api/students`, `/api/seats`, `/api/payments` and `/api/admin/fees-config`.

- Student Profile (`frontend/src/pages/StudentProfile.jsx`)
	- Dedicated profile view for a student/seat (shows personal details, membership dates, total paid and payment history).
	- Add payment dialog for a single student. Intended to support full profile + payments UX.

- Payments (`frontend/src/pages/Payments.jsx`)
	- Payments list view (desktop table + mobile card view), server-side pagination, filters (seat, name, id, date range).
	- Add / refund payments UI with membership extension calculation based on fee config.
	- Admin-only deletion flow includes membership impact calculation and confirmation.
	- Uses `/api/payments` and `/api/students` for student lookups and fee-config calls.

- Expenses (`frontend/src/pages/Expenses.jsx`)
	- Expenses dashboard with summary cards (income/expenses/net), filters, search, sort and list (table or card view).
	- Add expense dialog, export expenses to CSV, monthly trends and breakdown by category.
	- Uses `/api/expenses` and `/api/payments` for income calculations.

- Admin Panel (`frontend/src/pages/AdminPanel.jsx`)
	- Central admin area (tabs include Import/Export, Users, Seats, Fees, System and Activity Logs for admins).
	- Import Excel (.xlsx) with a two-sheet format (Library Members, Renewals) and progress reporting.
	- Backup/Restore (JSON), Full report (XLSX), user management (create/edit/delete), session invalidation (logout user).
	- Seats management (single or numeric range add, edit, delete with occupant checks), fee configuration (monthly fees per membership type), clean-database action.
	- Many admin APIs under `/api/admin/*` are used: fees-config, import-excel, backup/restore, full-report, clean-database.

- Column Viewer (`frontend/src/pages/ColumnViewer.jsx`)
	- Helper page to display expected sheet column mapping (tries API first, falls back to an inferred column list).
	- Useful when preparing Excel imports.

- Activity Log (`frontend/src/pages/ActivityLog.jsx`)
	- Admin-only activity stream with pagination and user filter. Shows system audit/events retrieved from `/api/admin/activity`.

Shared/Supporting UI and behavior
- Authentication: JWT tokens stored in localStorage and sent in Authorization headers by the frontend.
- Role-based features: many actions (deleting payments, admin panel tabs, import/backup/clean) are gated to admin users.
- Timezone handling: date calculations are IST-aware (Asia/Kolkata) across pages (membership expiry, payment dates).

If you want the README to include exact screenshots, sample API request/response examples for each page, or a table mapping page -> backend endpoints, tell me which format you prefer and I will add it.

Contract (quick)
- Inputs: HTTP JSON requests authenticated with JWT (Authorization: Bearer <token>) where required.
- Outputs: JSON responses, standard 2xx / 4xx / 5xx status codes.
- Error modes: validation errors (400), auth (401/403), server/db errors (500).

Edge cases to keep in mind
- Missing or malformed DATABASE_URL
- Running dev against production DB without `DB_MODE=dev`
- Large file uploads (Mul ter limits are configured by multer middleware)

## Running tests

- Frontend E2E tests (Playwright) live in `tests/` and can be run from the `frontend` folder:

```powershell
cd frontend
npm run test:e2e
```

## Deployment notes

Backend (Render or similar)
- Root/Build directory: `/backend`
- Build command: `npm install` (Render runs this automatically)
- Start command: `npm start`
- Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`.

Frontend (Netlify / Vercel)
- Build command: `npm run build` (from `frontend`)
- Publish directory: `frontend/dist`
- Ensure `VITE_API_URL` is set to your backend API URL (e.g., `https://your-backend.onrender.com/api`)

Database (Neon)
- Create DB, copy connection string into backend env, run the schema from `db_schema_postgres.sql`.

## Troubleshooting

- "No database connection string provided" on startup: ensure `DATABASE_URL` or `DEV_DATABASE_URL` is set.
- SSL related DB errors: set `DB_SSL_DISABLE=true` temporarily to identify TLS issues.
- Postinstall frontend copying: if the backend `public/` folder doesn't contain frontend assets after `npm install`, run the `build-and-copy.js` script manually or ensure front-end build artifacts are present.

## Contributing

1. Fork
2. Create a branch
3. Make changes and add tests
4. Run frontend E2E locally if applicable
5. Open a PR

## License

MIT

---

If you'd like, I can also:
- add a short `docs/DEVELOPMENT.md` with the commands split for Windows/Unix;
- or create a `Makefile` / npm top-level scripts to orchestrate starting both frontend and backend concurrently for dev.

## Architecture diagram & screenshots

Below are inline thumbnails (SVG placeholders) for the architecture diagram and two page screenshots. These are embedded directly so the README shows visual hints without requiring separate image files. Replace them with real PNG/JPEG screenshots later if you prefer raster images.

Architecture diagram (inline SVG)

<div>
<!-- architecture.svg content (inline) -->
<?xml version="1.0" encoding="UTF-8"?>
<svg width="900" height="420" viewBox="0 0 900 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram">
	<style>
		.box { fill:#ffffff; stroke:#2c3e50; stroke-width:2; rx:8; }
		.title { font: bold 16px sans-serif; fill:#2c3e50 }
		.label { font: 13px sans-serif; fill:#34495e }
		.arrow { stroke:#34495e; stroke-width:2; marker-end:url(#arrowhead); }
		.cloud { fill:#f0f6ff; stroke:#3b82f6; stroke-width:2; rx:10 }
	</style>
	<defs>
		<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
			<polygon points="0 0, 10 3.5, 0 7" fill="#34495e" />
		</marker>
	</defs>
	<rect x="40" y="40" width="220" height="110" class="box"/>
	<text x="60" y="68" class="title">Frontend</text>
	<text x="60" y="92" class="label">React + Vite (UI)</text>
	<text x="60" y="112" class="label">Playwright E2E</text>
	<rect x="320" y="30" width="260" height="130" class="cloud"/>
	<text x="350" y="68" class="title">API / Hosting</text>
	<text x="350" y="92" class="label">Nginx / Render / Netlify</text>
	<text x="350" y="112" class="label">Public API: /api/*</text>
	<rect x="640" y="40" width="220" height="110" class="box"/>
	<text x="660" y="68" class="title">Backend</text>
	<text x="660" y="92" class="label">Node.js + Express</text>
	<text x="660" y="112" class="label">JWT auth, REST endpoints</text>
	<rect x="320" y="210" width="260" height="110" class="box"/>
	<text x="350" y="238" class="title">Database</text>
	<text x="350" y="262" class="label">PostgreSQL (Neon / managed)</text>
	<text x="350" y="282" class="label">Schema in db_schema_postgres.sql</text>
	<line x1="260" y1="95" x2="320" y2="95" class="arrow" />
	<line x1="580" y1="95" x2="640" y2="95" class="arrow" />
	<line x1="500" y1="160" x2="500" y2="210" class="arrow" />
	<line x1="460" y1="260" x2="640" y2="260" class="arrow" />
	<text x="40" y="350" class="label">Notes: Frontend calls the backend API at /api/..; backend chooses DB based on DB_MODE/DEV_DATABASE_URL and enables SSL for managed hosts.</text>
</svg>
</div>

Seat Chart (inline placeholder)

<div>
<!-- seat-chart-placeholder.svg content (inline) -->
<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Seat chart placeholder">
	<rect width="100%" height="100%" fill="#f7fbff"/>
	<rect x="20" y="20" width="760" height="410" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
	<text x="40" y="60" font-family="sans-serif" font-size="20" fill="#1f2937">Seat Chart - Placeholder</text>
	<text x="40" y="90" font-family="sans-serif" font-size="14" fill="#4b5563">Replace this with a screenshot of the Seat Chart UI (frontend/src/pages/SeatChartReport.jsx)</text>
	<g transform="translate(40,120)">
		<rect x="0" y="0" width="680" height="280" fill="#eef2ff" rx="6"/>
		<g fill="#e2e8f0" stroke="#c7d2fe" stroke-width="1">
			<g>
				<rect x="12" y="12" width="80" height="48" rx="6"/>
				<rect x="104" y="12" width="80" height="48" rx="6"/>
				<rect x="196" y="12" width="80" height="48" rx="6"/>
				<rect x="288" y="12" width="80" height="48" rx="6"/>
				<rect x="380" y="12" width="80" height="48" rx="6"/>
				<rect x="472" y="12" width="80" height="48" rx="6"/>
				<rect x="564" y="12" width="80" height="48" rx="6"/>
			</g>
			<g transform="translate(0,72)">
				<rect x="12" y="12" width="80" height="48" rx="6"/>
				<rect x="104" y="12" width="80" height="48" rx="6"/>
				<rect x="196" y="12" width="80" height="48" rx="6"/>
				<rect x="288" y="12" width="80" height="48" rx="6"/>
				<rect x="380" y="12" width="80" height="48" rx="6"/>
				<rect x="472" y="12" width="80" height="48" rx="6"/>
				<rect x="564" y="12" width="80" height="48" rx="6"/>
			</g>
			<g transform="translate(0,144)">
				<rect x="12" y="12" width="80" height="48" rx="6"/>
				<rect x="104" y="12" width="80" height="48" rx="6"/>
				<rect x="196" y="12" width="80" height="48" rx="6"/>
				<rect x="288" y="12" width="80" height="48" rx="6"/>
				<rect x="380" y="12" width="80" height="48" rx="6"/>
				<rect x="472" y="12" width="80" height="48" rx="6"/>
				<rect x="564" y="12" width="80" height="48" rx="6"/>
			</g>
		</g>
	</g>
</svg>
</div>

Students (inline placeholder)

<div>
<!-- students-placeholder.svg content (inline) -->
<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Students placeholder">
	<rect width="100%" height="100%" fill="#fffaf0"/>
	<rect x="20" y="20" width="760" height="410" rx="8" fill="#ffffff" stroke="#f59e0b"/>
	<text x="40" y="60" font-family="sans-serif" font-size="20" fill="#92400e">Students - Placeholder</text>
	<text x="40" y="90" font-family="sans-serif" font-size="14" fill="#92400e">Replace this with a screenshot of the Students page (frontend/src/pages/Students.jsx)</text>
	<g transform="translate(40,120)">
		<rect x="0" y="0" width="680" height="280" fill="#fff7ed" rx="6"/>
		<g fill="#fff1e6" stroke="#fed7aa" stroke-width="1">
			<rect x="12" y="12" width="656" height="40" rx="6"/>
			<rect x="12" y="64" width="656" height="40" rx="6"/>
			<rect x="12" y="116" width="656" height="40" rx="6"/>
			<rect x="12" y="168" width="656" height="40" rx="6"/>
			<rect x="12" y="220" width="656" height="40" rx="6"/>
		</g>
	</g>
</svg>
</div>

Notes on PNG conversion

- I embedded the SVG placeholders inline so they render immediately on GitHub and in local Markdown viewers.
- If you specifically need PNG thumbnails (raster images), I can generate them but it requires installing a small image tool (for example `sharp` or using a headless browser). I can provide a one-shot PowerShell + Node script that:
	1) installs a dev-only dependency (sharp or puppeteer),
	2) converts the SVG files in `docs/` to `docs/screenshots/*.png`, and
	3) updates the README to reference the PNG files instead of the inline SVGs.

Tell me if you want me to proceed with generating real PNGs here (I will run the install+conversion), or if inline SVG thumbnails are acceptable (this change is already applied).
