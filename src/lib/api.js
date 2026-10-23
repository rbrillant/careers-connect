// API client for the self-hosted Node + SQLite backend.
// Set VITE_API_URL to the backend's public URL (e.g. https://your-api.onrender.com).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

const TOKEN_KEY = 'careers_connect_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options)
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status}).`)
    error.status = res.status
    throw error
  }

  return data
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  return data.user
}

export async function getCurrentUser() {
  if (!getToken()) return null
  try {
    const data = await request('/api/auth/me', { headers: authHeaders() })
    return data.user
  } catch {
    clearToken()
    return null
  }
}

export function logout() {
  clearToken()
}

export async function createApplication({ fields, englishFile, frenchFile, consent }) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  formData.append('english', englishFile)
  formData.append('french', frenchFile)

  // Consent record — validated and timestamped server-side.
  formData.append('consented', 'true')
  formData.append('signature_name', consent.signatureName)
  formData.append('policy_version', consent.policyVersion)

  return request('/api/applicants', { method: 'POST', body: formData })
}

/** Download the PDF consent record for an applicant (admin only). */
export async function downloadConsentRecord(applicant) {
  const res = await fetch(`${API_URL}/api/applicants/${applicant.id}/consent.pdf`, {
    headers: authHeaders(),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Could not download the consent record (${res.status}).`)
  }

  const blob = await res.blob()
  const name = `${applicant.first_name}-${applicant.last_name}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `consent-${name || 'applicant'}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function getApplicants() {
  return request('/api/applicants', { headers: authHeaders() })
}

export async function updateApplicantStatus(id, status) {
  return request(`/api/applicants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
}

export async function deleteApplicant(id) {
  return request(`/api/applicants/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}

export function resolveVideoUrl(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_URL}${url}`
}

/**
 * Videos streamed from the API require the admin token, so a plain <video src>
 * cannot load them. This fetches the video with the token and returns a blob
 * URL the element can play. Callers must revoke the URL when done.
 */
export async function fetchVideoBlobUrl(url) {
  if (!url) return null
  if (url.startsWith('http')) return url

  const res = await fetch(`${API_URL}${url}`, { headers: authHeaders() })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Could not load the video (${res.status}).`)
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
