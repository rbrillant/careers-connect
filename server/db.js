import { createClient } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Persisted data location for locally uploaded videos (and the local SQLite file).
// On a host with a mounted disk, set DATA_DIR to it.
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'))
const uploadsDir = path.join(dataDir, 'uploads')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(uploadsDir, { recursive: true })

// If Turso credentials are present, use the hosted database.
// Otherwise fall back to a local SQLite file — same schema, same code.
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim()
const useTurso = Boolean(tursoUrl && tursoToken)

const localDbPath = path.join(dataDir, 'applications.db')
const dbTarget = useTurso ? tursoUrl : localDbPath

const db = useTurso
  ? createClient({ url: tursoUrl, authToken: tursoToken })
  : createClient({ url: pathToFileURL(localDbPath).href })

async function init() {
  if (!useTurso) {
    // These pragmas are connection-local; Turso manages them server-side.
    try {
      await db.execute('PRAGMA journal_mode = WAL')
    } catch {}
    try {
      await db.execute('PRAGMA foreign_keys = ON')
    } catch {}
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applicants (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      date_of_birth TEXT,
      gender TEXT DEFAULT 'female',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      video_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      data BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_videos_applicant ON videos(applicant_id);
    CREATE INDEX IF NOT EXISTS idx_applicants_created ON applicants(created_at);
  `)

  // Consent columns are added separately so existing databases are upgraded
  // in place (SQLite has no "ADD COLUMN IF NOT EXISTS").
  const consentColumns = [
    ['consented', "INTEGER NOT NULL DEFAULT 0"],
    ['signature_name', 'TEXT'],
    ['policy_version', 'TEXT'],
    ['consented_at', 'TEXT'],
    ['consent_ip', 'TEXT'],
    ['consent_user_agent', 'TEXT'],
  ]

  for (const [name, definition] of consentColumns) {
    try {
      await db.execute(`ALTER TABLE applicants ADD COLUMN ${name} ${definition}`)
    } catch (e) {
      // Already present — expected on every boot after the first.
      if (!/duplicate column/i.test(String(e.message))) {
        console.warn(`[db] could not add column ${name}:`, e.message)
      }
    }
  }

  // Columns for videos stored directly in the database as BLOBs.
  const videoColumns = [
    ['mime_type', 'TEXT'],
    ['size_bytes', 'INTEGER'],
    ['data', 'BLOB'],
  ]

  for (const [name, definition] of videoColumns) {
    try {
      await db.execute(`ALTER TABLE videos ADD COLUMN ${name} ${definition}`)
    } catch (e) {
      if (!/duplicate column/i.test(String(e.message))) {
        console.warn(`[db] could not add column ${name}:`, e.message)
      }
    }
  }

  // Older databases created video_url as NOT NULL. Database-stored videos have
  // no URL, so the constraint has to go. SQLite cannot drop a NOT NULL flag in
  // place, so the table is rebuilt once and existing rows are copied across.
  await relaxVideoUrlConstraint()
}

async function relaxVideoUrlConstraint() {
  const schema = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'videos'"
  )
  const createSql = String(schema.rows[0]?.sql || '')

  // Already relaxed (or table absent) — nothing to do.
  if (!createSql || !/video_url\s+TEXT\s+NOT\s+NULL/i.test(createSql)) return

  console.log('[db] migrating videos table to allow videos stored in the database…')

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS videos_new (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      video_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      data BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO videos_new (id, applicant_id, language, video_url, mime_type, size_bytes, data, created_at)
      SELECT id, applicant_id, language, video_url, mime_type, size_bytes,
             CASE WHEN data IS NULL THEN NULL ELSE data END,
             created_at
        FROM videos;

    DROP TABLE videos;
    ALTER TABLE videos_new RENAME TO videos;

    CREATE INDEX IF NOT EXISTS idx_videos_applicant ON videos(applicant_id);
  `)

  console.log('[db] videos table migrated.')
}

await init()

export { db, dataDir, uploadsDir, dbTarget, useTurso }
export default db
