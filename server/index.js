import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, dataDir, uploadsDir, useTurso } from './db.js'
import {
  seedAdmin,
  findUserByEmail,
  verifyPassword,
  signToken,
  requireAuth,
} from './auth.js'
import { useRemoteStorage, storageName, uploadObject, deleteObject, resolveVideoUrl } from './storage.js'
import { POLICY_VERSION, clientIp } from './policy.js'
import { buildPdf } from './pdf.js'
import { MAX_VIDEO_BYTES, insertVideoBlob, getVideoBlob, videoStorageUsage } from './videoStore.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

// How videos are kept:
//   'database' -> BLOBs inside Turso/SQLite (no external services)
//   'remote'   -> S3-compatible bucket (IDrive e2 / B2 / R2)
//   'disk'     -> local uploads/ folder
// Explicit STORAGE_DRIVER wins; otherwise the best available is inferred.
const rawDriver = (process.env.STORAGE_DRIVER || '').trim().toLowerCase()
const STORAGE_DRIVER = ['database', 'remote', 'disk'].includes(rawDriver)
  ? rawDriver
  : useRemoteStorage
    ? 'remote'
    : 'database'

// Videos in the database are buffered in memory; the cap is enforced there.
// Remote/disk uploads keep the larger historical ceiling.
const MAX_FILE_SIZE =
  STORAGE_DRIVER === 'database' ? MAX_VIDEO_BYTES : 100 * 1024 * 1024

// Create the built-in admin account on first boot.
await seedAdmin()

// ---- CORS -------------------------------------------------------------
// CORS_ORIGIN can be "*" or a comma-separated list of allowed origins.
const rawOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowAll = rawOrigins.includes('*')

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests (no Origin header).
      if (!origin) return callback(null, true)
      if (allowAll || rawOrigins.includes(origin)) return callback(null, true)
      // Not an error — just omit CORS headers so the browser blocks it.
      return callback(null, false)
    },
  })
)

app.use(express.json())

// ---- Uploads ----------------------------------------------------------
// Media always arrives as an in-memory buffer, because a video goes on to be
// inserted into the database or pushed to a bucket. The only exception is the
// legacy disk driver, which streams straight to the uploads folder.
const useDiskUploads = STORAGE_DRIVER === 'disk'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi', '.ogv'])

// Identify the container from its magic bytes. Browsers are unreliable about
// the MIME type they declare: MediaRecorder output is often sent as
// "application/octet-stream" or even "text/plain". The bytes are the truth, and
// the detected type is what gets stored and later served back — otherwise the
// browser refuses to play a video served as text/plain.
function detectVideoMime(buffer) {
  if (!buffer || buffer.length < 12) return null

  // ISO base media (MP4 / MOV / M4V): "ftyp" at offset 4.
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return 'video/mp4'

  // Matroska / WebM: EBML header 0x1A45DFA3.
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'video/webm'
  }

  // Ogg (Theora video): "OggS".
  if (buffer.subarray(0, 4).toString('latin1') === 'OggS') return 'video/ogg'

  // AVI: "RIFF" .... "AVI ".
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'AVI '
  ) {
    return 'video/x-msvideo'
  }

  return null
}

function looksLikeVideo(buffer) {
  return detectVideoMime(buffer) !== null
}

const upload = multer({
  storage: useDiskUploads
    ? multer.diskStorage({
        destination(_req, _file, cb) {
          cb(null, uploadsDir)
        },
        filename(_req, file, cb) {
          const ext = path.extname(file.originalname || '').toLowerCase()
          cb(null, `${randomUUID()}${ext}`)
        },
      })
    : multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const declared = String(file.mimetype || '').toLowerCase()
    const ext = path.extname(file.originalname || '').toLowerCase()

    // Trust an honest video/* declaration.
    if (declared.startsWith('video/')) return cb(null, true)

    // Otherwise fall through to a filename check. Browsers routinely mislabel
    // recorded video, so the extension decides; the byte signature is then
    // verified after the body has been read.
    if (VIDEO_EXTENSIONS.has(ext)) return cb(null, true)

    cb(new Error('Only video files are allowed.'))
  },
})

