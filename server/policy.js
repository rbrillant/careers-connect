/**
 * Server-side view of the privacy policy.
 *
 * Keep POLICY_VERSION in sync with src/privacy.js on the frontend. The server
 * rejects submissions that claim a different version, so a stale frontend
 * build can never record consent against the wrong text.
 */
export const POLICY_VERSION = 'v1.0'

/**
 * Best-effort client IP.
 *
 * Hosts put the original client address in X-Forwarded-For (Render, Vercel,
 * etc.). We take the left-most entry, which is the client, and fall back to
 * the socket address for local development.
 */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const first = raw ? String(raw).split(',')[0].trim() : ''
  return first || req.ip || req.socket?.remoteAddress || 'unknown'
}
