import type { PresentationPage } from './database'
import type { SlideAudio } from './ttsService'
import html2canvas from 'html2canvas'

let ffmpegInstance: any = null
let fetchFileFn: any = null

async function createBlobURL(url: string, mimeType: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = await res.arrayBuffer()
  const blob = new Blob([buf], { type: mimeType })
  return URL.createObjectURL(blob)
}

async function getFFmpeg(
  onLog?: (msg: string) => void
) {
  if (ffmpegInstance?.loaded) return ffmpegInstance

  const [{ FFmpeg }, { fetchFile }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])

  fetchFileFn = fetchFile

  const ffmpeg = new FFmpeg()

  if (onLog) {
    ffmpeg.on('log', ({ message }: { message: string }) => onLog(message))
  }

  const coreURL = await createBlobURL('/ffmpeg-core.js', 'text/javascript')
  const wasmURL = await createBlobURL('/ffmpeg-core.wasm', 'application/wasm')
  await ffmpeg.load({ coreURL, wasmURL })

  ffmpegInstance = ffmpeg
  return ffmpeg
}

const DEFAULT_SLIDE_DURATION = 4

// ── Settings helpers (match Play.tsx exactly) ──

interface PresentationSettings {
  titleTopSpacing: number
  descriptionTitleSpacing: number
  imageDescriptionSpacing: number
  codeImageSpacing: number
  subtitleSpacing: number
  titleFontSize: number
  descriptionFontSize: number
  subtitleFontSize: number
}

function getSettings(): PresentationSettings {
  const get = (key: string, def: number) => {
    const v = localStorage.getItem(`presentation-settings-${key}`)
    return v ? Number(v) : def
  }
  return {
    titleTopSpacing: get('titleTopSpacing', 8),
    descriptionTitleSpacing: get('descriptionTitleSpacing', 6),
    imageDescriptionSpacing: get('imageDescriptionSpacing', 6),
    codeImageSpacing: get('codeImageSpacing', 6),
    subtitleSpacing: get('subtitleSpacing', 8),
    titleFontSize: get('titleFontSize', 5),
    descriptionFontSize: get('descriptionFontSize', 5),
    subtitleFontSize: get('subtitleFontSize', 4),
  }
}

// Convert Tailwind spacing values → px  (mt-N uses 0.25rem * N, 1rem = 16px)
function spacingPx(val: number): number {
  const map: Record<number, number> = {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28,
    8: 32, 9: 36, 10: 40, 11: 44, 12: 48, 14: 56, 16: 64, 20: 80, 24: 96,
  }
  const keys = Object.keys(map).map(Number).sort((a, b) => a - b)
  const closest = keys.reduce((prev, curr) =>
    Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
  )
  return map[closest] ?? 32
}

// Font size maps – at ≥1024px width we always hit the "lg:" variant
function titleFontPx(sizeValue: number): number {
  const map: Record<number, number> = {
    1: 30, 2: 36, 3: 48, 4: 60, 5: 72, 6: 96, 7: 128, 8: 128, 9: 128, 10: 128,
  }
  return map[sizeValue] ?? 72
}

function descFontPx(sizeValue: number): number {
  const map: Record<number, number> = {
    1: 18, 2: 20, 3: 24, 4: 30, 5: 36, 6: 48, 7: 60, 8: 72, 9: 96, 10: 128,
  }
  return map[sizeValue] ?? 36
}

function subtitleFontPx(sizeValue: number): number {
  const map: Record<number, number> = {
    1: 16, 2: 18, 3: 20, 4: 24, 5: 30, 6: 36, 7: 48, 8: 60, 9: 72, 10: 96,
  }
  return map[sizeValue] ?? 24
}

// ── Slide → DOM → html2canvas → PNG ──

function isImageSrc(src: string): boolean {
  return (
    src.startsWith('http') ||
    src.startsWith('data:image') ||
    src.startsWith('/') ||
    src.startsWith('./')
  )
}

