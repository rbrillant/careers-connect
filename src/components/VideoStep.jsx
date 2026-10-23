import { useState, useRef } from 'react'
import VideoRecorder from './VideoRecorder'

/**
 * One video step of the application: record with the camera, or upload a file
 * as a fallback. Shows a summary of whichever was provided.
 */
export default function VideoStep({
  title,
  description,
  language,
  file,
  onFile,
  onClear,
  maxSeconds = 180,
  maxMb = 25,
}) {
  const [mode, setMode] = useState('record') // record | upload
  const [cameraUnavailable, setCameraUnavailable] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  const validateFile = (candidate) => {
    if (!candidate.type.startsWith('video/')) {
      setError('Please select a valid video file.')
      return false
    }
    if (candidate.size > maxMb * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxMb}MB per video.`)
      return false
    }
    return true
  }

  const sizeMb = file ? (file.size / 1024 / 1024).toFixed(2) : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Speak clearly, keep your face well lit, and stay under {Math.round(maxSeconds / 60)} minute
        {maxSeconds === 60 ? '' : 's'}. Recording in the browser keeps the file small, which uploads
        faster on a mobile connection.
      </div>

      {/* Mode switch */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => { setMode('record'); setError('') }}
          className={`flex-1 px-4 py-2 font-medium transition ${
            mode === 'record' ? 'bg-pink-600 text-white' : 'bg-white hover:bg-gray-50'
          }`}
        >
          Record with camera
        </button>
        <button
          type="button"
          onClick={() => { setMode('upload'); setError('') }}
          className={`flex-1 px-4 py-2 font-medium transition ${
            mode === 'upload' ? 'bg-pink-600 text-white' : 'bg-white hover:bg-gray-50'
          }`}
        >
          Upload a file
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {mode === 'record' && !file && (
        <VideoRecorder
          label={language}
          maxSeconds={maxSeconds}
          existingFile={file}
          onRecorded={(recorded) => {
            setError('')
            onFile(recorded)
          }}
          onClear={onClear}
          onUnavailable={(message) => {
            setCameraUnavailable(true)
            // Fall back automatically so the applicant is never stuck.
            setMode('upload')
            setError(message)
          }}
        />
      )}

      {mode === 'record' && file && (
        <div className="border-2 border-green-300 bg-green-50 rounded-lg p-6">
          <p className="text-green-700 font-medium mb-1">Recording ready</p>
          <p className="text-sm text-gray-600 mb-3">
            {file.name} · {sizeMb} MB · {language}
          </p>
          <video src={URL.createObjectURL(file)} controls className="w-full max-w-sm rounded-lg border bg-black" />
          <button
            type="button"
            onClick={() => { onClear(); setError('') }}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            Discard and record again
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {file ? (
            <div>
              <p className="text-green-600 font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">{sizeMb} MB</p>
              <button
                type="button"
                onClick={() => { onClear(); setError('') }}
                className="mt-2 text-sm text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-500 mb-2">
                {cameraUnavailable
                  ? 'Choose a video file from your device'
                  : `Select your ${language} video`}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  setError('')
                  const candidate = e.target.files?.[0]
                  if (candidate && validateFile(candidate)) onFile(candidate)
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Choose video
              </button>
              <p className="text-xs text-gray-400 mt-3">MP4, MOV, or WebM · max {maxMb}MB</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