// Reject files whose bytes are not a recognisable video container, and return
// the container's real MIME type. This is the authoritative check — the filter
// above only looks at what the client claimed.
function detectAndAssertVideo(file) {
  // Disk uploads are streamed and already validated by extension; reading them
  // back would defeat the point of streaming.
  if (!file || useDiskUploads) return null

  const detected = detectVideoMime(file.buffer)
  if (!detected) {
    const err = new Error('Only video files are allowed.')
    err.status = 400
    throw err
  }

  // Remember the real type so it is what gets stored and served.
  file.detectedMime = detected
  return detected
}

const videoFields = upload.fields([
  { name: 'english', maxCount: 1 },
  { name: 'french', maxCount: 1 },
])

// Serve uploaded videos publicly.
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '1h',
    fallthrough: true,
  })
)

// ---- Helpers ----------------------------------------------------------
const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth']

// Must match the ids in src/config.js POSITIONS.
const POSITION_IDS = ['front-desk', 'content-manager']

function removeLocalFile(file) {
  if (!file?.filename) return
  fs.unlink(path.join(uploadsDir, file.filename), () => {})
}

// Roll back any uploaded files (database rows, bucket objects, or disk) when a
// request fails. Database rows are removed with the applicant; bucket and disk
// entries have to be cleaned up explicitly.
async function cleanupFiles(entries) {
  for (const entry of entries) {
    if (!entry) continue
    if (entry.blobId) continue // row is deleted with the applicant
    if (entry.key) {
      await deleteObject(entry.key).catch(() => {})
    } else if (entry.file) {
      removeLocalFile(entry.file)
    }
  }
}

// The type to store/serve. Prefer what the bytes actually are, because a
// browser may have declared something useless like "text/plain".
function effectiveMime(file) {
  if (file.detectedMime) return file.detectedMime
  const declared = String(file.mimetype || '').toLowerCase()
  if (declared.startsWith('video/')) return declared
  return 'video/mp4'
}

// Persist a multer file according to the active driver.
async function persistVideo(file, applicantId, language) {
  const mimeType = effectiveMime(file)

  if (STORAGE_DRIVER === 'database') {
    const blobId = randomUUID()
    await insertVideoBlob({
      id: blobId,
      applicantId,
      language,
      buffer: file.buffer,
      mimeType,
    })
    return { blobId }
  }

  if (STORAGE_DRIVER === 'remote') {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const key = `${applicantId}/${language}_${Date.now()}${ext}`
    await uploadObject(key, file.buffer, mimeType)
    return { key }
  }

  return { file }
}

// The value stored in videos.video_url. For database-stored videos the bytes
// are referenced by the row's own id, so nothing extra is stored.
function storedUrlFor(persisted, language) {
  if (STORAGE_DRIVER === 'remote') return persisted.key
  if (STORAGE_DRIVER === 'database') return null
  return `/uploads/${persisted.file.filename}`
}

function groupVideos(applicants, videos) {
  const byApplicant = new Map()
  for (const v of videos) {
    if (!byApplicant.has(v.applicant_id)) byApplicant.set(v.applicant_id, [])
    byApplicant.get(v.applicant_id).push(v)
  }
  return applicants.map((a) => ({ ...a, videos: byApplicant.get(a.id) || [] }))
}

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

// ---- Health -----------------------------------------------------------
app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    const payload = {
      ok: true,
      service: 'careers-connect-api',
      database: useTurso ? 'turso' : 'local',
      storage: STORAGE_DRIVER === 'database' ? 'database' : storageName,
      policy_version: POLICY_VERSION,
    }

    // Expose how full the video storage is, so the limit is not a surprise.
    if (STORAGE_DRIVER === 'database') {
      try {
        const { bytes, count } = await videoStorageUsage()
        payload.videos = { count, bytes, max_bytes: MAX_VIDEO_BYTES }
      } catch {
        // Non-fatal: health should still answer.
      }
    }

    res.json(payload)
  })
)

