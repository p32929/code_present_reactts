import { getAISettings } from './aiSettings'

export interface SlideAudio {
  audioBlob: Blob
  duration: number // seconds
}

// In-memory cache: subtitle text -> generated audio
const ttsCache = new Map<string, SlideAudio>()

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

async function callTTS(
  text: string,
  voiceId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<SlideAudio | null> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal,
    }
  )

  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid ElevenLabs API key. Please check your settings.')
  }

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3000))
    const retryRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal,
      }
    )
    if (!retryRes.ok) return null
    const blob = await retryRes.blob()
    const duration = await getAudioDuration(blob)
    return { audioBlob: blob, duration }
  }

  if (res.ok) {
    const blob = await res.blob()
    const duration = await getAudioDuration(blob)
    return { audioBlob: blob, duration }
  }

  return null
}

export async function generateTTSForSlides(
  subtitles: string[],
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<(SlideAudio | null)[]> {
  const settings = getAISettings()

  if (!settings.elevenLabsApiKey) {
    throw new Error('ElevenLabs API key is not configured.')
  }

  const voiceId = settings.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM'
  const results: (SlideAudio | null)[] = []

  for (let i = 0; i < subtitles.length; i++) {
    if (signal?.aborted) throw new Error('Aborted')

    const text = subtitles[i]?.trim()
    if (!text) {
      results.push(null)
      onProgress?.(i + 1, subtitles.length)
      continue
    }

    // Check cache first
    const cached = ttsCache.get(text)
    if (cached) {
      results.push(cached)
      onProgress?.(i + 1, subtitles.length)
      continue
    }

    try {
      const audio = await callTTS(text, voiceId, settings.elevenLabsApiKey, signal)
      if (audio) {
        ttsCache.set(text, audio)
      }
      results.push(audio)
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'Aborted') throw e
      if (e.message.includes('Invalid ElevenLabs')) throw e
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
