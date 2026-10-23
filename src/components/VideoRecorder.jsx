import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * In-browser video recorder.
 *
 * Records with the device camera instead of asking for a file upload. The
 * bitrate is chosen deliberately so the result stays small: the recorded bytes
 * travel to the API and are stored in the database, which has a limited free
 * quota. A controlled bitrate is what keeps that quota from being a surprise.
 *
 * Falls back gracefully: if the camera is unavailable or permission is denied,
 * the parent is told so it can offer a file upload instead.
 */

const RESOLUTIONS = {
  '480p': { width: 854, height: 480, videoBitsPerSecond: 700_000 },
  '720p': { width: 1280, height: 720, videoBitsPerSecond: 1_500_000 },
}

const AUDIO_BITS_PER_SECOND = 96_000

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
    'video/mp4;codecs=h264,aac',
  ]
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type
    } catch {
      // Some browsers throw instead of returning false.
    }
  }
  return ''
}

export default function VideoRecorder({
  label,
  maxSeconds = 180,
  onRecorded,
  onUnavailable,
  existingFile,
  onClear,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const [phase, setPhase] = useState('idle') // idle | ready | countdown | recording | review
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [recordingError, setRecordingError] = useState('')
  const [recordedInfo, setRecordedInfo] = useState(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      clearTimer()
      stopStream()
    },
    [clearTimer, stopStream]
  )

  useEffect(() => {
    if (videoRef.current && previewUrl) videoRef.current.srcObject = null
  }, [previewUrl])

  const startPreview = async () => {
    setRecordingError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: RESOLUTIONS['480p'].width, height: RESOLUTIONS['480p'].height, facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play().catch(() => {})
      }
      setPhase('ready')
    } catch (err) {
      const message =
        err?.name === 'NotAllowedError'
          ? 'Camera access was blocked. You can allow it in your browser settings, or upload a video file instead.'
          : err?.name === 'NotFoundError'
            ? 'No camera was found on this device. You can upload a video file instead.'
            : 'The camera could not be started. You can upload a video file instead.'
      setRecordingError(message)
      setPhase('idle')
      onUnavailable?.(message)
    }
  }

  const beginRecording = async () => {
    const stream = streamRef.current
    if (!stream) return

    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: RESOLUTIONS['480p'].videoBitsPerSecond,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      })
    } catch {
      setRecordingError('Recording is not supported by this browser. You can upload a video file instead.')
      onUnavailable?.('Recording is not supported by this browser.')
      return
    }

    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      clearTimer()
      stopStream()

      const type = mimeType || 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      if (blob.size === 0) {
        setRecordingError('Nothing was recorded. Please try again.')
        setPhase('idle')
        return
      }

      const ext = type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([blob], `${label.toLowerCase().replace(/\s+/g, '-')}-recording.${ext}`, {
        type,
      })

      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setRecordedInfo({ size: blob.size, type })
      setPhase('review')
      onRecorded(file)
    }

    recorder.start(1000)
    recorderRef.current = recorder
    setElapsed(0)
    setPhase('recording')

    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(seconds)
      if (seconds >= maxSeconds) stopRecording()
    }, 250)
  }

  const startCountdown = () => {
    setRecordingError('')
    setPhase('countdown')
    setCountdown(3)
    let n = 3
    const tick = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(tick)
        beginRecording()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    clearTimer()
  }

  const reRecord = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setRecordedInfo(null)
    setElapsed(0)
    onClear?.()
    startPreview()
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const sizeMb = recordedInfo ? (recordedInfo.size / 1024 / 1024).toFixed(2) : null
  const remaining = maxSeconds - elapsed

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted={phase !== 'review'}
          src={phase === 'review' ? previewUrl : undefined}
          controls={phase === 'review'}
        />

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white text-7xl font-bold">{countdown}</span>
          </div>
        )}

        {phase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-medium">{formatTime(elapsed)}</span>
            <span className="text-white/70 text-xs">/ {formatTime(maxSeconds)}</span>
          </div>
        )}

        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <p className="text-gray-400 text-sm text-center px-6">
              Your camera preview will appear here
            </p>
          </div>
        )}
      </div>

      {recordingError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {recordingError}
        </div>
      )}

      {phase === 'recording' && remaining <= 20 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
          {remaining} second{remaining === 1 ? '' : 's'} remaining.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={startPreview}
            className="px-5 py-2.5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition"
          >
            Turn on camera
          </button>
        )}

        {phase === 'ready' && (
          <button
            type="button"
            onClick={startCountdown}
            className="px-5 py-2.5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition"
          >
            Start recording
          </button>
        )}

        {phase === 'recording' && (
          <button
            type="button"
            onClick={stopRecording}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
          >
            Stop recording
          </button>
        )}

        {phase === 'review' && (
          <>
            <span className="self-center text-sm text-green-700 font-medium">
              Recorded {sizeMb} MB
            </span>
            <button
              type="button"
              onClick={reRecord}
              className="px-5 py-2.5 border rounded-lg hover:bg-gray-50 font-medium"
            >
              Record again
            </button>
          </>
        )}
      </div>

      {phase !== 'review' && (
        <p className="text-xs text-gray-500">
          Maximum {formatTime(maxSeconds)}. Recording happens on your device — it is only uploaded
          when you submit your application.
        </p>
      )}

      {phase === 'review' && recordedInfo && (
        <p className="text-xs text-gray-500">
          Happy with this take? Continue to the next step, or record again.
        </p>
      )}

      {existingFile && phase === 'review' && (
        <input type="hidden" data-recorded="true" />
      )}
    </div>
  )
}