// ---- Auth -------------------------------------------------------------
app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const user = await findUserByEmail(email)
    if (!user || !verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const token = signToken(user)
    res.json({ token, user: { id: user.id, email: user.email } })
  })
)

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ---- Applicants -------------------------------------------------------
// Public: submit an application (multipart form with two video files).
app.post('/api/applicants', (req, res) => {
  videoFields(req, res, async (err) => {
    if (err) {
      await cleanupFiles([req.files?.english?.[0], req.files?.french?.[0]])
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB per video.`
          : err.message || 'Upload failed.'
      return res.status(400).json({ error: message })
    }

    const english = req.files?.english?.[0]
    const french = req.files?.french?.[0]

    const body = req.body || {}
    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || !String(body[field]).trim()) {
        await cleanupFiles([english, french])
        return res.status(400).json({ error: `Missing required field: ${field}` })
      }
    }

    if (!POSITION_IDS.includes(String(body.position || '').trim())) {
      await cleanupFiles([english, french])
      return res.status(400).json({ error: 'Please choose a valid position.' })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      await cleanupFiles([english, french])
      return res.status(400).json({ error: 'Please provide a valid email address.' })
    }

    if (!english || !french) {
      await cleanupFiles([english, french])
      return res.status(400).json({ error: 'Both English and French videos are required.' })
    }

    // Verify the uploaded bytes really are a video container, regardless of the
    // type the browser declared.
    try {
      detectAndAssertVideo(english)
      detectAndAssertVideo(french)
    } catch (err) {
      await cleanupFiles([english, french])
      return res.status(err.status || 400).json({ error: err.message })
    }

    // ---- Consent ------------------------------------------------------
    // The applicant must tick the box AND type their name as a signature.
    const consented = String(body.consented || '').toLowerCase()
    if (!['true', 'yes', '1', 'on'].includes(consented)) {
      await cleanupFiles([english, french])
      return res.status(400).json({
        error: 'You must agree to the Privacy Policy before submitting.',
      })
    }

    const signatureName = String(body.signature_name || '').trim()
    if (signatureName.length < 3) {
      await cleanupFiles([english, french])
      return res.status(400).json({
        error: 'Please type your full name as your signature.',
      })
    }

    // Require the signature to look like the applicant's name, so a random
    // string cannot stand in for a signature.
    const normalize = (s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s'-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)

    const nameParts = normalize(`${body.first_name} ${body.last_name}`)
    const signatureParts = normalize(signatureName)
    const matchesName =
      nameParts.length > 0 &&
      nameParts.every((part) => signatureParts.includes(part))

    if (!matchesName) {
      await cleanupFiles([english, french])
      return res.status(400).json({
        error:
          'Your signature must match your first and last name exactly as entered above.',
      })
    }

    const policyVersion = String(body.policy_version || POLICY_VERSION).trim()
    if (policyVersion !== POLICY_VERSION) {
      await cleanupFiles([english, french])
      return res.status(409).json({
        error:
          'The Privacy Policy has been updated. Please reload the page and read it again before submitting.',
      })
    }

    const consentRecord = {
      signature_name: signatureName,
      policy_version: POLICY_VERSION,
      consented_at: new Date().toISOString(),
      consent_ip: clientIp(req),
      consent_user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    }

    const id = randomUUID()
    const persisted = []

    try {
      await db.execute({
        sql: `INSERT INTO applicants
                (id, first_name, last_name, email, phone, address, date_of_birth, position, gender,
                 consented, signature_name, policy_version, consented_at, consent_ip, consent_user_agent)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          String(body.first_name).trim(),
          String(body.last_name).trim(),
          String(body.email).trim(),
          String(body.phone).trim(),
          String(body.address).trim(),
          String(body.date_of_birth).trim(),
          String(body.position).trim(),
          // Roles are open to everyone, and gender is not collected. Written as
          // NULL explicitly because older databases still default this column
          // to 'female'.
          null,
          1,
          consentRecord.signature_name,
          consentRecord.policy_version,
          consentRecord.consented_at,
          consentRecord.consent_ip,
          consentRecord.consent_user_agent,
        ],
      })

      const engStored = await persistVideo(english, id, 'english')
      persisted.push(engStored)
      const frStored = await persistVideo(french, id, 'french')
      persisted.push(frStored)

      // Database-stored videos already have their row from persistVideo;
      // remote and disk videos need a row linking to the stored location.
      if (STORAGE_DRIVER !== 'database') {
        const insertVideoSql =
          'INSERT INTO videos (id, applicant_id, language, video_url) VALUES (?, ?, ?, ?)'
        await db.execute({
          sql: insertVideoSql,
          args: [randomUUID(), id, 'english', storedUrlFor(engStored, 'english')],
        })
        await db.execute({
          sql: insertVideoSql,
          args: [randomUUID(), id, 'french', storedUrlFor(frStored, 'french')],
        })
      }

      res.status(201).json({ id })
    } catch (e) {
      await cleanupFiles(persisted.length ? persisted : [english, french])
      // Best-effort cleanup of the applicant row if it was created.
        await db.execute({ sql: 'DELETE FROM applicants WHERE id = ?', args: [id] }).catch(() => {})
      console.error('[applicants] insert failed:', e)
      res.status(500).json({ error: 'Could not save your application. Please try again.' })
    }
  })
})

