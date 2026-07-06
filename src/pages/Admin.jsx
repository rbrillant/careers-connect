import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applicants, setApplicants] = useState([])
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Configuration Required</h2>
          <p className="text-yellow-700">
            Supabase environment variables are missing. Create a <code>.env</code> file with
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchApplicants()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchApplicants()
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchApplicants = async () => {
    const { data, error } = await supabase
      .from('applicants')
      .select('*, videos(*)')
      .order('created_at', { ascending: false })

    if (!error && data) setApplicants(data)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (error) setError(error.message)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)
    if (error) setError(error.message)
    else setError('Check your email for the confirmation link.')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setApplicants([])
    setSelectedApplicant(null)
  }

  const handleConfirm = async (id) => {
    setError('')
    const { error: updateError } = await supabase
      .from('applicants')
      .update({ status: 'confirmed' })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setApplicants((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a))
    )
    if (selectedApplicant?.id === id) {
      setSelectedApplicant((prev) => ({ ...prev, status: 'confirmed' }))
    }
  }

  const handleDelete = async (id) => {
    setError('')

    const { data: videosToDelete } = await supabase
      .from('videos')
      .select('video_url')
      .eq('applicant_id', id)

    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('applicant_id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (videosToDelete?.length > 0) {
      const filePaths = videosToDelete.map((v) => {
        const parts = v.video_url.split('/applicant-videos/')
        return parts[1] || ''
      }).filter(Boolean)
      if (filePaths.length > 0) {
        await supabase.storage.from('applicant-videos').remove(filePaths)
      }
    }

    const { error: applicantError } = await supabase
      .from('applicants')
      .delete()
      .eq('id', id)

    if (applicantError) {
      setError(applicantError.message)
      return
    }

    setApplicants((prev) => prev.filter((a) => a.id !== id))
    if (selectedApplicant?.id === id) setSelectedApplicant(null)
    setConfirmDelete(null)
  }

  const getVideoUrl = (language) => {
    if (!selectedApplicant?.videos) return null
    const video = selectedApplicant.videos.find((v) => v.language === language)
    return video?.video_url || null
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

  if (!session) {
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
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Sign Up
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
          <button
            onClick={handleLogout}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm"
          >
            Logout
          </button>
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
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">English Video</p>
                        {getVideoUrl('english') ? (
                          <video controls className="w-full rounded-lg border" src={getVideoUrl('english')}>
                            Your browser does not support video playback.
                          </video>
                        ) : (
                          <p className="text-sm text-gray-400">Not uploaded</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">French Video</p>
                        {getVideoUrl('french') ? (
                          <video controls className="w-full rounded-lg border" src={getVideoUrl('french')}>
                            Your browser does not support video playback.
                          </video>
                        ) : (
                          <p className="text-sm text-gray-400">Not uploaded</p>
                        )}
                      </div>
                    </div>
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
