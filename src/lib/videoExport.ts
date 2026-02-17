import type { PresentationPage } from './database'
import type { SlideAudio } from './ttsService'

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

  // Dynamic imports — only loaded when export is actually triggered
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

const DEFAULT_SLIDE_DURATION = 4 // seconds for slides without audio

export interface ExportOptions {
  pages: PresentationPage[]
  slideAudios: (SlideAudio | null)[] | null
  resolution: '1080p' | '720p'
  slideDelay: number // seconds of pause between slides
  onProgress?: (step: string, progress: number) => void
  onLog?: (msg: string) => void
  signal?: AbortSignal
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function renderSlideToCanvas(
  page: PresentationPage,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  const pad = 80
  const contentWidth = width - pad * 2
  let y = height * 0.15

  // Title
  if (page.title) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const lines = wrapText(ctx, page.title, contentWidth)
    for (const line of lines) {
      ctx.fillText(line, width / 2, y)
      y += 68
    }
    y += 12
  }

  // Description
  if (page.description) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '32px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const lines = wrapText(ctx, page.description, contentWidth)
    for (const line of lines) {
      ctx.fillText(line, width / 2, y)
      y += 42
    }
    y += 20
  }

  // Code block
  if (page.code) {
    const codeLines = page.code.split('\n').slice(0, 20)
    const codeFontSize = 18
    const lineHeight = codeFontSize * 1.6
    const codeBlockH = codeLines.length * lineHeight + 40
    const codeBlockW = contentWidth
    const codeX = pad
    const codeY = y

    // Code background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
    const r = 12
    ctx.beginPath()
    ctx.moveTo(codeX + r, codeY)
    ctx.lineTo(codeX + codeBlockW - r, codeY)
    ctx.quadraticCurveTo(codeX + codeBlockW, codeY, codeX + codeBlockW, codeY + r)
    ctx.lineTo(codeX + codeBlockW, codeY + codeBlockH - r)
    ctx.quadraticCurveTo(codeX + codeBlockW, codeY + codeBlockH, codeX + codeBlockW - r, codeY + codeBlockH)
    ctx.lineTo(codeX + r, codeY + codeBlockH)
    ctx.quadraticCurveTo(codeX, codeY + codeBlockH, codeX, codeY + codeBlockH - r)
    ctx.lineTo(codeX, codeY + r)
    ctx.quadraticCurveTo(codeX, codeY, codeX + r, codeY)
    ctx.closePath()
    ctx.fill()

    // Code text
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `${codeFontSize}px ui-monospace, "Cascadia Code", "Fira Code", monospace`
    ctx.textAlign = 'left'
    let codeTextY = codeY + 28
    for (const line of codeLines) {
      ctx.fillText(line, codeX + 20, codeTextY, codeBlockW - 40)
      codeTextY += lineHeight
    }

    y = codeY + codeBlockH + 24
  }

  // Subtitle
  if (page.subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = 'italic 24px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const lines = wrapText(ctx, page.subtitle, contentWidth)
    for (const line of lines) {
      ctx.fillText(line, width / 2, y)
      y += 34
    }
  }

  return canvas
}