// Admin: list all applicants with their videos.
app.get(
  '/api/applicants',
  requireAuth,
  asyncRoute(async (_req, res) => {
    const [applicantsResult, videosResult] = await Promise.all([
      db.execute('SELECT * FROM applicants ORDER BY created_at DESC, rowid DESC'),
      // Explicit columns: never pull the video bytes into memory just to list
      // applicants. Only the fact that bytes exist is needed.
      db.execute(
        `SELECT id, applicant_id, language, video_url, mime_type, size_bytes, created_at,
                (data IS NOT NULL) AS has_blob
           FROM videos`
      ),
    ])

    const videos = await Promise.all(
      videosResult.rows.map(async (v) => {
        // Database-stored videos are streamed from the API itself.
        const url = v.has_blob
          ? `/api/videos/${v.id}`
          : await resolveVideoUrl(v.video_url)

        return {
          id: v.id,
          applicant_id: v.applicant_id,
          language: v.language,
          mime_type: v.mime_type,
          size_bytes: v.size_bytes,
          created_at: v.created_at,
          video_url: url,
        }
      })
    )

    res.json(groupVideos(applicantsResult.rows, videos))
  })
)

// Admin: update status.
app.patch(
  '/api/applicants/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { status } = req.body || {}
    const allowed = ['pending', 'confirmed', 'rejected']

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` })
    }

    const result = await db.execute({
      sql: 'UPDATE applicants SET status = ? WHERE id = ?',
      args: [status, req.params.id],
    })

    if (Number(result.rowsAffected) === 0) {
      return res.status(404).json({ error: 'Applicant not found.' })
    }

    res.json({ id: req.params.id, status })
  })
)

// Admin: stream a video that is stored in the database.
// Supports HTTP range requests so the browser can seek and stream.
app.get(
  '/api/videos/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const video = await getVideoBlob(req.params.id)

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' })
    }

    const { data, mimeType, size } = video
    const total = size || data.length

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=300')

    const range = req.headers.range
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      if (match) {
        const start = match[1] ? Number(match[1]) : 0
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1

        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
          res.setHeader('Content-Range', `bytes */${total}`)
          return res.status(416).end()
        }

        const chunk = data.subarray(start, end + 1)
        res.status(206)
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
        res.setHeader('Content-Length', chunk.length)
        return res.end(chunk)
      }
    }

    res.setHeader('Content-Length', total)
    res.end(data)
  })
)

// Admin: download a PDF consent record for one applicant.
app.get(
  '/api/applicants/:id/consent.pdf',
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await db.execute({
      sql: 'SELECT * FROM applicants WHERE id = ?',
      args: [req.params.id],
    })

    const applicant = result.rows[0]
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found.' })
    }

    if (!Number(applicant.consented)) {
      return res.status(409).json({ error: 'This applicant did not record consent.' })
    }

    const fullName = `${applicant.first_name} ${applicant.last_name}`
    const date = applicant.consented_at ? new Date(applicant.consented_at) : null
    const readableDate =
      date && !Number.isNaN(date.getTime()) ? date.toUTCString() : String(applicant.consented_at || '')

    const pdf = buildPdf({
      title: 'Applicant Consent Record',
      blocks: [
        {
          heading: 'Purpose of this document',
          text:
            'This record documents that the applicant named below agreed to the Privacy Policy and consented to their personal information and video recordings being used by the hiring team for the purpose of their job application.',
        },
        {
          heading: 'Declaration accepted by the applicant',
          text:
            'I confirm that I have read and understood the Privacy Policy, that I agree to my personal information and video recordings being used by the hiring team for this application, and that I understand my typed name, the date and time, my IP address, and my browser type are recorded as evidence of this consent.',
        },
      ],
      fields: [
        ['Applicant name', fullName],
        ['Email address', applicant.email],
        ['Phone number', applicant.phone || '—'],
        ['Application ID', applicant.id],
        ['Policy version agreed to', applicant.policy_version || '—'],
        ['Date and time of consent', readableDate],
        ['IP address recorded', applicant.consent_ip || '—'],
        ['Browser / device', applicant.consent_user_agent || '—'],
      ],
      signature: applicant.signature_name,
      signatureCaption: 'Applicant electronic signature (typed name)',
      footer: `Generated ${new Date().toUTCString()}`,
    })

    const safeName = fullName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent-${safeName || 'applicant'}-${applicant.id.slice(0, 8)}.pdf"`
    )
    res.send(pdf)
  })
)

