import { getAISettings } from './aiSettings'
import type { RepoFile } from './repoParser'

export interface GeneratedSlide {
  title: string
  description: string
  subtitle: string
  code: string
  codeLanguage: string
  imagePrompt?: string
}

export interface GeneratedPresentation {
  projectName: string
  slides: GeneratedSlide[]
}

const SYSTEM_PROMPT = `You are an expert code analyst and presentation generator. Your job is to deeply analyze source code from a repository, understand the project's purpose, architecture, and key components, then create a clear and insightful presentation about it.

ANALYSIS STEPS (do these mentally before generating slides):
1. Read every file provided and understand what the project does
2. Identify the tech stack, frameworks, and languages used
3. Map out the architecture: entry points, core modules, data flow, APIs
4. Find the most important/interesting code patterns and functions
5. Understand how the pieces fit together

OUTPUT FORMAT — use this EXACT delimiter-based format (NOT JSON):

===PROJECT_NAME===
The project name here
===SLIDE===
---TITLE---
Slide title here
---DESCRIPTION---
Brief description shown on slide (1-2 sentences)
---SUBTITLE---
Narration script: what a presenter would say explaining this slide (2-4 natural sentences)
---CODE---
A relevant code snippet copied from the actual source files, or leave empty
---CODE_LANGUAGE---
programming language for syntax highlighting (e.g. typescript, python, go)
---IMAGE_PROMPT---
Optional DALL-E prompt for a relevant illustration, or leave empty
===SLIDE===
---TITLE---
Next slide title
---DESCRIPTION---
...and so on for each slide...

SLIDE GUIDELINES:
- Create 8-15 slides that tell a coherent story about the project
- Slide 1: Project overview — what it does, why it exists, tech stack (no code)
- Slide 2: Project structure / architecture overview
- Middle slides: Walk through key components, important functions, data flow, APIs, configuration
- For each code slide, pick the MOST relevant snippet from the actual source files (under 30 lines, trimmed to the important part)
- Last slide: Summary, key takeaways, or notable design decisions
- Subtitles should sound like a knowledgeable developer explaining the project to a colleague
- Only use IMAGE_PROMPT for slides that truly benefit from a visual (architecture overview, data flow)
- IMPORTANT: All code in slides MUST come directly from the provided source files — never invent code
- Return ONLY the delimiter format above, no markdown fences, no JSON, no extra text`

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

function parseDelimiterFormat(content: string): GeneratedPresentation {
  const text = content.trim()

  // Extract project name
  const projectNameMatch = text.match(/===PROJECT_NAME===\s*\n([\s\S]*?)(?=\n===SLIDE===)/)
  if (!projectNameMatch) {
    throw new Error('Could not find project name in AI response. Please try again.')
  }
  const projectName = projectNameMatch[1].trim()

  // Split into slide blocks
  const slideBlocks = text.split('===SLIDE===').slice(1) // first element is before first SLIDE marker

  if (slideBlocks.length === 0) {
    throw new Error('No slides found in AI response. Please try again.')
  }

  const slides: GeneratedSlide[] = []

  for (const block of slideBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const getField = (name: string): string => {
      const regex = new RegExp(`---${name}---\\s*\\n([\\s\\S]*?)(?=\\n---[A-Z_]+---|$)`)
      const match = trimmed.match(regex)
      return match ? match[1].trim() : ''
    }

    const title = getField('TITLE')
    if (!title) continue // skip empty slides

    slides.push({
      title,
      description: getField('DESCRIPTION'),
      subtitle: getField('SUBTITLE'),
      code: getField('CODE'),
      codeLanguage: getField('CODE_LANGUAGE') || 'javascript',
      imagePrompt: getField('IMAGE_PROMPT') || undefined,
    })
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
