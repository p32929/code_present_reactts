import { useState, useRef } from 'react'
import { Settings, Upload, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAISettings, saveAISettings, hasRequiredTextGenSettings } from '@/lib/aiSettings'
import { parseGitHubUrl, fetchGitHubRepo, parseZipFile } from '@/lib/repoParser'
import { generatePresentation } from '@/lib/aiService'
import { DatabaseService } from '@/lib/database'

type Step = 'input' | 'settings' | 'generating' | 'complete' | 'error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (projectId: number) => void
}

export function GeneratePresentationDialog({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [githubUrl, setGithubUrl] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [progressMessage, setProgressMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  // Settings state
  const [settings, setSettings] = useState(() => getAISettings())

  const resetState = () => {
    setStep('input')
    setGithubUrl('')
    setZipFile(null)
    setIsDragOver(false)
    setError('')
    setProgressMessage('')
    setProgressPercent(0)
    setCreatedProjectId(null)
    abortRef.current?.abort()
    abortRef.current = null
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState()
    onOpenChange(open)
  }

  const handleSaveSettings = () => {
    saveAISettings(settings)
    setStep('input')
  }

  const handleZipFile = (file: File) => {
    if (file.name.endsWith('.zip') || file.type === 'application/zip') {
      setZipFile(file)
    }
  }

  const handleGenerate = async () => {
    if (!hasRequiredTextGenSettings()) {
      setStep('settings')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setStep('generating')
    setProgressMessage('Analyzing repository...')
    setProgressPercent(10)

    try {
      // Step 1: Parse repo/zip
      let files
      if (zipFile) {
        files = await parseZipFile(zipFile, controller.signal)
      } else {
        const parsed = parseGitHubUrl(githubUrl.trim())
        if (!parsed) {
          throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo')
        }
        files = await fetchGitHubRepo(parsed.owner, parsed.repo, controller.signal)
      }

      if (controller.signal.aborted) return

      // Step 2: Generate slides
      setProgressMessage('Generating slides with AI...')
      setProgressPercent(30)

      const presentation = await generatePresentation(files, controller.signal)

      if (controller.signal.aborted) return

      // Step 3: Save to database
      setProgressMessage('Saving presentation...')
      setProgressPercent(85)

      const dbSlides = presentation.slides.map((slide) => ({
        title: slide.title,
        description: slide.description,
        subtitle: slide.subtitle,
        code: slide.code,
        codeLanguage: slide.codeLanguage,
        image: '',
      }))

      const projectId = await DatabaseService.createProjectWithPages(
        presentation.projectName,
        dbSlides
      )

      setCreatedProjectId(projectId)
      setProgressPercent(100)
      setStep('complete')
    } catch (e: any) {
      if (e.message === 'Aborted' || e.name === 'AbortError') return
      setError(e.message || 'An unexpected error occurred.')
      setStep('error')
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    resetState()
    setStep('input')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Input Step */}
        {step === 'input' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate Presentation
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSettings(getAISettings())
                    setStep('settings')
                  }}
                  className="mr-6"
                  title="AI Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
              <DialogDescription>
                Generate a presentation from a GitHub repository or ZIP file using AI.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* GitHub URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository URL</label>
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value)
                    setZipFile(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && githubUrl.trim()) handleGenerate()
                  }}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or upload a ZIP</span>
                </div>
              </div>

              {/* ZIP upload */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) {
                    handleZipFile(file)
                    setGithubUrl('')
                  }
                }}
                onClick={() => zipInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : zipFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                <Upload className={`w-6 h-6 mx-auto mb-2 ${zipFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">
                  {zipFile ? zipFile.name : 'Drag and drop a ZIP file, or click to select'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">.zip files containing source code</p>
              </div>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleZipFile(file)
                    setGithubUrl('')
                  }
                }}
                className="hidden"
              />

              {!hasRequiredTextGenSettings() && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    AI settings are not configured. Click the gear icon above to set up your API keys.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!githubUrl.trim() && !zipFile}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Settings Step */}
        {step === 'settings' && (
          <>
            <DialogHeader>
              <DialogTitle>AI Settings</DialogTitle>
              <DialogDescription>
                Configure API endpoints and keys for AI generation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Text Generation (OpenAI-compatible)</h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    placeholder="https://your-api.com/base-path"
                    value={settings.textGenBaseUrl}
                    onChange={(e) => setSettings({ ...settings, textGenBaseUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={settings.textGenApiKey}
                    onChange={(e) => setSettings({ ...settings, textGenApiKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Input
                    value={settings.textGenModel}
                    onChange={(e) => setSettings({ ...settings, textGenModel: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Gemini TTS (Optional)</h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Keys</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={"AIzaSy...\nAIzaSy...\nOne key per line"}
                    value={settings.ttsApiKeys}
                    onChange={(e) => setSettings({ ...settings, ttsApiKeys: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    One Gemini API key per line. If one key fails, the next one is tried automatically.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">TTS Model</label>
                  <Input
                    placeholder="gemini-2.5-flash-preview-tts"
                    value={settings.ttsModel}
                    onChange={(e) => setSettings({ ...settings, ttsModel: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">TTS Voice</label>
                  <Input
                    placeholder="Kore, Puck, Charon, Fenrir, Aoede..."
                    value={settings.ttsVoice}
                    onChange={(e) => setSettings({ ...settings, ttsVoice: e.target.value })}
                  />
                </div>
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Generating Step */}
        {step === 'generating' && (
          <>
            <DialogHeader>
              <DialogTitle>Generating Presentation</DialogTitle>
              <DialogDescription>
                Please wait while the AI analyzes the code and creates slides.
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
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">{Math.round(progressPercent)}%</p>
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
                Presentation Generated
              </DialogTitle>
              <DialogDescription>
                Your presentation has been created successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-muted-foreground">
                Your AI-generated presentation is ready to view and edit.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (createdProjectId) {
                    onComplete(createdProjectId)
                    handleOpenChange(false)
                  }
                }}
              >
                Open Presentation
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
                Generation Failed
              </DialogTitle>
            </DialogHeader>

            <div className="py-6">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setError('')
                setStep('input')
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
