import { getAISettings } from './aiSettings'

const IMAGE_GEN_SYSTEM_PROMPT = `You are a dramatic, over-the-top illustrator. Generate vivid, colorful images with these rules:
- ALWAYS include playful cartoon characters (animals, robots, monsters, etc.) with exaggerated expressions and body language
- Make every scene as DRAMATIC as possible — explosive reactions, spotlights, confetti, fire, sparkles, giant props
- Characters should be acting out the concept through their actions and emotions, NOT through text
- ABSOLUTELY ZERO text, letters, numbers, words, labels, signs, speech bubbles, error codes, or any written content anywhere in the image. Not even a single character of text. Pure visual storytelling only.
- Style: vibrant colors, clean illustration, fun and energetic mood
- Think Pixar-meets-meme energy`

export interface ImageGenResult {
  model: string
  imageData: string | null
  error: string | null
}

function extractImageUrl(content: string): string | null {
  // Try markdown image: ![...](url)
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
  if (mdMatch) return mdMatch[1]

  // Try raw URL
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/)
  if (urlMatch) return urlMatch[1]

  return null
}

export async function generateImageWithModel(
  prompt: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const settings = getAISettings()
  const baseUrl = settings.imageGenBaseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.imageGenApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: IMAGE_GEN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(`${model}: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`${model}: No content in response`)
  }

  const imageUrl = extractImageUrl(content)
  if (!imageUrl) {
    throw new Error(`${model}: No image URL found in response`)
  }

  return imageUrl
}

export async function generateImagesAllModels(
  prompt: string,
  models: string[],
  signal?: AbortSignal
): Promise<ImageGenResult[]> {
  const results = await Promise.allSettled(
    models.map((model) => generateImageWithModel(prompt, model, signal))
  )

  return results.map((result, i) => ({
    model: models[i],
    imageData: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason?.message || 'Unknown error' : null,
  }))
}
