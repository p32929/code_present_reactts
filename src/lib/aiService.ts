import { getAISettings } from './aiSettings'
import type { RepoFile } from './repoParser'

export interface GeneratedSlide {
  title: string
  description: string
  subtitle: string
  code: string
  codeLanguage: string
}

export interface GeneratedPresentation {
  projectName: string
  slides: GeneratedSlide[]
}

const SYSTEM_PROMPT = `You are an expert code presenter. Analyze a code repository and create a concise, engaging presentation.

You MUST follow the EXACT output format below. Do NOT use JSON. Do NOT use markdown fences. Do NOT deviate from this structure.

=PROJECT_NAME=
Short project name
=SLIDE=
-TITLE-
Short punchy title (3-6 words max)
-DESCRIPTION-
One short sentence (under 15 words)
-SUBTITLE-
Casual narration (2-3 short sentences, like explaining to a friend)
-CODE-
Code snippet from actual source files, or leave empty
-CODE_LANGUAGE-
language name (e.g. typescript, python, go)
=SLIDE=
-TITLE-
...next slide...

RULES:
- TITLE: 3-6 words. Punchy. No jargon. No parentheses. No class names.
- DESCRIPTION: ONE sentence, under 15 words.
- SUBTITLE: 2-3 casual sentences. Like explaining to a friend over coffee.
- CODE: Under 20 lines, from actual source files only — never invent code. MOST slides should have code.
- 8-15 slides. First slide = overview (no code). Last slide = takeaways (no code). All other slides MUST have code.
- EVERY slide must be interesting and meaningful. No filler slides about boring stuff like env parsing, file reading, or basic config loading. Focus on the unique, clever, or important parts of the project that make someone go "oh that's cool".

EXAMPLE OUTPUT (follow this exact structure):

=PROJECT_NAME=
WeatherCLI
=SLIDE=
-TITLE-
What is WeatherCLI?
-DESCRIPTION-
A tiny command-line tool that fetches weather data.
-SUBTITLE-
So this is a simple CLI app. You give it a city name and it hits a weather API and prints the forecast. Pretty handy!
-CODE-

-CODE_LANGUAGE-

=SLIDE=
-TITLE-
Fetching the Data
-DESCRIPTION-
Uses the OpenWeather API with a simple GET request.
-SUBTITLE-
The core logic is just one fetch call. It grabs the API key from an env var and hits the endpoint. Nothing fancy but it works great.
-CODE-
async function getWeather(city) {
  const res = await fetch(
    \`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${API_KEY}\`
  );
  return res.json();
}
-CODE_LANGUAGE-
javascript
=SLIDE=
-TITLE-
Key Takeaways
-DESCRIPTION-
Simple, focused, and gets the job done.
-SUBTITLE-
It's a clean little project. No over-engineering, just a focused tool that does one thing well. Love that about it.
-CODE-

-CODE_LANGUAGE-

Now analyze the code repository below and generate the presentation following this EXACT format.`

async function callWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options)
    if (res.status === 429) {
      const delay = Math.pow(2, attempt) * 1000
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw new Error('Rate limit exceeded. Please try again later.')
}

function normalizeDelimiters(raw: string): string {
  let text = raw.trim()

  // Strip markdown fences
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  // Normalize triple/double delimiters to single: ===SLIDE=== -> =SLIDE=, ---TITLE--- -> -TITLE-
  text = text.replace(/={2,}([\w]+)={2,}/g, '=$1=')
  text = text.replace(/-{2,}([\w]+)-{2,}/g, '-$1-')

  return text
}

function extractProjectName(header: string): string {
  // 1. =PROJECT_NAME=\nThe Name
  const exactMatch = header.match(/=PROJECT_NAME=\s*\n([\s\S]*)/)
  if (exactMatch && exactMatch[1].trim()) return exactMatch[1].trim()

  // 2. =Some Project Name= (name inside delimiters)
  const inlineMatch = header.match(/=([^=]+)=/)
  if (inlineMatch && inlineMatch[1].trim() !== 'PROJECT_NAME') return inlineMatch[1].trim()

  // 3. Just use whatever non-delimiter text is there
  const cleaned = header.replace(/=+/g, '').replace(/-+/g, '').replace(/PROJECT_NAME/gi, '').trim()
  if (cleaned) return cleaned

  return 'Untitled Presentation'
}

