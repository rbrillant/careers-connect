import { useState, useEffect } from 'react'
import {
  login,
  logout,
  getCurrentUser,
  getApplicants,
  updateApplicantStatus,
  deleteApplicant,
  downloadConsentRecord,
  fetchVideoBlobUrl,
} from '../lib/api'

export default function Admin() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applicants, setApplicants] = useState([])
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [downloadingConsent, setDownloadingConsent] = useState(false)
  // Video sources keyed by language; populated lazily with authenticated blobs.
  const [videoSrcs, setVideoSrcs] = useState({})
  // Bumped by the Retry button to re-run the video loading effect.
  const [videoAttempt, setVideoAttempt] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      const current = await getCurrentUser()
      if (!active) return
      setUser(current)
      if (current) fetchApplicants()
    })()
    return () => {
      active = false
    }
  }, [])

  const fetchApplicants = async () => {
    try {
      const data = await getApplicants()
      setApplicants(data)
    } catch (err) {
      if (err.status === 401) {
        logout()
        setUser(null)
      } else {
        setError(err.message)
      }
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const loggedIn = await login(email, password)
      setUser(loggedIn)
      await fetchApplicants()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    setUser(null)
    setApplicants([])
    setSelectedApplicant(null)
  }

  const handleConfirm = async (id) => {
    setError('')
    try {
      await updateApplicantStatus(id, 'confirmed')
      setApplicants((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a))
      )
      if (selectedApplicant?.id === id) {
        setSelectedApplicant((prev) => ({ ...prev, status: 'confirmed' }))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    setError('')
    try {
      await deleteApplicant(id)
      setApplicants((prev) => prev.filter((a) => a.id !== id))
      if (selectedApplicant?.id === id) setSelectedApplicant(null)
      setConfirmDelete(null)
    } catch (err) {
      setError(err.message)
    }
  }

  // Load the selected applicant's videos. API-streamed videos need the admin
  // token, so they are fetched and turned into blob URLs.
  useEffect(() => {
    let active = true
    const created = []

    if (!selectedApplicant?.videos?.length) {
      setVideoSrcs({})
      return () => {}
    }

    ;(async () => {
      const next = {}
      for (const video of selectedApplicant.videos) {
        // Decide from the STORED value, not the resolved one: an API path like
        // "/api/videos/..." becomes an absolute URL once resolved, which would
        // wrongly look like a public external link and skip the auth header.
        const stored = String(video.video_url || '')
        if (!stored) continue
        try {
          if (/^https?:\/\//i.test(stored)) {
            // Public bucket URL — safe to hand straight to the video element.
            next[video.language] = stored
          } else {
            // Streamed from this API, which requires the admin token.
            const blobUrl = await fetchVideoBlobUrl(stored)
            created.push(blobUrl)
            next[video.language] = blobUrl
          }
        } catch {
          next[video.language] = null
        }
      }
      if (active) setVideoSrcs(next)
    })()

    return () => {
      active = false
      for (const url of created) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
      }
    }
  }, [selectedApplicant, videoAttempt])

  const getVideoUrl = (language) => videoSrcs[language] || null

  const handleDownloadConsent = async () => {
    if (!selectedApplicant) return
    setError('')
    setDownloadingConsent(true)
    try {
      await downloadConsentRecord(selectedApplicant)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloadingConsent(false)
    }
  }

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status || 'pending'}
      </span>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Applicants Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this application? This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {applicants.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">No applications yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-3">
              <h2 className="font-semibold text-gray-700 mb-2">All Applicants</h2>
              {applicants.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedApplicant(a)}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    selectedApplicant?.id === a.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white hover:border-pink-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{a.first_name} {a.last_name}</p>
                      <p className="text-sm text-gray-500">{a.email}</p>
                    </div>
                    {statusBadge(a.status)}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>

            <div className="md:col-span-2">
              {selectedApplicant ? (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold">
                      {selectedApplicant.first_name} {selectedApplicant.last_name}
                    </h2>
                    {statusBadge(selectedApplicant.status)}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p>{selectedApplicant.email}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <p>{selectedApplicant.phone}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-500">Address:</span>
                      <p>{selectedApplicant.address}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">DOB:</span>
                      <p>{selectedApplicant.date_of_birth}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Applied:</span>
                      <p>{new Date(selectedApplicant.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Videos</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { language: 'english', label: 'English Video' },
                        { language: 'french', label: 'French Video' },
                      ].map(({ language, label }) => (
                        <div key={language}>
                          <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
                          {getVideoUrl(language) ? (
                            <video
                              controls
                              className="w-full rounded-lg border"
                              src={getVideoUrl(language)}
                            >
                              Your browser does not support video playback.
                            </video>
                          ) : videoSrcs[language] === null ? (
                            <div className="text-sm text-gray-500">
                              <p>Could not load this video.</p>
                              <button
                                type="button"
                                onClick={() => setVideoAttempt((n) => n + 1)}
                                className="mt-1 text-pink-600 hover:underline font-medium"
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">Loading video…</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Privacy & Consent</h3>
                    {selectedApplicant.consented ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Consent given
                          </span>
                          <span className="text-gray-500">
                            Policy {selectedApplicant.policy_version || '—'}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-500">Signature:</span>
                            <p className="italic">{selectedApplicant.signature_name}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Signed at:</span>
                            <p>
                              {selectedApplicant.consented_at
                                ? new Date(selectedApplicant.consented_at).toLocaleString()
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">IP address:</span>
                            <p className="font-mono text-xs">{selectedApplicant.consent_ip || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Browser / device:</span>
                            <p className="text-xs break-words">
                              {selectedApplicant.consent_user_agent || '—'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleDownloadConsent}
                          disabled={downloadingConsent}
                          className="mt-2 px-4 py-2 border border-pink-600 text-pink-600 rounded-lg hover:bg-pink-50 transition text-sm disabled:opacity-50"
                        >
                          {downloadingConsent ? 'Preparing...' : 'Download consent record (PDF)'}
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        No consent recorded
                      </span>
                    )}
                  </div>

                  <div className="border-t pt-4 flex gap-3">
                    {selectedApplicant.status !== 'confirmed' && (
                      <button
                        onClick={() => handleConfirm(selectedApplicant.id)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        Confirm Application
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(selectedApplicant.id)}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                      Delete Application
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <p className="text-gray-500">Select an applicant to view their details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
