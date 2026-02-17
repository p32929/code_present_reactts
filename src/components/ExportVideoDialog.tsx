import { useState, useRef, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle, Download, Video, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasRequiredTTSSettings, type TTSMode } from '@/lib/aiSettings'
import { generateTTSForSlides } from '@/lib/ttsService'
import { exportToMP4 } from '@/lib/videoExport'
import { DatabaseService, type PresentationPage } from '@/lib/database'

type Step = 'config' | 'exporting' | 'complete' | 'error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pages: PresentationPage[]
  projectId: number
}

export function ExportVideoDialog({ open, onOpenChange, pages, projectId }: Props) {
  const [step, setStep] = useState<Step>('config')
  const [ttsMode, setTTSMode] = useState<TTSMode>('none')
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p')
  const [slideDelay, setSlideDelay] = useState(() => {
    const saved = localStorage.getItem('export-slide-delay')
    return saved ? Number(saved) : 0.4
  })
  const [progressMessage, setProgressMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [error, setError] = useState('')
  const [ffmpegLog, setFfmpegLog] = useState('')
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [ttsCacheCount, setTtsCacheCount] = useState(0)

  useEffect(() => {
    if (open) {
      DatabaseService.getTTSCacheCount().then(setTtsCacheCount).catch(() => {})
    }
  }, [open])

  const resetState = () => {
    setStep('config')
    setProgressMessage('')
    setProgressPercent(0)
    setError('')
    setFfmpegLog('')
    setExportedBlob(null)
    abortRef.current?.abort()
    abortRef.current = null
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState()
    onOpenChange(open)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const ttsConfigured = hasRequiredTTSSettings()
  const canExportWithTTS = ttsMode === 'none' || ttsConfigured

  const handleExport = async () => {
    const controller = new AbortController()
    abortRef.current = controller

    setStep('exporting')
    setProgressMessage('Starting export...')
    setProgressPercent(0)

    try {
      let slideAudios = null

      // Generate TTS if requested
      if (ttsMode !== 'none') {
        setProgressMessage('Generating narration audio...')
        setProgressPercent(5)

        const subtitles = pages.map((p) => p.subtitle || '')
        slideAudios = await generateTTSForSlides(
          subtitles,
          ttsMode,
          (current, total) => {
            const pct = 5 + (25 * current) / total
            setProgressPercent(pct)
            setProgressMessage(`Generating audio ${current}/${total}...`)
          },
          controller.signal
        )
      }

      if (controller.signal.aborted) return

      // Export video
      const blob = await exportToMP4({
        pages,
        slideAudios,
        resolution,
        slideDelay,
        onProgress: (step, progress) => {
          setProgressMessage(step)
          const base = ttsMode !== 'none' ? 30 : 0
          const scaled = base + ((100 - base) * progress) / 100
          setProgressPercent(scaled)
        },
        onLog: (msg) => {
          setFfmpegLog((prev) => prev + msg + '\n')
        },
        signal: controller.signal,
      })

      setExportedBlob(blob)
      setProgressPercent(100)
      setStep('complete')
    } catch (e: any) {
      if (e.message === 'Aborted' || e.name === 'AbortError') return
      console.error('Export error:', e)
      setError(e.message || String(e) || 'An unexpected error occurred during export.')
      setStep('error')
    }
  }

  const handleDownload = () => {
    if (!exportedBlob) return

    const url = URL.createObjectURL(exportedBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `presentation_${projectId}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    resetState()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Config Step */}
        {step === 'config' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Export as MP4
              </DialogTitle>
              <DialogDescription>
                Export your presentation as a video file.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Narration mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Narration</label>
                <Select value={ttsMode} onValueChange={(v) => setTTSMode(v as TTSMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No narration</SelectItem>
                    <SelectItem value="gemini">Gemini TTS</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ttsMode === 'none' && 'Video will have no audio.'}
                  {ttsMode === 'gemini' && 'Uses Gemini TTS model, voice, and API keys from AI Settings.'}
                </p>
              </div>

              {/* Clear audio cache */}
              {ttsMode === 'gemini' && ttsConfigured && ttsCacheCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await DatabaseService.clearTTSCache()
                    setTtsCacheCount(0)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Clear audio cache ({ttsCacheCount})
                </Button>
              )}

              {/* TTS not configured warning */}
              {ttsMode === 'gemini' && !ttsConfigured && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    TTS is not configured. Please open <strong>Generate Presentation → Settings</strong> (gear icon) and add your Gemini API keys, TTS model, and voice name.
                  </p>
                </div>
              )}

              {/* Resolution */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Select value={resolution} onValueChange={(v) => setResolution(v as '1080p' | '720p')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p (1920x1080)</SelectItem>
                    <SelectItem value="720p">720p (1280x720)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Delay between slides */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Delay between slides</label>
                  <span className="text-sm text-muted-foreground">{slideDelay}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={slideDelay}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setSlideDelay(val)
                    localStorage.setItem('export-slide-delay', String(val))
                  }}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Pause between each slide transition
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {pages.length} slide{pages.length !== 1 ? 's' : ''} will be exported. The video encoder (~25MB) will be downloaded on first use and cached.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={pages.length === 0 || !canExportWithTTS}>
                <Video className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Exporting Step */}
        {step === 'exporting' && (
          <>
            <DialogHeader>
              <DialogTitle>Exporting Video</DialogTitle>
              <DialogDescription>
                Please wait while your presentation is rendered to video.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 space-y-6">
              <div className="flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">{progressMessage}</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(Math.min(progressPercent, 100))}%
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Export Complete
              </DialogTitle>
            </DialogHeader>

            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-medium mb-1">Your video is ready!</p>
              {exportedBlob && (
                <p className="text-sm text-muted-foreground">
                  File size: {formatFileSize(exportedBlob.size)}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download MP4
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Export Failed
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              {ffmpegLog && (
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">FFmpeg log</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {ffmpegLog.slice(-2000)}
                  </pre>
                </details>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setError('')
                setFfmpegLog('')
                setStep('config')
              }}>
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
