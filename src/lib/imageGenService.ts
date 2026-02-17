import { getAISettings } from './aiSettings'

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