async function renderSlideToImage(
  page: PresentationPage,
  width: number,
  height: number
): Promise<Uint8Array> {
  const canvas = renderSlideToCanvas(page, width, height)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  )

  return new Uint8Array(await blob.arrayBuffer())
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

  onProgress?.('Loading video encoder...', 0)

  const ffmpeg = await getFFmpeg(onLog)

  if (signal?.aborted) throw new Error('Aborted')

  // Render each slide to PNG
  onProgress?.('Rendering slides...', 10)

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new Error('Aborted')

    const imgData = await renderSlideToImage(pages[i], width, height)
    await ffmpeg.writeFile(`slide_${i}.png`, imgData)

    const progress = 10 + (60 * (i + 1)) / pages.length
    onProgress?.('Rendering slides...', progress)
  }

  if (signal?.aborted) throw new Error('Aborted')

  // Write audio files if present
  const hasAudio = slideAudios && slideAudios.some((a) => a !== null)

  if (hasAudio && slideAudios) {
    onProgress?.('Processing audio...', 70)
    for (let i = 0; i < slideAudios.length; i++) {
      const audio = slideAudios[i]
      if (audio) {
        const audioData = await fetchFileFn(new Blob([audio.audioBlob]))
        await ffmpeg.writeFile(`audio_${i}.mp3`, audioData)
      }
    }
  }

  if (signal?.aborted) throw new Error('Aborted')

  // Build FFmpeg concat file
  onProgress?.('Encoding video...', 75)

  let concatContent = ''
  for (let i = 0; i < pages.length; i++) {
    const audioDur = slideAudios?.[i]?.duration || DEFAULT_SLIDE_DURATION
    const duration = audioDur + slideDelay
    concatContent += `file 'slide_${i}.png'\n`
    concatContent += `duration ${duration}\n`
  }
  // Add last slide again (required by concat demuxer)
  concatContent += `file 'slide_${pages.length - 1}.png'\n`

  await ffmpeg.writeFile('concat.txt', concatContent)

  // Encode video
  if (hasAudio && slideAudios) {
    // Create a list file for audio concatenation
    let audioFilterParts: string[] = []
    let audioInputs: string[] = []
    let inputIndex = 1 // 0 is the video concat

    for (let i = 0; i < slideAudios.length; i++) {
      const audio = slideAudios[i]
      const duration = (audio?.duration || DEFAULT_SLIDE_DURATION) + slideDelay

      if (audio) {
        audioInputs.push('-i', `audio_${i}.mp3`)
        audioFilterParts.push(`[${inputIndex}:a]apad=pad_dur=0[a${i}]`)
        inputIndex++
      } else {
        audioFilterParts.push(`anullsrc=r=44100:cl=stereo,atrim=0:${duration}[a${i}]`)
      }
    }

    // Simpler approach: encode video first, then merge with concatenated audio
    // First: video only
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
      '-vf', `scale=${width}:${height}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-y', 'video_only.mp4',
    ])

    // Create silent audio track for slides without audio and concat all
    let audioConcat = ''
    for (let i = 0; i < slideAudios.length; i++) {
      const audio = slideAudios[i]

      if (audio) {
        audioConcat += `file 'audio_${i}.mp3'\n`
        // Add silence gap after audio for slide delay
        if (slideDelay > 0) {
          await ffmpeg.exec([
            '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
            '-t', `${slideDelay}`,
            '-c:a', 'aac',
            '-y', `gap_${i}.aac`,
          ])
          audioConcat += `file 'gap_${i}.aac'\n`
        }
      } else {
        const duration = DEFAULT_SLIDE_DURATION + slideDelay
        await ffmpeg.exec([
          '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
          '-t', `${duration}`,
          '-c:a', 'aac',
          '-y', `silence_${i}.aac`,
        ])
        audioConcat += `file 'silence_${i}.aac'\n`
      }
    }

    await ffmpeg.writeFile('audio_concat.txt', audioConcat)

    // Concat audio
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'audio_concat.txt',
      '-c:a', 'aac',
      '-y', 'audio_full.aac',
    ])

    // Merge video + audio
    await ffmpeg.exec([
      '-i', 'video_only.mp4',
      '-i', 'audio_full.aac',
      '-c:v', 'copy', '-c:a', 'aac',
      '-shortest',
      '-y', 'output.mp4',
    ])
  } else {
    // Video only, no audio
    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
      '-vf', `scale=${width}:${height}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-y', 'output.mp4',
    ])
  }

  onProgress?.('Finalizing...', 95)

  const data = await ffmpeg.readFile('output.mp4')
  const mp4Blob = new Blob([data], { type: 'video/mp4' })

  // Cleanup
  for (let i = 0; i < pages.length; i++) {
    try { await ffmpeg.deleteFile(`slide_${i}.png`) } catch {}
  }
  try { await ffmpeg.deleteFile('concat.txt') } catch {}
  try { await ffmpeg.deleteFile('output.mp4') } catch {}
  try { await ffmpeg.deleteFile('video_only.mp4') } catch {}
  try { await ffmpeg.deleteFile('audio_full.aac') } catch {}
  try { await ffmpeg.deleteFile('audio_concat.txt') } catch {}

  onProgress?.('Complete!', 100)
  return mp4Blob
}
