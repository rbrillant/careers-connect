import { db } from './db.js'

// ---------------------------------------------------------------------------
// Videos stored INSIDE the database as BLOBs.
//
// This is the "no third-party storage" mode: the video bytes live in the same
// Turso/SQLite database as everything else. No bucket, no disk, no extra
// signup. It is the mode used when STORAGE_DRIVER=database (or when no other
// storage is configured).
//
// Trade-off, stated plainly: databases are not designed to serve large files.
// Reads are metered by Turso, and the free plan blocks the database when the
// storage limit is reached. Uploads are therefore capped (MAX_VIDEO_BYTES) and
// usage is reported by /api/health so the limit is approached knowingly.
// ---------------------------------------------------------------------------

/** Hard ceiling for a single stored video. Kept well under Turso's row limits. */
export const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_MB || 25) * 1024 * 1024

/**
 * Insert a video row holding the bytes.
 * @returns {Promise<string>} the video id, used to build the streaming URL.
 */
export async function insertVideoBlob({ id, applicantId, language, buffer, mimeType }) {
  await db.execute({
    sql: `INSERT INTO videos (id, applicant_id, language, video_url, mime_type, size_bytes, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      applicantId,
      language,
      null, // served via /api/videos/:id, not a stored URL
      mimeType || 'video/mp4',
      buffer.length,
      buffer,
    ],
  })
  return id
}

/** Fetch one video's bytes, or null when it does not exist. */
export async function getVideoBlob(id) {
  const result = await db.execute({
    sql: 'SELECT id, mime_type, size_bytes, data FROM videos WHERE id = ?',
    args: [id],
  })
  const row = result.rows[0]
  if (!row || !row.data) return null

  return {
    id: String(row.id),
    mimeType: String(row.mime_type || 'video/mp4'),
    size: Number(row.size_bytes || 0),
    data: Buffer.from(row.data),
  }
}

/** Total bytes used by stored videos, for the admin usage readout. */
export async function videoStorageUsage() {
  const result = await db.execute(
    'SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS count FROM videos WHERE data IS NOT NULL'
  )
  const row = result.rows[0] || {}
  return { bytes: Number(row.total || 0), count: Number(row.count || 0) }
}
