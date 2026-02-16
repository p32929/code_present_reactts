import { getAISettings } from './aiSettings'
import type { GeneratedSlide } from './aiService'

export interface SlideWithImage extends GeneratedSlide {
  image?: string
}

export async function generateImagesForSlides(
  slides: GeneratedSlide[],
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<SlideWithImage[]> {
  const settings = getAISettings()

  if (!settings.imageGenBaseUrl || !settings.imageGenApiKey || !settings.imageGenModel) {
    return slides
  }

  const slidesWithPrompts = slides
    .map((s, i) => ({ slide: s, index: i }))
    .filter((s) => s.slide.imagePrompt)

  if (slidesWithPrompts.length === 0) return slides

  const result: SlideWithImage[] = slides.map(s => ({ ...s }))
  let completed = 0

  for (const { slide, index } of slidesWithPrompts) {
    if (signal?.aborted) break

    try {
      const res = await fetch(
        `${settings.imageGenBaseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.imageGenApiKey}`,
          },
          body: JSON.stringify({
            model: settings.imageGenModel,
            messages: [
              {
                role: 'user',
                content: `Generate an image: ${slide.imagePrompt}`,
              },
            ],
          }),
          signal,
        }
      )

      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || ''

        // Extract image from response: base64 data URL or any https URL
        const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
        const urlMatch = content.match(/https?:\/\/[^\s)>"]+/)

        const imageUrl = b64Match?.[0] || urlMatch?.[0]
        if (imageUrl) {
          result[index].code = ''
          result[index].image = imageUrl
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') break
      console.warn(`Image generation failed for slide ${index + 1}:`, e.message)
    }

    completed++
    onProgress?.(completed, slidesWithPrompts.length)

    if (completed < slidesWithPrompts.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return result
}
