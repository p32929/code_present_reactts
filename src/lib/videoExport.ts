import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import html2canvas from 'html2canvas'
import type { PresentationPage } from './database'
import type { SlideAudio } from './ttsService'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance

  const ffmpeg = new FFmpeg()

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message))
  }

  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  })

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export interface ExportOptions {
  pages: PresentationPage[]
  slideAudios: (SlideAudio | null)[] | null
  resolution: '1080p' | '720p'
  defaultSlideDuration: number // seconds
  onProgress?: (step: string, progress: number) => void
  onLog?: (msg: string) => void
  signal?: AbortSignal
}

function createSlideElement(
  page: PresentationPage,
  width: number,
  height: number
): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.backgroundColor = '#000000'
  container.style.color = '#ffffff'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.justifyContent = 'center'
  container.style.alignItems = 'center'
  container.style.padding = '60px'
  container.style.boxSizing = 'border-box'
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'

  const inner = document.createElement('div')
  inner.style.maxWidth = '90%'
  inner.style.width = '100%'
  inner.style.textAlign = 'center'

  if (page.title) {
    const title = document.createElement('h1')
    title.textContent = page.title
    title.style.fontSize = '64px'
    title.style.fontWeight = 'bold'
    title.style.marginBottom = '24px'
    title.style.lineHeight = '1.2'
    title.style.textTransform = 'capitalize'
    inner.appendChild(title)
  }

  if (page.description) {
    const desc = document.createElement('p')
    desc.textContent = page.description
    desc.style.fontSize = '36px'
    desc.style.opacity = '0.9'
    desc.style.lineHeight = '1.5'
    desc.style.marginBottom = '24px'
    desc.style.textTransform = 'capitalize'
    inner.appendChild(desc)
  }

  if (page.image) {
    if (page.image.startsWith('http') || page.image.startsWith('data:image') || page.image.startsWith('/')) {
      const img = document.createElement('img')
      img.src = page.image
      img.style.maxWidth = '80%'
      img.style.maxHeight = '500px'
      img.style.objectFit = 'contain'
      img.style.borderRadius = '12px'
      img.style.margin = '24px auto'
      img.style.display = 'block'
      inner.appendChild(img)
    }
  }

  if (page.code) {
    const codeBlock = document.createElement('pre')
    codeBlock.style.backgroundColor = 'rgba(15, 23, 42, 0.95)'
    codeBlock.style.padding = '24px'
    codeBlock.style.borderRadius = '12px'
    codeBlock.style.fontSize = '20px'
    codeBlock.style.lineHeight = '1.5'
    codeBlock.style.textAlign = 'left'
    codeBlock.style.overflow = 'hidden'
    codeBlock.style.maxHeight = '500px'
    codeBlock.style.marginTop = '24px'
    codeBlock.style.fontFamily = 'ui-monospace, monospace'

    const codeEl = document.createElement('code')
    codeEl.textContent = page.code
    codeBlock.appendChild(codeEl)
    inner.appendChild(codeBlock)
  }

  if (page.subtitle) {
    const subtitle = document.createElement('p')
    subtitle.textContent = page.subtitle
    subtitle.style.fontSize = '28px'
    subtitle.style.opacity = '0.7'
    subtitle.style.fontStyle = 'italic'
    subtitle.style.marginTop = '32px'
    subtitle.style.lineHeight = '1.6'
    inner.appendChild(subtitle)
  }

  container.appendChild(inner)
  return container
}

async function renderSlideToImage(
  page: PresentationPage,
  width: number,
  height: number
): Promise<Uint8Array> {
  const el = createSlideElement(page, width, height)
  document.body.appendChild(el)

  try {
    // Wait for images to load
    const images = el.querySelectorAll('img')
    if (images.length > 0) {
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve()
              img.onload = () => resolve()
              img.onerror = () => resolve()
            })
        )
      )
    }

    const canvas = await html2canvas(el, {
      width,
      height,
      scale: 1,
      backgroundColor: '#000000',
      logging: false,
      useCORS: true,
    })

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    )

    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    document.body.removeChild(el)
  }
}

export async function exportToMP4(options: ExportOptions): Promise<Blob> {
  const {
    pages,
    slideAudios,
    resolution,
    defaultSlideDuration,
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
        const audioData = await fetchFile(new Blob([audio.audioBlob]))
        await ffmpeg.writeFile(`audio_${i}.mp3`, audioData)
      }
    }
  }

  if (signal?.aborted) throw new Error('Aborted')

  // Build FFmpeg concat file
  onProgress?.('Encoding video...', 75)

  let concatContent = ''
  for (let i = 0; i < pages.length; i++) {
    const duration = slideAudios?.[i]?.duration || defaultSlideDuration
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
      const duration = audio?.duration || defaultSlideDuration

      if (audio) {
        audioInputs.push('-i', `audio_${i}.mp3`)
        audioFilterParts.push(`[${inputIndex}:a]apad=pad_dur=0[a${i}]`)
        inputIndex++
      } else {
        // Generate silence for slides without audio
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
      const duration = audio?.duration || defaultSlideDuration

      if (audio) {
        audioConcat += `file 'audio_${i}.mp3'\n`
      } else {
        // Create silence file
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
