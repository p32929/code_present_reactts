import { useState, useRef } from 'react'
import { Loader2, CheckCircle, AlertCircle, Download, Video } from 'lucide-react'
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
import { hasRequiredTTSSettings } from '@/lib/aiSettings'
import { generateTTSForSlides } from '@/lib/ttsService'
import { exportToMP4 } from '@/lib/videoExport'
import type { PresentationPage } from '@/lib/database'

type Step = 'config' | 'exporting' | 'complete' | 'error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pages: PresentationPage[]
  projectId: number
}

export function ExportVideoDialog({ open, onOpenChange, pages, projectId }: Props) {
  const [step, setStep] = useState<Step>('config')
  const [includeNarration, setIncludeNarration] = useState(false)
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p')
  const [slideDelay, setSlideDelay] = useState(1.5)
  const [progressMessage, setProgressMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [error, setError] = useState('')
  const [ffmpegLog, setFfmpegLog] = useState('')
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const hasTTSKey = hasRequiredTTSSettings()

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

  const handleExport = async () => {
    const controller = new AbortController()
    abortRef.current = controller

    setStep('exporting')
    setProgressMessage('Starting export...')
    setProgressPercent(0)

    try {
      let slideAudios = null

      // Generate TTS if requested
      if (includeNarration && hasTTSKey) {
        setProgressMessage('Generating narration audio...')
        setProgressPercent(5)

        const subtitles = pages.map((p) => p.subtitle || '')
        slideAudios = await generateTTSForSlides(
          subtitles,
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
          // Scale progress from 30-100 if we had audio, or 0-100 if not
          const base = includeNarration ? 30 : 0
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
              {/* Narration option */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNarration}
                  onChange={(e) => setIncludeNarration(e.target.checked)}
                  disabled={!hasTTSKey}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium">Include narration</span>
                  {!hasTTSKey && (
                    <p className="text-xs text-muted-foreground">
                      Requires ElevenLabs API key (configure in Generate Presentation settings)
                    </p>
                  )}
                </div>
              </label>

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
                  onChange={(e) => setSlideDelay(Number(e.target.value))}
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
              <Button onClick={handleExport} disabled={pages.length === 0}>
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
