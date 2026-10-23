# Deploying Careers Connect

Three pieces, and **only one service to sign up for**:

1. **Database + video storage** → **Turso** (hosted SQLite, free, no credit card)
2. **API** → a Node host (**Render** free tier is enough — no disk required)
3. **Frontend** (this repo root) → **Vercel**

```
Applicant's browser
        │
        ▼
   Vercel  ──── the website (React)
        │  API calls
        ▼
   Node API  ──── runs on Render
        │  SQL over the internet
        ▼
     Turso  ──── applicants, consent records, videos
```

Videos are stored **inside Turso** as BLOBs, so there is no bucket, no trial,
and no credit card anywhere in this setup.

---

## Step 1 — Create the Turso database

1. Sign up at [turso.tech](https://turso.tech) — free, **no card**.
2. Create a database, e.g. `careers-connect`. Pick a region near your applicants
   (Ireland, `aws-eu-west-1`, is a good choice for Rwanda).
3. Copy the **Database URL** (`libsql://...`) and create an **Auth Token**.

Tables — including the new consent and video columns — are created and migrated
automatically when the API first boots.

## Step 2 — Deploy the API

Follow [`server/README.md`](./server/README.md). Environment variables to set:

```
JWT_SECRET=<long-random-string>
CORS_ORIGIN=<your Vercel URL>     # can be * temporarily
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong-password>

TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...

STORAGE_DRIVER=database
MAX_VIDEO_MB=25
```

Deploy in **Frankfurt** (closest to the Ireland database and to Rwanda).

When done you have a public URL like `https://careers-connect-api.onrender.com`.
Verify it:

```bash
curl https://careers-connect-api.onrender.com/api/health
# {"ok":true,...,"database":"turso","storage":"database","policy_version":"v1.0","videos":{...}}
```

If it says `"database":"local"`, the Turso credentials are missing or wrong.

## Step 3 — Deploy the frontend to Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add environment variable:
   - `VITE_API_URL` = your API URL (e.g. `https://careers-connect-api.onrender.com`)
   - Apply to **Production, Preview, and Development**
4. Deploy.
5. Copy the Vercel URL and set it as `CORS_ORIGIN` on the API, then redeploy the API.

> `VITE_*` variables are baked in at build time. If you change `VITE_API_URL`, **redeploy** the frontend.

## Step 4 — Verify

1. Open the Vercel site → **Apply Now**.
2. Fill in the personal details step.
3. Upload two short videos and submit.
4. Complete the **Privacy Agreement**: tick the box and type the applicant's name.
5. Open `/admin` → log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
6. Confirm the application appears, both videos play, and **Download consent
   record (PDF)** produces a PDF with the signature, timestamp, and IP.
7. Check `GET /api/health` — the `videos.bytes` figure should have grown.

## Watching the storage limit

Turso's free plan includes **5 GB** and, once *any* limit is exceeded, the
database is **blocked** — not billed. Keep an eye on usage:

```bash
curl -s https://your-api.onrender.com/api/health | grep -o '"videos":{[^}]*}'
```

At 25 MB per video and two videos per applicant, 5 GB holds roughly **100
applicants**. The planned in-browser recording at a lower bitrate reduces video
size by roughly 5×, giving a much larger margin.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Requests fail with CORS errors | Set `CORS_ORIGIN` to the exact Vercel origin (no trailing slash); redeploy API |
| "Failed to fetch" | `VITE_API_URL` wrong or API asleep; redeploy frontend after changing it |
| `/api/health` shows `database: local` | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` not set or wrong |
| `/api/health` shows `storage: local` | `STORAGE_DRIVER` should be `database`; check it was set on the host |
| Video upload rejected as too large | Raise `MAX_VIDEO_MB`, or let the in-browser recorder crop it |
| A recorded video is rejected as "not a video" | The file's bytes were not a real video container; check the browser produced a `video/*` recording (see `server/README.md` → Upload validation) |
| Videos upload but won't play | The dashboard needs the admin token to stream them; log in again |
| Admin login says invalid | Check `ADMIN_EMAIL`/`ADMIN_PASSWORD`; run `node --env-file=.env seed.js` in `server/` |
| 502/413 on upload | Host/proxy body-size limit; keep videos within `MAX_VIDEO_MB` |
