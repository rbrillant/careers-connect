# Backend deployment (Node + Turso)

The backend is a small Express server. It stores everything — applicants,
consent records, **and the videos themselves** — in a single hosted
**Turso** database, so no other service is required.

| Concern | Default (local) | Production |
|---------|-----------------|------------|
| Database | SQLite file | **Turso** (hosted) |
| Video files | Database BLOBs | **Turso** (same database) |

```
Vercel (React) ──► Node API ──► Turso (applicants + consent + videos)
```

Optional alternatives for video storage are also supported: an S3-compatible
bucket (IDrive e2, Backblaze B2, Cloudflare R2) or the server's local disk.
See "Storage drivers" below.

## Requirements

- **Node 20+** (Node 24 recommended)
- A **Turso** database (free tier, no credit card)

That is the entire list.

## 1. Database: Turso

1. Sign up at [turso.tech](https://turso.tech) (GitHub login works).
2. Create a database, e.g. `careers-connect`.
3. Copy the **Database URL** (`libsql://...`) and create an **Auth Token**.

```
TURSO_DATABASE_URL=libsql://careers-connect-yourname.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

Tables are created automatically on first boot.

### Migrating an existing local database

```bash
turso db shell careers-connect < server/data/applications.db
```

## 2. Videos: stored in the database

By default (`STORAGE_DRIVER=database`) the video bytes live in the `videos`
table as BLOBs in the same Turso database. Nothing else to create or pay for.

Two things to know:

- **`MAX_VIDEO_MB`** (default `25`) caps a single video. Uploads over the cap are
  refused with a clear message rather than filling the database.
- **Turso free includes 5 GB of storage.** Once *any* free limit is exceeded the
  database is **blocked**, so the limit is worth watching. `GET /api/health`
  reports current usage:

```json
"videos": { "count": 12, "bytes": 41943040, "max_bytes": 26214400 }
```

At 25 MB per video and two videos per applicant, 5 GB holds roughly **100
applicants**. In-browser recording at a lower bitrate reduces video size by
roughly 5×, giving a much larger margin.

### Upload validation

The declared MIME type from a browser is **not** trusted. MediaRecorder output
is commonly sent as `application/octet-stream` or even `text/plain`, so files
are accepted by extension and then verified by their **magic bytes** (MP4
`ftyp`, WebM/Matroska EBML, Ogg, AVI). The detected container becomes the stored
`mime_type`, which is what the streaming endpoint later serves — otherwise a
valid recording could be served as `text/plain` and be unplayable.

A file that claims to be a video but does not contain a recognisable video
container is rejected with `400 Only video files are allowed.`

## Storage drivers

`STORAGE_DRIVER` selects where videos are kept:

| Value | Where videos live | Needs |
|---|---|---|
| `database` | BLOBs in the Turso/SQLite database | nothing extra |
| `remote` | IDrive e2 / Backblaze B2 / Cloudflare R2 bucket | bucket credentials |
| `disk` | `uploads/` folder next to the server | a persistent disk |

Leave it blank to auto-select: `remote` when a bucket is configured, otherwise
`database`.

### Optional: an S3-compatible bucket instead

Only if you later want videos out of the database. IDrive e2 (free 10 GB, no
card) works like this:

```
E2_ACCESS_KEY_ID=<access key>
E2_SECRET_ACCESS_KEY=<secret key>
E2_ENDPOINT=https://xyz1.ch11.idrivee2-2.com
E2_REGION=us-east-1
E2_BUCKET=careers-connect-videos
E2_PUBLIC_URL=
```

Backblaze B2 (`B2_*`) and Cloudflare R2 (`R2_*`) use the same pattern. Leave
`*_PUBLIC_URL` blank to keep the bucket private — the API then returns temporary
signed URLs for playback.

## 3. Deploy the API on Render

1. Push this repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Settings:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node 24
   - **Region:** **Frankfurt** (closest to the Ireland Turso DB and to Rwanda)
4. Add all environment variables above, plus:

```
JWT_SECRET=<long-random-string>
CORS_ORIGIN=https://your-frontend.vercel.app
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong-password>
```

5. Deploy and copy the service URL.

Because the database and videos both live in Turso, the free Render instance works — **no persistent disk required**.

An updated `render.yaml` blueprint is included at the repo root. It sets
`STORAGE_DRIVER=database` and `MAX_VIDEO_MB=25`, so videos stay in Turso.

## Confirming the setup

`GET /api/health` reports which backends are active:

```bash
curl https://your-api.onrender.com/api/health
# {"ok":true,"service":"careers-connect-api","database":"turso","storage":"database","policy_version":"v1.0","videos":{...}}
```

Possible `storage` values: `database`, `e2`, `b2`, `r2`, `local`.

## Full environment variables

```
PORT=8787
CORS_ORIGIN=https://your-frontend.vercel.app
JWT_SECRET=<long-random-string>
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong-password>

TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

STORAGE_DRIVER=database
MAX_VIDEO_MB=25

DATA_DIR=./data
```

## First boot

The server creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when no users exist.

To create or reset the admin password later:

```bash
cd server
node --env-file=.env seed.js
```

## Backups

- **Database (includes the videos):** `turso db shell <db> ".dump" > backup.sql`
- **Restore:** `turso db shell <db> < backup.sql`
