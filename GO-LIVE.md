# Go-Live Checklist

Everything in the app is built and tested. What remains is publishing it.
Work through this top to bottom; each step is copy-paste.

Three pieces:

```
Vercel   ── the website (React)
Render   ── the API (Node/Express), free tier
Turso    ── applicants + consent records + videos
```

---

## 0. Fix git on this machine (one time)

`git` currently fails with:

```
xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools)
```

and the project has **no `.git` folder**, so it has never been committed.
Pick **one** of these:

**Option A — install Command Line Tools** (needs internet, ~5 min)
```bash
xcode-select --install
```
If it says "already installed" but git still fails, reset it:
```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```
Wait for the installer to finish, then check:
```bash
git --version
```

**Option B — GitHub Desktop** (no terminal needed)
Install [GitHub Desktop](https://desktop.github.com), then *File → Add Local Repository*
and choose this folder. It ships its own git, so the broken system git does not matter.

Do not continue until `git --version` (or GitHub Desktop) works.

---

## 1. Rotate the Turso token — do this first

The current token was pasted into a chat window and must be treated as leaked.

1. Open [turso.tech](https://turso.tech) → your database.
2. **Revoke** the existing auth token.
3. **Create** a new token and copy it.
4. Put it in `server/.env` as `TURSO_AUTH_TOKEN=...` (you will also paste it into Render in step 4).

Confirm the API still connects:
```bash
cd server && npm start
# in another terminal:
curl -s http://localhost:8787/api/health
# "database":"turso" means the new token works
```

---

## 2. Change the admin password

The live database still has the placeholder admin account created during setup.
Its credentials are weak and were used in plain text during development, so they
must change before the site is reachable.

Edit `server/.env`:
```
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<a strong password you will remember>
```

Then reset the stored admin user:
```bash
cd server
node --env-file=.env seed.js
```

---

## 3. Publish the code to GitHub

```bash
cd "/Users/apple/Documents/Default Project/careers-connect"

git init
git add .
git commit -m "Rebuild: Vercel frontend, Node API, Turso storage for applicants, consent records and videos"

# Create an EMPTY repo on github.com first (no README, no .gitignore),
# then use the URL it shows you:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/careers-connect.git
git push -u origin main
```

Before pushing, confirm secrets are **not** included:

```bash
git status --short
```

`.gitignore` must exclude `.env` and `server/.env`. If either shows up in
`git status`, stop and add it to `.gitignore` before committing.

---

## 4. Deploy the API on Render

1. [render.com](https://render.com) → **New → Blueprint** → connect the repo.
   Render reads `render.yaml` from the repo root.
2. It will ask for the `sync: false` values:

   | Variable | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://<your-database>-<org>.turso.io` (from `server/.env`) |
   | `TURSO_AUTH_TOKEN` | the **new** token from step 1 |
   | `ADMIN_EMAIL` | your admin email |
   | `ADMIN_PASSWORD` | the **new** password from step 2 |
   | `CORS_ORIGIN` | leave blank for now — set it in step 6 |

   `JWT_SECRET` is generated automatically. `STORAGE_DRIVER=database` and
   `MAX_VIDEO_MB=25` come from `render.yaml`.
3. Deploy, then verify:

   ```bash
   curl -s https://YOUR-API.onrender.com/api/health
   ```

   Expected:
   ```json
   {"ok":true,"service":"careers-connect-api","database":"turso",
    "storage":"database","policy_version":"v1.0",
    "videos":{"count":0,"bytes":0,"max_bytes":26214400}}
   ```

   - `"database":"turso"` → credentials are right. If it says `"local"`, the
     token or URL is wrong.
   - `"storage":"database"` → videos will go to Turso.

> **Free tier note:** the API sleeps after ~15 minutes idle, so the first
> request after a quiet period takes ~30–60 seconds. The Vercel site still loads
> normally; only API calls wait.

---

## 5. Deploy the frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Environment Variables** → add for *Production, Preview and Development*:

   ```
   VITE_API_URL = https://YOUR-API.onrender.com
   ```

   No trailing slash. This is baked in at build time, so any change requires a
   **redeploy**.
4. Deploy and copy the resulting URL, e.g. `https://careers-connect.vercel.app`.

---

## 6. Lock the API to your site (CORS)

1. Render → your service → **Environment**.
2. Set `CORS_ORIGIN` to the exact Vercel origin, **no trailing slash**:

   ```
   CORS_ORIGIN=https://careers-connect.vercel.app
   ```

   For multiple origins, separate with commas.
3. **Save and redeploy.**

If you skip this, either the browser blocks requests (empty `CORS_ORIGIN`) or the
API accepts any site.

---

## 7. Verify the live site

1. Open the Vercel URL → **Apply**.
2. Fill in step 1 → **Continue**.
3. Step 2: **Turn on camera** → allow permission → **Start recording** → speak
   ~10 seconds → **Stop recording** → confirm the preview plays.
   (Deny the camera once to confirm it falls back to **Upload a file**.)
4. Step 3: repeat for French.
5. Step 4: tick the consent box, type the full name exactly as entered, submit.
6. Open `/admin`, log in with the **new** password.
7. Confirm:
   - the applicant appears,
   - both videos play,
   - **Download consent record (PDF)** produces a PDF with signature, time, IP
     and policy version.
8. Check storage grew:
   ```bash
   curl -s https://YOUR-API.onrender.com/api/health
   ```
9. Delete the test application so it does not count against storage.

---

## 8. Before you announce it

- [ ] Turso token rotated
- [ ] Admin password changed, default `admin12345` no longer works
- [ ] `CORS_ORIGIN` set to the Vercel origin
- [ ] `privacy@example.com` replaced with a real address
- [ ] Privacy policy reviewed by a Rwandan lawyer (strongly advised)
- [ ] Test application deleted
- [ ] Backup taken (see below)

---

## Ongoing

**Storage watch.** Turso free = **5 GB**, and exceeding *any* limit **blocks** the
database (it is not billed). With in-browser recording a 3-minute video is about
**4.4 MB**, so two videos per applicant ≈ 9 MB → roughly **500 applicants**.

```bash
curl -s https://YOUR-API.onrender.com/api/health \
  | grep -o '"videos":{[^}]*}'
```

**Backup** (includes the videos):
```bash
turso db shell careers-connect ".dump" > backup-$(date +%F).sql
```

**Restore:**
```bash
turso db shell careers-connect < backup-2026-10-23.sql
```

**Bump the policy version** whenever the privacy text changes — it must be
updated in **both** `src/privacy.js` and `server/policy.js` (`v1.0` → `v1.1`),
or submissions will be rejected with `409`.
