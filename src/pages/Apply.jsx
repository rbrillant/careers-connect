import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import emailjs from '@emailjs/browser'
import { supabase } from '../lib/supabase'

const STEPS = ['Personal Info', 'English Video', 'French Video', 'Review & Submit']

export default function Apply() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const engInputRef = useRef()
  const frInputRef = useRef()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
  })

  const [englishFile, setEnglishFile] = useState(null)
  const [frenchFile, setFrenchFile] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Configuration Required</h2>
          <p className="text-yellow-700">
            Supabase environment variables are missing. Create a <code>.env</code> file.
          </p>
        </div>
      </div>
    )
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleStep1Next = (e) => {
    e.preventDefault()
    setError('')
    const { first_name, last_name, email, phone, address, date_of_birth } = form
    if (!first_name || !last_name || !email || !phone || !address || !date_of_birth) {
      setError('All fields are required.')
      return
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setStep(2)
  }

  const validateFile = (file, setter) => {
    if (!file) {
      setError('Please select a video file.')
      return false
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum size is 100MB.')
      return false
    }
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file.')
      return false
    }
    return true
  }

  const uploadFile = async (file, applicantId, language) => {
    const fileName = `${applicantId}/${language}_${Date.now()}_${file.name}`
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/applicant-videos/${fileName}`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Upload failed')
    }

    return `${supabaseUrl}/storage/v1/object/public/applicant-videos/${fileName}`
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)

    try {
      const newId = crypto.randomUUID()

      const { error: insertError } = await supabase
        .from('applicants')
        .insert([{ id: newId, ...form, gender: 'female' }])

      if (insertError) throw new Error(insertError.message)

      const engUrl = await uploadFile(englishFile, newId, 'english')
      const frUrl = await uploadFile(frenchFile, newId, 'french')

      const { error: v1Error } = await supabase.from('videos').insert([
        { applicant_id: newId, language: 'english', video_url: engUrl },
      ])
      if (v1Error) throw new Error(v1Error.message)

      const { error: v2Error } = await supabase.from('videos').insert([
        { applicant_id: newId, language: 'french', video_url: frUrl },
      ])
      if (v2Error) throw new Error(v2Error.message)

      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      if (serviceId && templateId && publicKey) {
        emailjs.send(serviceId, templateId, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
        }, publicKey).catch(() => {})
      }

      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
          {/* Progress Bar */}
          {!submitted && (
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                {STEPS.map((s, i) => (
                  <span key={s} className={`text-xs font-medium ${step >= i + 1 ? 'text-pink-600' : 'text-gray-400'}`}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-pink-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%` }}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Step 1: Personal Info */}
          {step === 1 && !submitted && (
            <form onSubmit={handleStep1Next} className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input name="first_name" value={form.first_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input name="last_name" value={form.last_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} rows={2} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" required />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Continue</button>
              </div>
            </form>
          )}

          {/* Step 2: English Video */}
          {step === 2 && !submitted && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">English Video</h2>
                <p className="text-gray-500 text-sm">Record a video in English. Introduce yourself, tell us why you want to be our Podcast Host, and why you are interested in working with us.</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">Clear video, well-lit, under 3 minutes.</div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {englishFile ? (
                  <div>
                    <p className="text-green-600 font-medium">{englishFile.name}</p>
                    <p className="text-sm text-gray-500">{(englishFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button onClick={() => setEnglishFile(null)} className="mt-2 text-sm text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <p className="text-gray-500 mb-2">Click to select your English video</p>
                )}
                <input ref={engInputRef} type="file" accept="video/*" onChange={(e) => { setError(''); const f = e.target.files[0]; if (f) validateFile(f, setEnglishFile) && setEnglishFile(f) }} className="hidden" />
                {!englishFile && (
                  <button onClick={() => engInputRef.current?.click()} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Choose Video</button>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(1)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={() => { if (englishFile) setStep(3); else setError('Please select your English video.') }} className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Next</button>
              </div>
            </div>
          )}

          {/* Step 3: French Video */}
          {step === 3 && !submitted && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">French Video</h2>
                <p className="text-gray-500 text-sm">Record a video in French. Introduce yourself, tell us why you want to be our Podcast Host, and why you are interested in working with us.</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">Clear video, well-lit, under 3 minutes.</div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {frenchFile ? (
                  <div>
                    <p className="text-green-600 font-medium">{frenchFile.name}</p>
                    <p className="text-sm text-gray-500">{(frenchFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button onClick={() => setFrenchFile(null)} className="mt-2 text-sm text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <p className="text-gray-500 mb-2">Click to select your French video</p>
                )}
                <input ref={frInputRef} type="file" accept="video/*" onChange={(e) => { setError(''); const f = e.target.files[0]; if (f) validateFile(f, setFrenchFile) && setFrenchFile(f) }} className="hidden" />
                {!frenchFile && (
                  <button onClick={() => frInputRef.current?.click()} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Choose Video</button>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(2)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={() => { if (frenchFile) setStep(4); else setError('Please select your French video.') }} className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Next</button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && !submitted && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Review & Submit</h2>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {form.first_name} {form.last_name}</p>
                <p><span className="font-medium">Email:</span> {form.email}</p>
                <p><span className="font-medium">Phone:</span> {form.phone}</p>
                <p><span className="font-medium">Address:</span> {form.address}</p>
                <p><span className="font-medium">DOB:</span> {form.date_of_birth}</p>
                <p><span className="font-medium">English Video:</span> {englishFile?.name}</p>
                <p><span className="font-medium">French Video:</span> {frenchFile?.name}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(3)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {submitted && (
            <div className="text-center py-8 space-y-4">
              <div className="text-6xl mb-4">&#10003;</div>
              <h2 className="text-2xl font-bold text-green-600">Application Submitted!</h2>
              <p className="text-gray-600">Thank you for applying, {form.first_name}. We have received your personal information and videos.</p>
              <p className="text-gray-500 text-sm">Our team will review your application and get back to you soon.</p>
              <button onClick={() => navigate('/')} className="mt-6 px-8 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Back to Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
