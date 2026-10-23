import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { db } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
const TOKEN_TTL = '7d'

export async function seedAdmin() {
  const countResult = await db.execute('SELECT COUNT(*) AS c FROM users')
  const count = Number(countResult.rows[0]?.c || 0)
  if (count > 0) return

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      '[auth] No admin user exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env, then restart.'
    )
    return
  }

  const hash = bcrypt.hashSync(password, 10)
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    args: [randomUUID(), email.toLowerCase(), hash],
  })
  console.log(`[auth] Created admin user: ${email}`)
}

export async function findUserByEmail(email) {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [String(email).toLowerCase()],
  })
  return result.rows[0] || null
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash)
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }
}
