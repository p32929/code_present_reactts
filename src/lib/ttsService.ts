import { getAISettings, getTTSApiKeys, type TTSMode } from './aiSettings'

export interface SlideAudio {
  audioBlob: Blob
  duration: number // seconds
}

// In-memory cache: subtitle text -> generated audio
const ttsCache = new Map<string, SlideAudio>()

// Track which key index to start with (round-robin across calls)
let nextKeyIndex = 0

function pcmToWav(pcmData: Uint8Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.byteLength
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  new Uint8Array(buffer, 44).set(pcmData)

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

async function getAudioDuration(audioBlob: Blob): Promise<number> {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContext = new AudioContext()
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return audioBuffer.duration
  } finally {
    await audioContext.close()
  }
}

// ── Native Gemini TTS with key rotation ──

async function callGeminiTTSWithKey(
  text: string,
  apiKey: string,
  model: string,
  voice: string,
  signal?: AbortSignal
): Promise<{ audio: SlideAudio | null; shouldTryNext: boolean; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
      signal,
    })

    if (res.status === 429) {
      return { audio: null, shouldTryNext: true, error: '429 rate limited' }
    }
    if (res.status === 401 || res.status === 403) {
      return { audio: null, shouldTryNext: true, error: `${res.status} auth error` }
    }
    if (res.status === 500 || res.status === 503) {
      return { audio: null, shouldTryNext: true, error: `${res.status} server error` }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { audio: null, shouldTryNext: true, error: `${res.status}: ${body.slice(0, 200)}` }
    }

    const data = await res.json()
    const part = data?.candidates?.[0]?.content?.parts?.[0]
    if (!part?.inlineData?.data) {
      return { audio: null, shouldTryNext: true, error: 'No audio data in response' }
    }

    // Decode base64 PCM → WAV
    const base64 = part.inlineData.data
    const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

    // Gemini returns 24kHz Linear16 mono PCM
    const wavBlob = pcmToWav(raw, 24000)
    const duration = await getAudioDuration(wavBlob)

    return { audio: { audioBlob: wavBlob, duration }, shouldTryNext: false }
  } catch (e: any) {
    if (e.name === 'AbortError' || e.message === 'Aborted') throw e
    return { audio: null, shouldTryNext: true, error: e.message }
  }
}

async function callGeminiTTS(
  text: string,
  signal?: AbortSignal
): Promise<SlideAudio | null> {
  const settings = getAISettings()
  const keys = getTTSApiKeys()
  const model = settings.ttsModel
  const voice = settings.ttsVoice

  if (keys.length === 0) {
    throw new Error('No TTS API keys configured. Please add them in Settings.')
  }

  const errors: string[] = []

  // Try keys starting from nextKeyIndex, wrapping around
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (nextKeyIndex + attempt) % keys.length
    const key = keys[idx]

    const result = await callGeminiTTSWithKey(text, key, model, voice, signal)

    if (result.audio) {
      // Advance to next key for round-robin distribution
      nextKeyIndex = (idx + 1) % keys.length
      return result.audio
    }

    if (result.error) {
      errors.push(`Key ${idx + 1}: ${result.error}`)
    }

    if (!result.shouldTryNext) break

    // Small delay before trying next key
    if (attempt < keys.length - 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  console.warn('All TTS keys failed:', errors.join('; '))
  return null
}

// ── Main export ──

export async function generateTTSForSlides(
  subtitles: string[],
  mode: TTSMode,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<(SlideAudio | null)[]> {
  if (mode === 'none') return subtitles.map(() => null)

  const results: (SlideAudio | null)[] = []

  for (let i = 0; i < subtitles.length; i++) {
    if (signal?.aborted) throw new Error('Aborted')

    const text = subtitles[i]?.trim()
    if (!text) {
      results.push(null)
      onProgress?.(i + 1, subtitles.length)
      continue
    }

    // Check cache
    const cacheKey = `gemini:${text}`
    const cached = ttsCache.get(cacheKey)
    if (cached) {
      results.push(cached)
      onProgress?.(i + 1, subtitles.length)
      continue
    }

    try {
      const audio = await callGeminiTTS(text, signal)

      if (audio) {
        ttsCache.set(cacheKey, audio)
      }
      results.push(audio)
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'Aborted') throw e
      console.warn(`TTS failed for slide ${i + 1}:`, e.message)
      results.push(null)
    }

    onProgress?.(i + 1, subtitles.length)

    if (i < subtitles.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}