async function renderSlideToImage(
  page: PresentationPage,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const s = getSettings()

  // Use an iframe to isolate from page CSS (Tailwind CSS 4 uses oklch colors
  // which html2canvas cannot parse)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;border:none;overflow:hidden;`
  document.body.appendChild(iframe)

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve()
    setTimeout(resolve, 200)
  })

  const doc = iframe.contentDocument!
  doc.body.style.cssText = 'margin:0;padding:0;overflow:hidden;'

  // ── Outer wrapper (matches Play.tsx root div) ──
  const root = doc.createElement('div')
  root.style.cssText = `width:${width}px;height:${height}px;background:#000;color:#fff;display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;`

  // ── Content area (matches flex-1 container in Play) ──
  const content = doc.createElement('div')
  content.style.cssText = `flex:1;display:flex;flex-direction:column;justify-content:center;padding:${height * 0.06}px ${width * 0.04}px ${height * 0.1}px;overflow:hidden;max-width:${Math.min(width * 0.8, 1152)}px;margin:0 auto;width:100%;`

  // ── Title ──
  if (page.title) {
    const el = doc.createElement('h1')
    el.textContent = page.title
    el.style.cssText = `font-size:${titleFontPx(s.titleFontSize)}px;font-weight:bold;text-align:center;color:#fff;line-height:1.15;text-transform:capitalize;margin:0;margin-top:${spacingPx(s.titleTopSpacing)}px;flex-shrink:0;`
    content.appendChild(el)
  }

  // ── Description ──
  if (page.description) {
    const el = doc.createElement('p')
    el.textContent = page.description
    el.style.cssText = `font-size:${descFontPx(s.descriptionFontSize)}px;text-align:center;color:rgba(255,255,255,0.9);line-height:1.5;text-transform:capitalize;margin:0;margin-top:${spacingPx(s.descriptionTitleSpacing)}px;max-width:${Math.min(width * 0.7, 1024)}px;align-self:center;flex-shrink:0;`
    content.appendChild(el)
  }

  // ── Image ──
  if (page.image) {
    const wrapper = doc.createElement('div')
    wrapper.style.cssText = `display:flex;justify-content:center;margin-top:${spacingPx(s.imageDescriptionSpacing)}px;flex:1;min-height:0;align-items:center;`

    if (isImageSrc(page.image)) {
      const img = doc.createElement('img')
      img.crossOrigin = 'anonymous'
      img.src = page.image
      img.style.cssText = `max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);`
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
        setTimeout(() => resolve(), 5000)
      })
      wrapper.appendChild(img)
    } else {
      const box = doc.createElement('div')
      box.style.cssText = `max-width:${Math.min(width * 0.65, 900)}px;padding:32px;background:rgba(255,255,255,0.1);border-radius:12px;border:1px solid rgba(255,255,255,0.2);color:#fff;text-align:center;word-break:break-word;`
      const pre = doc.createElement('pre')
      pre.textContent = page.image
      pre.style.cssText = `white-space:pre-wrap;font-family:ui-monospace,"Cascadia Code","Fira Code",monospace;font-size:14px;line-height:1.6;margin:0;`
      box.appendChild(pre)
      wrapper.appendChild(box)
    }
    content.appendChild(wrapper)
  }

  // ── Code ──
  if (page.code) {
    const codeWrapper = doc.createElement('div')
    codeWrapper.style.cssText = `border-radius:12px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);margin-top:${spacingPx(s.codeImageSpacing)}px;flex:1;min-height:0;display:flex;flex-direction:column;`

    const pre = doc.createElement('pre')
    pre.style.cssText = `margin:0;padding:24px;font-family:ui-monospace,"Cascadia Code","Fira Code","Droid Sans Mono",monospace;font-size:${Math.max(14, Math.min(18, width / 110))}px;line-height:1.5;background:rgba(15,23,42,0.98);color:#d4d4d4;overflow:hidden;flex:1;white-space:pre;tab-size:2;`

    const lines = page.code.split('\n')
    const numberedCode = doc.createElement('div')
    numberedCode.style.cssText = `display:flex;`

    const lineNums = doc.createElement('div')
    lineNums.style.cssText = `text-align:right;padding-right:16px;border-right:1px solid rgba(255,255,255,0.1);margin-right:16px;color:rgba(255,255,255,0.3);user-select:none;flex-shrink:0;`
    lineNums.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('')

    const codeBody = doc.createElement('div')
    codeBody.style.cssText = `flex:1;overflow:hidden;`
    codeBody.innerHTML = highlightCode(page.code, page.codeLanguage || 'javascript')

    pre.appendChild(numberedCode)
    numberedCode.appendChild(lineNums)
    numberedCode.appendChild(codeBody)

    codeWrapper.appendChild(pre)
    content.appendChild(codeWrapper)
  }

  // ── Subtitle ──
  if (page.subtitle) {
    const el = doc.createElement('p')
    el.textContent = page.subtitle
    el.style.cssText = `font-size:${subtitleFontPx(s.subtitleFontSize)}px;text-align:center;color:rgba(255,255,255,0.8);line-height:1.5;font-style:italic;margin:0;margin-top:${spacingPx(s.subtitleSpacing)}px;max-width:${Math.min(width * 0.65, 900)}px;align-self:center;flex-shrink:0;`
    content.appendChild(el)
  }

  // ── Empty slide ──
  if (!page.title && !page.description && !page.code && !page.image) {
    const empty = doc.createElement('div')
    empty.style.cssText = `text-align:center;color:rgba(255,255,255,0.4);flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;`
    empty.innerHTML = `
      <div style="width:96px;height:96px;border-radius:50%;border:2px dashed rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
      <div style="font-size:36px;font-weight:bold;margin-bottom:16px;">Empty Slide</div>
      <div style="font-size:20px;">No content on this slide</div>
    `
    content.appendChild(empty)
  }

  root.appendChild(content)
  doc.body.appendChild(root)

  // Small delay to let images/fonts settle
  await new Promise((r) => setTimeout(r, 150))

  // ── Capture with html2canvas ──
  const canvas = await html2canvas(root, {
    width,
    height,
    scale: 1,
    backgroundColor: '#000000',
    useCORS: true,
    allowTaint: true,
    logging: false,
    // Use the iframe's window so html2canvas reads styles from the clean document
    windowWidth: width,
    windowHeight: height,
  })

  // Cleanup
  document.body.removeChild(iframe)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  )
  return new Uint8Array(await blob.arrayBuffer())
}

