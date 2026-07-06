import { useState, useRef } from 'react'

export default function VideoUploader({ language, onUploadComplete, disabled, applicantId }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef()

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (!selected) return

    const maxSize = 100 * 1024 * 1024
    if (selected.size > maxSize) {
      setError('File too large. Maximum size is 100MB.')
      return
    }

    if (!selected.type.startsWith('video/')) {
      setError('Please select a video file.')
      return
    }

    setFile(selected)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a video file first.')
      return
    }

    setUploading(true)
    setError('')

    try {
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
        const errText = await res.text()
        throw new Error(errText || 'Upload failed')
      }

      const publicUrl = `${supabaseUrl}/storage/v1/object/public/applicant-videos/${fileName}`
      onUploadComplete(publicUrl)
      setProgress(100)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        {file ? (
          <div>
            <p className="text-green-600 font-medium">Selected: {file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={() => { setFile(null); setError('') }}
              className="mt-2 text-sm text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 mb-2">
              Click to select your {language} video
            </p>
            <p className="text-xs text-gray-400">MP4, MOV, WebM (max 100MB)</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {!file && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Choose Video
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {file && !uploading && (
        <button
          onClick={handleUpload}
          disabled={disabled}
          className="w-full py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
        >
          Upload {language} Video
        </button>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-pink-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 text-center">Uploading...</p>
        </div>
      )}
    </div>
  )
}