// Admin: delete applicant, their video rows, and video files.
app.delete(
  '/api/applicants/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const applicantResult = await db.execute({
      sql: 'SELECT * FROM applicants WHERE id = ?',
      args: [req.params.id],
    })

    if (applicantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Applicant not found.' })
    }

    const videosResult = await db.execute({
      sql: 'SELECT * FROM videos WHERE applicant_id = ?',
      args: [req.params.id],
    })

    await db.execute({
      sql: 'DELETE FROM videos WHERE applicant_id = ?',
      args: [req.params.id],
    })
    await db.execute({
      sql: 'DELETE FROM applicants WHERE id = ?',
      args: [req.params.id],
    })

    for (const v of videosResult.rows) {
      const stored = v.video_url ? String(v.video_url) : ''
      if (stored.startsWith('/uploads/')) {
        const name = stored.split('/uploads/')[1]
        if (name) fs.unlink(path.join(uploadsDir, name), () => {})
      } else if (stored && !stored.startsWith('http')) {
        // Remote object key (e2 / B2 / R2)
        await deleteObject(stored).catch((err) =>
          console.error('[applicants] object delete failed:', err.message)
        )
      }
      // Database-stored bytes are removed with the rows above.
    }

    res.json({ id: req.params.id, deleted: true })
  })
)

// ---- Errors -----------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err)
  res.status(500).json({ error: 'Internal server error.' })
})

app.listen(PORT, () => {
  console.log(`Careers Connect API listening on http://localhost:${PORT}`)
  console.log(`Database: ${useTurso ? 'Turso (hosted)' : 'local SQLite file'}`)
  console.log(
    `Storage:  ${
      STORAGE_DRIVER === 'database'
        ? `database (videos as BLOBs, max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB each)`
        : STORAGE_DRIVER === 'remote'
          ? storageName
          : 'local disk'
    }`
  )
  console.log(`Data directory: ${dataDir}`)
})