function parseSlideBlock(block: string): GeneratedSlide | null {
  const trimmed = block.trim()
  if (!trimmed) return null

  // Split block into lines, then walk through collecting fields
  const lines = trimmed.split('\n')
  const fields: Record<string, string[]> = {}
  let currentField = ''

  for (const line of lines) {
    // Check if this line is a field marker like -TITLE- or ---TITLE---
    const markerMatch = line.match(/^-{1,3}([A-Z_]+)-{1,3}\s*$/)
    if (markerMatch) {
      currentField = markerMatch[1].toUpperCase()
      fields[currentField] = []
    } else if (currentField) {
      fields[currentField].push(line)
    }
  }

  // Join lines for each field and trim
  const get = (name: string) => (fields[name] || []).join('\n').trim()

  const title = get('TITLE')
  if (!title) return null

  return {
    title,
    description: get('DESCRIPTION'),
    subtitle: get('SUBTITLE'),
    code: get('CODE'),
    codeLanguage: get('CODE_LANGUAGE') || 'javascript',
  }
}

function tryParseJSON(content: string): GeneratedPresentation | null {
  try {
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    const parsed = JSON.parse(jsonStr)
    if (parsed.projectName && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      return {
        projectName: parsed.projectName,
        slides: parsed.slides.map((s: any) => ({
          title: s.title || '',
          description: s.description || '',
          subtitle: s.subtitle || '',
          code: s.code || '',
          codeLanguage: s.codeLanguage || 'javascript',
        })),
      }
    }
  } catch {}
  return null
}

function parseDelimiterFormat(content: string): GeneratedPresentation {
  // If the AI ignored us and returned JSON anyway, handle it
  const jsonResult = tryParseJSON(content)
  if (jsonResult) return jsonResult

  const text = normalizeDelimiters(content)

  // Find first slide marker (case-insensitive)
  const slideMarker = /=SLIDE=/i
  const firstMatch = text.match(slideMarker)
  if (!firstMatch || firstMatch.index === undefined) {
    throw new Error('No slides found in AI response. Please try again.')
  }

  const header = text.slice(0, firstMatch.index).trim()
  const projectName = extractProjectName(header)

  // Split on =SLIDE= (case-insensitive)
  const slideBlocks = text.split(/=SLIDE=/i).slice(1)

  const slides: GeneratedSlide[] = []
  for (const block of slideBlocks) {
    const slide = parseSlideBlock(block)
    if (slide) slides.push(slide)
  }

  if (slides.length === 0) {
    throw new Error('No valid slides found in AI response. Please try again.')
  }

  return { projectName, slides }
}

export async function generatePresentation(
  files: RepoFile[],
  signal?: AbortSignal
): Promise<GeneratedPresentation> {
  const settings = getAISettings()

  if (!settings.textGenBaseUrl || !settings.textGenApiKey) {
    throw new Error('Text generation API settings are not configured. Please set the base URL and API key in settings.')
  }

  if (!settings.textGenModel) {
    throw new Error('Text generation model is not configured. Please set the model name in settings (e.g. gpt-4o-mini).')
  }

  // Build the code context with file listing first
  const fileList = files.map((f) => f.path).join('\n')
  const codeContext = files
    .map((f) => `===== ${f.path} =====\n${f.content}`)
    .join('\n\n')

  const userMessage = `I have a code repository with ${files.length} files. Analyze all the source code below, understand the project architecture, and create a presentation about it.

FILE LISTING:
${fileList}

SOURCE CODE:
${codeContext}`

  const res = await callWithRetry(
    `${settings.textGenBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.textGenApiKey}`,
      },
      body: JSON.stringify({
        model: settings.textGenModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      }),
      signal,
    }
  )

  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid API key. Please check your settings.')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Could not connect to the API. Status: ${res.status}. ${text}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('The AI response was empty. Please try again.')
  }

  return parseDelimiterFormat(content)
}
