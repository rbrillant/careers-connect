import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createApplication } from '../lib/api'
import { POLICY_VERSION } from '../privacy'
import VideoStep from '../components/VideoStep'

const STEPS = ['Personal Info', 'English Video', 'French Video', 'Review & Submit']

export default function Apply() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
  const [consentChecked, setConsentChecked] = useState(false)
  const [signatureName, setSignatureName] = useState('')

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

  const handleSubmit = async () => {
    setError('')

    if (!consentChecked) {
      setError('Please tick the box to agree to the Privacy Policy.')
      return
    }

    const trim = (s) => String(s || '').trim()
    if (trim(signatureName).length < 3) {
      setError('Please type your full name as your signature.')
      return
    }

    // The signature must contain the first and last name entered in step 1.
    const normalize = (s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s'-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)

    const nameParts = normalize(`${form.first_name} ${form.last_name}`)
    const signatureParts = normalize(signatureName)
    const matchesName =
      nameParts.length > 0 && nameParts.every((part) => signatureParts.includes(part))

    if (!matchesName) {
      setError('Your signature must match your first and last name exactly as entered above.')
      return
    }

    setSubmitting(true)

    try {
      await createApplication({
        fields: form,
        englishFile,
        frenchFile,
        consent: { signatureName: trim(signatureName), policyVersion: POLICY_VERSION },
      })
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
              <VideoStep
                title="English Video"
                description="Record your introduction in English. Tell us your name, why you want to be our Podcast Host, and why you want to work with us."
                language="English"
                file={englishFile}
                onFile={(f) => { setError(''); setEnglishFile(f) }}
                onClear={() => setEnglishFile(null)}
              />

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(1)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={() => { if (englishFile) setStep(3); else setError('Please record or upload your English video.') }} className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Next</button>
              </div>
            </div>
          )}

          {/* Step 3: French Video */}
          {step === 3 && !submitted && (
            <div className="space-y-6">
              <VideoStep
                title="French Video"
                description="Record your introduction in French, covering the same content as your English video."
                language="French"
                file={frenchFile}
                onFile={(f) => { setError(''); setFrenchFile(f) }}
                onClear={() => setFrenchFile(null)}
              />

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(2)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={() => { if (frenchFile) setStep(4); else setError('Please record or upload your French video.') }} className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition">Next</button>
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

              {/* Privacy agreement */}
              <div className="border border-gray-300 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Privacy Agreement</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    We need your consent to use your details and video recordings for this
                    application. Please read the{' '}
                    <Link to="/privacy" target="_blank" className="text-pink-600 font-medium hover:underline">
                      Privacy Policy
                    </Link>{' '}
                    (version {POLICY_VERSION}).
                  </p>
                </div>

                <label htmlFor="consent-checkbox" className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="consent-checkbox"
                    name="consented"
                    type="checkbox"
                    required
                    checked={consentChecked}
                    onChange={(e) => { setError(''); setConsentChecked(e.target.checked) }}
                    className="mt-1 h-5 w-5 accent-pink-600"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to the Privacy Policy. I agree that my personal
                    information and video recordings may be used by the hiring team for the
                    purpose of this application.
                  </span>
                </label>

                <div>
                  <label htmlFor="signature-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Signature — type your full name
                  </label>
                  <input
                    id="signature-name"
                    name="signature_name"
                    type="text"
                    autoComplete="name"
                    required
                    value={signatureName}
                    onChange={(e) => { setError(''); setSignatureName(e.target.value) }}
                    placeholder={`${form.first_name} ${form.last_name}`.trim()}
                    aria-describedby="signature-help"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none italic"
                  />
                  <p id="signature-help" className="text-xs text-gray-500 mt-2">
                    Typing your name here acts as your signature. We record the date, time, your
                    IP address, and your browser type as evidence of your consent.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(3)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Back</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !consentChecked || signatureName.trim().length < 3}
                  className="flex-1 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
