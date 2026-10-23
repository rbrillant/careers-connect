# Careers Connect

A job application site with a **React + Vite frontend**, a **self-hosted Node API**, and a single hosted **Turso** database that stores everything — applicants, consent records, **and the videos**. Deploy the frontend on Vercel and the API on any Node host.

| Part | Stack | Where it runs |
|------|-------|---------------|
| Frontend | React 18, Vite, Tailwind CSS | Vercel |
| API | Node + Express | Render / Railway / Fly.io / VPS |
| Database | Turso (hosted libSQL / SQLite) | Turso cloud |
| Video files | Stored as BLOBs in the same database | Turso cloud |

```
Browser ──► Vercel (React app) ──► API server (Express) ──► Turso
                                                applicants + consent + videos
```

There is **one** service to sign up for. With no credentials set, the API falls
back to a local SQLite file, so local development needs no accounts at all.
An S3-compatible bucket (IDrive e2 / Backblaze B2 / Cloudflare R2) or the local
disk can be used for videos instead, via `STORAGE_DRIVER`.

## Project layout

```
careers-connect/
├── src/                    # React frontend
│   ├── config.js           # ← edit this for the job position
│   ├── lib/api.js          # frontend API client
│   └── pages/
│       ├── Home.jsx
│       ├── Apply.jsx
│       └── Admin.jsx
├── server/                 # Node API + database + storage layer
│   ├── index.js            # Express app + routes
│   ├── db.js               # libSQL client (Turso or local file) + schema + migrations
│   ├── videoStore.js       # videos stored in the database as BLOBs
│   ├── storage.js          # optional S3-compatible bucket storage
│   ├── pdf.js              # consent record PDF generation
│   ├── policy.js           # server-side privacy policy version + client IP
│   ├── auth.js             # admin login (JWT + bcrypt)
│   ├── seed.js             # create/reset admin user
│   └── data/               # local SQLite file + uploaded videos (gitignored)
└── .env                    # VITE_API_URL
```

## Database

The backend uses **libSQL**, the SQLite dialect hosted by [Turso](https://turso.tech).

- **With `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set** → uses your hosted Turso database.
- **Without them** → uses a local SQLite file at `server/data/applications.db`.

Same schema, same code either way. Tables are created automatically on first boot.

## Customize the position

Edit `src/config.js` — title, description, application steps, video guidelines, and footer text all live there.

## Run locally

**1. Start the backend**

```bash
cd server
cp .env.example .env        # then edit ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm start                   # http://localhost:8787
```

On first start it creates the admin account from `server/.env`. Leave the Turso variables blank to use a local database.

**2. Start the frontend** (new terminal)

```bash
npm install
npm run dev                 # http://localhost:5173
```

**Admin:** open http://localhost:5173/admin and log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`.

## Environment variables

**Frontend (`.env` / Vercel):**

| Variable | Example | Meaning |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8787` / `https://api.example.com` | Base URL of the API |

**Backend (`server/.env` / host dashboard):**

| Variable | Example | Meaning |
|----------|---------|---------|
| `PORT` | `8787` | Server port (hosts usually set this) |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Allowed frontend origin(s), comma-separated. `*` for local dev |
| `JWT_SECRET` | long random string | Signs admin login tokens |
| `ADMIN_EMAIL` | `you@example.com` | Admin login email (created on first boot) |
| `ADMIN_PASSWORD` | strong password | Admin login password |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` | Turso database URL (blank = local file) |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Turso auth token (blank = local file) |
| `STORAGE_DRIVER` | `database` | `database` / `remote` / `disk` (blank = auto) |
| `MAX_VIDEO_MB` | `25` | Max size of one video stored in the database |
| `DATA_DIR` | `/var/data` | Where the local SQLite file and disk videos live |

*(Optional bucket storage: `E2_*` for IDrive e2, `B2_*` for Backblaze B2, `R2_*` for Cloudflare R2. Set `STORAGE_DRIVER=remote` to use one.)*

## Deploy

See [`server/README.md`](./server/README.md) for the API + Turso setup and [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full Vercel walkthrough.

> Because the database *and* the videos live in Turso, the API runs fine on a **free** host with no persistent disk.

## API reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/health` | – | Health check (reports `database`, `storage`, and video usage) |
| `POST` | `/api/auth/login` | – | Admin login → token |
| `GET` | `/api/auth/me` | Bearer | Current admin |
| `POST` | `/api/applicants` | – | Submit application (multipart: fields + consent + `english` + `french` videos) |
| `GET` | `/api/applicants` | Bearer | List applications with videos |
| `GET` | `/api/videos/:id` | Bearer | Stream a stored video (supports range requests) |
| `GET` | `/api/applicants/:id/consent.pdf` | Bearer | Download the signed consent record |
| `PATCH` | `/api/applicants/:id` | Bearer | Update status (`pending`/`confirmed`/`rejected`) |
| `DELETE` | `/api/applicants/:id` | Bearer | Delete application + videos |
| `GET` | `/uploads/<file>` | – | Serve disk-stored videos (only when `STORAGE_DRIVER=disk`) |
