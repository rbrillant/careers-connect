/**
 * Create (or reset) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Usage:
 *   node --env-file=.env seed.js
 */
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db, useTurso } from './db.js'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD first (see .env.example).')
  process.exit(1)
}

console.log(`Database: ${useTurso ? 'Turso (hosted)' : 'local SQLite file'}`)

const hash = bcrypt.hashSync(password, 10)
const existing = await db.execute({
  sql: 'SELECT id FROM users WHERE email = ?',
  args: [email.toLowerCase()],
})

if (existing.rows.length > 0) {
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [hash, existing.rows[0].id],
  })
  console.log(`Updated password for admin: ${email}`)
} else {
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    args: [randomUUID(), email.toLowerCase(), hash],
  })
  console.log(`Created admin: ${email}`)
}
