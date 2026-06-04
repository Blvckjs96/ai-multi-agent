import { useCallback, useRef, useState } from 'react'
import { API_ORIGIN } from '../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useAudio() {
  const [recording, setRecording]     = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError]             = useState(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(250)
      mediaRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError('Microphone access denied')
    }
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRef.current) { resolve(''); return }

      mediaRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'audio.webm')
          const res = await fetch(`${API_ORIGIN}/api/v1/audio/transcribe`, {
            method: 'POST',
            headers: authHeaders(),
            body: form,
          })
          if (res.ok) {
            const data = await res.json()
            resolve(data.text ?? '')
          } else {
            resolve('')
          }
        } catch {
          resolve('')
        } finally {
          setTranscribing(false)
        }
      }

      mediaRef.current.stop()
      mediaRef.current.stream.getTracks().forEach((t) => t.stop())
      setRecording(false)
      mediaRef.current = null
    })
  }, [])

  return { recording, transcribing, error, start, stop }
}