// ── Basic syntax highlighting (vscDarkPlus colors) ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightCode(code: string, _language: string): string {
  const escaped = escapeHtml(code)

  // Tokenize to avoid overlapping highlights
  const tokens: { start: number; end: number; color: string; text: string }[] = []
  const chars = escaped

  // Order matters: comments first, then strings, then keywords, then numbers
  const patterns: [RegExp, string][] = [
    // Block comments
    [/\/\*[\s\S]*?\*\//g, '#6A9955'],
    // Line comments
    [/\/\/.*/g, '#6A9955'],
    // Python/shell comments
    [/#[^\n]*/g, '#6A9955'],
    // Template literals
    [/`(?:[^`\\]|\\.)*`/g, '#CE9178'],
    // Double-quoted strings
    [/&quot;(?:[^&]|&(?!quot;))*?&quot;/g, '#CE9178'],
    // Single-quoted strings
    [/'(?:[^'\\]|\\.)*'/g, '#CE9178'],
    // Keywords
    [/\b(const|let|var|function|return|if|else|for|while|do|class|interface|type|enum|import|export|from|as|default|async|await|new|this|super|try|catch|finally|throw|switch|case|break|continue|null|undefined|true|false|void|typeof|instanceof|in|of|yield|delete|extends|implements|static|get|set|public|private|protected|readonly|abstract|override|def|self|elif|except|raise|with|lambda|pass|print|None|True|False|fn|let|mut|pub|use|mod|impl|trait|struct|match|where|loop|move|ref|unsafe|crate|macro)\b/g, '#569CD6'],
    // Decorators / annotations
    [/@\w+/g, '#DCDCAA'],
    // Function calls
    [/\b([a-zA-Z_]\w*)\s*(?=\()/g, '#DCDCAA'],
    // Numbers
    [/\b(\d+\.?\d*([eE][+-]?\d+)?|0[xX][0-9a-fA-F]+|0[bB][01]+)\b/g, '#B5CEA8'],
    // Types (PascalCase words)
    [/\b([A-Z][a-zA-Z0-9]*)\b/g, '#4EC9B0'],
  ]

  // Mark which character positions are already colored
  const colored = new Array(chars.length).fill(false)

  for (const [regex, color] of patterns) {
    let match
    regex.lastIndex = 0
    while ((match = regex.exec(chars)) !== null) {
      const start = match.index
      const end = start + match[0].length
      // Check overlap
      let overlap = false
      for (let i = start; i < end; i++) {
        if (colored[i]) { overlap = true; break }
      }
      if (!overlap) {
        tokens.push({ start, end, color, text: match[0] })
        for (let i = start; i < end; i++) colored[i] = true
      }
    }
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start)

  // Build highlighted HTML
  let result = ''
  let pos = 0
  for (const token of tokens) {
    if (token.start > pos) {
      result += chars.slice(pos, token.start)
    }
    result += `<span style="color:${token.color}">${token.text}</span>`
    pos = token.end
  }
  if (pos < chars.length) {
    result += chars.slice(pos)
  }

  return result
}

// ── Export options & main function ──

export interface ExportOptions {
  pages: PresentationPage[]
  slideAudios: (SlideAudio | null)[] | null
  resolution: '1080p' | '720p'
  slideDelay: number
  onProgress?: (step: string, progress: number) => void
  onLog?: (msg: string) => void
  signal?: AbortSignal
}

export async function exportToMP4(options: ExportOptions): Promise<Blob> {
  const {
    pages,
    slideAudios,
    resolution,
    slideDelay,
    onProgress,
    onLog,
    signal,
  } = options

  const width = resolution === '1080p' ? 1920 : 1280
  const height = resolution === '1080p' ? 1080 : 720

  onLog?.('[export] Loading video encoder (FFmpeg WASM)...')
  onProgress?.('Loading video encoder...', 0)

  const ffmpeg = await getFFmpeg(onLog)

  onLog?.('[export] FFmpeg loaded successfully')

  if (signal?.aborted) throw new Error('Aborted')

  // Render each slide to PNG via html2canvas
  onLog?.(`[export] Rendering ${pages.length} slides to PNG (${width}x${height})...`)
  onProgress?.('Rendering slides...', 10)

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new Error('Aborted')

    onLog?.(`[render] Slide ${i + 1}/${pages.length}: capturing...`)
    const imgData = await renderSlideToImage(pages[i], width, height)
    onLog?.(`[render] Slide ${i + 1}/${pages.length}: ${(imgData.byteLength / 1024).toFixed(0)}KB PNG written`)
    await ffmpeg.writeFile(`slide_${i}.png`, imgData)

    const progress = 10 + (60 * (i + 1)) / pages.length
    onProgress?.(`Rendering slide ${i + 1}/${pages.length}...`, progress)
  }

  if (signal?.aborted) throw new Error('Aborted')

  // Write audio files if present
  const hasAudio = slideAudios && slideAudios.some((a) => a !== null)

  if (hasAudio && slideAudios) {
    const audioCount = slideAudios.filter((a) => a !== null).length
    onLog?.(`[audio] Processing ${audioCount} audio clips, normalizing to 24kHz mono WAV...`)
    onProgress?.('Processing audio...', 70)

    for (let i = 0; i < slideAudios.length; i++) {
      const audio = slideAudios[i]
      if (audio) {
        onLog?.(`[audio] Slide ${i + 1}: ${audio.duration.toFixed(1)}s, ${(audio.audioBlob.size / 1024).toFixed(0)}KB`)
        const audioData = await fetchFileFn(new Blob([audio.audioBlob]))
        await ffmpeg.writeFile(`audio_raw_${i}.wav`, audioData)

        onLog?.(`[audio] Slide ${i + 1}: re-encoding to 24kHz mono PCM...`)
        await ffmpeg.exec([
          '-i', `audio_raw_${i}.wav`,
          '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le',
          '-y', `audio_${i}.wav`,
        ])

        try { await ffmpeg.deleteFile(`audio_raw_${i}.wav`) } catch {}
        onLog?.(`[audio] Slide ${i + 1}: done`)
      }
    }
  }

  if (signal?.aborted) throw new Error('Aborted')

  // Build FFmpeg concat file
  onLog?.('[encode] Building video concat list...')
  onProgress?.('Encoding video...', 75)

  let concatContent = ''
  for (let i = 0; i < pages.length; i++) {
    const audioDur = slideAudios?.[i]?.duration || DEFAULT_SLIDE_DURATION
    const duration = audioDur + slideDelay
    concatContent += `file 'slide_${i}.png'\n`
    concatContent += `duration ${duration}\n`
    onLog?.(`[encode] Slide ${i + 1}: duration=${duration.toFixed(1)}s (audio=${audioDur.toFixed(1)}s + delay=${slideDelay}s)`)
  }
  concatContent += `file 'slide_${pages.length - 1}.png'\n`

  await ffmpeg.writeFile('concat.txt', concatContent)

  if (hasAudio && slideAudios) {
    onLog?.('[encode] Encoding video track (H.264)...')
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
      '-vf', `scale=${width}:${height}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-y', 'video_only.mp4',
    ])
    onLog?.('[encode] Video track complete')

    // Build audio track: real audio + silence gaps (all 24kHz mono WAV)
    onLog?.('[encode] Building audio concat list...')
    let audioConcat = ''
    for (let i = 0; i < slideAudios.length; i++) {
      const audio = slideAudios[i]

      if (audio) {
        audioConcat += `file 'audio_${i}.wav'\n`
        if (slideDelay > 0) {
          onLog?.(`[encode] Generating ${slideDelay}s silence gap for slide ${i + 1}...`)
          await ffmpeg.exec([
            '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
            '-t', `${slideDelay}`,
            '-c:a', 'pcm_s16le',
            '-y', `gap_${i}.wav`,
          ])
          audioConcat += `file 'gap_${i}.wav'\n`
        }
      } else {
        const duration = DEFAULT_SLIDE_DURATION + slideDelay
        onLog?.(`[encode] Generating ${duration}s silence for slide ${i + 1} (no audio)...`)
        await ffmpeg.exec([
          '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
          '-t', `${duration}`,
          '-c:a', 'pcm_s16le',
          '-y', `silence_${i}.wav`,
        ])
        audioConcat += `file 'silence_${i}.wav'\n`
      }
    }

    await ffmpeg.writeFile('audio_concat.txt', audioConcat)

    onLog?.('[encode] Concatenating all audio segments → AAC...')
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'audio_concat.txt',
      '-c:a', 'aac', '-b:a', '128k',
      '-y', 'audio_full.aac',
    ])
    onLog?.('[encode] Audio track complete')

    onLog?.('[encode] Muxing video + audio → output.mp4...')
    await ffmpeg.exec([
      '-i', 'video_only.mp4',
      '-i', 'audio_full.aac',
      '-c:v', 'copy', '-c:a', 'aac',
      '-shortest',
      '-y', 'output.mp4',
    ])
    onLog?.('[encode] Muxing complete')
  } else {
    onLog?.('[encode] Encoding video (no audio)...')
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
      '-vf', `scale=${width}:${height}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-y', 'output.mp4',
    ])
    onLog?.('[encode] Video encoding complete')
  }

  onLog?.('[export] Reading output file...')
  onProgress?.('Finalizing...', 95)

  const data = await ffmpeg.readFile('output.mp4')
  const mp4Blob = new Blob([data], { type: 'video/mp4' })
  onLog?.(`[export] Done! Output size: ${(mp4Blob.size / (1024 * 1024)).toFixed(1)}MB`)

  // Cleanup
  for (let i = 0; i < pages.length; i++) {
    try { await ffmpeg.deleteFile(`slide_${i}.png`) } catch {}
    try { await ffmpeg.deleteFile(`audio_${i}.wav`) } catch {}
    try { await ffmpeg.deleteFile(`gap_${i}.wav`) } catch {}
    try { await ffmpeg.deleteFile(`silence_${i}.wav`) } catch {}
  }
  try { await ffmpeg.deleteFile('concat.txt') } catch {}
  try { await ffmpeg.deleteFile('output.mp4') } catch {}
  try { await ffmpeg.deleteFile('video_only.mp4') } catch {}
  try { await ffmpeg.deleteFile('audio_full.aac') } catch {}
  try { await ffmpeg.deleteFile('audio_concat.txt') } catch {}

  onProgress?.('Complete!', 100)
  return mp4Blob
}
