import { getAISettings } from './aiSettings'
import type { RepoFile } from './repoParser'

export interface GeneratedSlide {
  title: string
  description: string
  subtitle: string
  code: string
  codeLanguage: string
  image: string
}

export interface GeneratedPresentation {
  projectName: string
  slides: GeneratedSlide[]
}

const SYSTEM_PROMPT = `You are a witty, funny, relatable tech content creator making short-form video scripts. Think popular dev YouTubers / TikTokers — high energy, memes, humor, real talk. You make people laugh, nod, and think "that's SO me". Analyze a code repository and create an entertaining, beginner-friendly presentation.

You MUST follow the EXACT output format below. Do NOT use JSON. Do NOT use markdown fences. Do NOT deviate from this structure.

=PROJECT_NAME=
Short project name
=SLIDE=
-TITLE-
Short punchy title (3-6 words max)
-DESCRIPTION-
One short sentence (under 15 words)
-SUBTITLE-
Narration script (2-4 sentences — funny, relatable, conversational)
-CODE-
Only simple commands (install, run, setup) or leave empty
-CODE_LANGUAGE-
bash or leave empty
-IMAGE-
A description of what image/screenshot should go here, or leave empty
=SLIDE=
-TITLE-
...next slide...

VIBE & TONE:
- You're that one friend who finds cool projects and can't shut up about them.
- Use humor. Roast common dev struggles. "You know that feeling when you spend 3 hours on something that should take 5 minutes? Yeah, this tool fixes that."
- Make people RELATE. Reference everyday dev pain points: dependency hell, config nightmares, "it works on my machine", spending more time setting up than coding, etc.
- Paint scenarios: "Imagine you're at 2am, deadline tomorrow, and you need X. This is your new best friend."
- Drop casual reactions: "Wait, it does THAT too?", "Okay this is actually insane", "Why did nobody tell me about this sooner?"
- Be genuinely excited, not fake-corporate-excited.
- Sprinkle in subtle engagement hooks naturally throughout:
  * "Drop a comment if you've been stuck on this before"
  * "Be honest — how many of you are still doing this the hard way?"
  * "Save this for later, trust me"
  * "Share this with that one friend who still does X manually"
  * "If this blew your mind, smash that like"
  * Weave these in where they fit naturally — NOT on every slide, and NEVER forced.

RULES:
- TITLE: 3-6 words. Punchy. Can be funny or intriguing. No jargon. No class names.
- DESCRIPTION: ONE sentence, under 15 words. Snappy.
- SUBTITLE: 2-4 sentences. This is the NARRATION SCRIPT — what a voiceover would say. Conversational, funny, relatable. Use rhetorical questions, hot takes, and real-world analogies. Encourage people to try it.
- CODE: ONLY simple terminal commands (install, clone, run). NEVER actual source code. If no command needed, leave empty.
- IMAGE: Describe what visual should appear (screenshot, diagram, meme-style comparison, before/after). MOST slides should have an image. If slide has CODE, leave IMAGE empty.
- 8-15 slides total.
- Slide 1 = hook. Grab attention IMMEDIATELY. Ask a relatable question or drop a bold claim. Include an image description.
- Slide 2-3 = "what is this thing" and "why should I care" — keep it fun.
- Middle slides = how to get it running + what you'll see. Mix commands and visuals.
- Second-to-last slide = the "mind blown" moment or coolest feature.
- Last slide = call to action. Encourage trying it, commenting thoughts, sharing with friends. Make it feel natural, not salesy.
- Keep text MINIMAL. Say only what's necessary. Be punchy.
- Explain like the viewer might be a beginner — but don't be condescending. Be the cool senior dev, not the boring professor.
- Do NOT explain internal code architecture, design patterns, or implementation details.
- Focus on: what problem it solves, how fast you can get it running, the "wow that's cool" moments, and why the viewer should care.

EXAMPLE OUTPUT (follow this exact structure):

=PROJECT_NAME=
WeatherCLI
=SLIDE=
-TITLE-
Stop Googling The Weather
-DESCRIPTION-
Check weather from your terminal like a boss.
-SUBTITLE-
Okay real talk — how many browser tabs do you have open right now? Exactly. What if you could just check the weather without opening yet another one? This little CLI tool does exactly that and it's ridiculously simple.
-CODE-

-CODE_LANGUAGE-

-IMAGE-
Split screen: left side shows 47 open browser tabs, right side shows a clean terminal with weather data in one line
=SLIDE=
-TITLE-
One Minute Setup, Seriously
-DESCRIPTION-
Clone, install, done. No config drama.
-SUBTITLE-
You know those projects where the setup takes longer than actually using the thing? Yeah, this isn't one of those. Three commands. That's it. No config files, no environment variables, no sacrificing a goat to the npm gods.
-CODE-
git clone https://github.com/user/weather-cli
cd weather-cli
npm install
-CODE_LANGUAGE-
bash
-IMAGE-

=SLIDE=
-TITLE-
Just Ask For Weather
-DESCRIPTION-
Type a city, get the forecast. Done.
-SUBTITLE-
This is the entire workflow. One command. You type a city, it gives you the weather. No API keys to set up, no OAuth dance, nothing. If you can type, you can use this. Be honest — when's the last time something just worked on the first try?
-CODE-
npx weather-cli London
-CODE_LANGUAGE-
bash
-IMAGE-

=SLIDE=
-TITLE-
Look At This Output
-DESCRIPTION-
Clean, colorful, actually readable.
-SUBTITLE-
And it doesn't just dump raw JSON at you like some kind of monster. Look at this — colors, icons, clean formatting. It's giving main character energy. Your terminal has never looked this good.
-CODE-

-CODE_LANGUAGE-

-IMAGE-
Terminal output showing beautifully formatted weather data with colorful temperature display, weather icons, humidity and wind speed for London
=SLIDE=
-TITLE-
Now Go Try It
-DESCRIPTION-
Seriously, it takes 60 seconds.
-SUBTITLE-
Look, you've watched this far so clearly you're interested. Just go try it. Takes literally a minute. And if you found this useful, share it with a friend who's still checking weather like a normie. Drop a comment with your city — let's see where everyone's watching from!
-CODE-
npx weather-cli YourCity
-CODE_LANGUAGE-
bash
-IMAGE-

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
    codeLanguage: get('CODE_LANGUAGE') || 'bash',
    image: get('IMAGE'),
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
          codeLanguage: s.codeLanguage || 'bash',
          image: s.image || '',
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
