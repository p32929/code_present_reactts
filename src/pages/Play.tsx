import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { X, ChevronLeft, ChevronRight, Settings, Maximize, Minimize, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatabaseService, type Project, type PresentationPage } from "@/lib/database"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function Play() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [project, setProject] = useState<Project | null>(null)
  const [pages, setPages] = useState<PresentationPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Settings states
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [titleTopSpacing, setTitleTopSpacing] = useState(8)
  const [descriptionTitleSpacing, setDescriptionTitleSpacing] = useState(6)
  const [imageDescriptionSpacing, setImageDescriptionSpacing] = useState(6)
  const [codeImageSpacing, setCodeImageSpacing] = useState(6)
  const [titleFontSize, setTitleFontSize] = useState(5) // 1-10 scale
  const [descriptionFontSize, setDescriptionFontSize] = useState(5) // 1-10 scale
  
  // Presentation controls
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProject()
  }, [id])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Disable default browser shortcuts in fullscreen
      if (isFullscreen && (e.key === 'F11' || (e.key === 'f' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault()
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrevPage()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        handleNextPage()
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen()
        } else {
          navigate(`/presentation/${id}`)
        }
      } else if (e.key === 'f' || e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Home') {
        setCurrentPageIndex(0)
      } else if (e.key === 'End') {
        setCurrentPageIndex(pages.length - 1)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPageIndex, pages.length, id, navigate, isFullscreen])
  
  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const loadProject = async () => {
    if (!id || isNaN(Number(id))) {
      setNotFound(true)
      setIsLoading(false)
      return
    }

    try {
      const projectData = await DatabaseService.getProject(Number(id))
      if (projectData) {
        setProject(projectData)
        await loadPages(Number(id))
      } else {
        setNotFound(true)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPages = async (projectId: number) => {
    try {
      const projectPages = await DatabaseService.getProjectPages(projectId)
      setPages(projectPages)
    } catch (error) {
      console.error('Failed to load pages:', error)
    }
  }

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    }
  }

  const getCurrentPage = (): PresentationPage | null => {
    return pages[currentPageIndex] || null
  }

  const getSpacingClass = (spacingValue: number) => {
    const spacingMap: { [key: number]: string } = {
      0: 'mt-0',
      1: 'mt-1',
      2: 'mt-2', 
      3: 'mt-3',
      4: 'mt-4',
      5: 'mt-5',
      6: 'mt-6',
      7: 'mt-7',
      8: 'mt-8',
      9: 'mt-9',
      10: 'mt-10',
      11: 'mt-11',
      12: 'mt-12',
      14: 'mt-14',
      16: 'mt-16',
      20: 'mt-20',
      24: 'mt-24'
    }
    const availableValues = Object.keys(spacingMap).map(Number).sort((a, b) => a - b)
    const closest = availableValues.reduce((prev, curr) => 
      Math.abs(curr - spacingValue) < Math.abs(prev - spacingValue) ? curr : prev
    )
    return spacingMap[closest] || 'mt-8'
  }

  const getTitleFontSizeClass = (sizeValue: number) => {
    const sizeMap: { [key: number]: string } = {
      1: 'text-xl md:text-2xl lg:text-3xl',
      2: 'text-2xl md:text-3xl lg:text-4xl',
      3: 'text-3xl md:text-4xl lg:text-5xl',
      4: 'text-4xl md:text-5xl lg:text-6xl',
      5: 'text-5xl md:text-6xl lg:text-7xl',
      6: 'text-6xl md:text-7xl lg:text-8xl',
      7: 'text-7xl md:text-8xl lg:text-9xl',
      8: 'text-8xl md:text-9xl',
      9: 'text-9xl',
      10: 'text-9xl'
    }
    return sizeMap[sizeValue] || 'text-4xl md:text-6xl lg:text-7xl'
  }

  const getDescriptionFontSizeClass = (sizeValue: number) => {
    const sizeMap: { [key: number]: string } = {
      1: 'text-sm md:text-base lg:text-lg',
      2: 'text-base md:text-lg lg:text-xl',
      3: 'text-lg md:text-xl lg:text-2xl',
      4: 'text-xl md:text-2xl lg:text-3xl',
      5: 'text-2xl md:text-3xl lg:text-4xl',
      6: 'text-3xl md:text-4xl lg:text-5xl',
      7: 'text-4xl md:text-5xl lg:text-6xl',
      8: 'text-5xl md:text-6xl lg:text-7xl',
      9: 'text-6xl md:text-7xl lg:text-8xl',
      10: 'text-7xl md:text-8xl lg:text-9xl'
    }
    return sizeMap[sizeValue] || 'text-xl md:text-2xl'
  }
  
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen()
      } catch (error) {
        console.warn('Fullscreen not supported:', error)
      }
    } else {
      try {
        await document.exitFullscreen()
      } catch (error) {
        console.warn('Exit fullscreen failed:', error)
      }
    }
  }
  
  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (error) {
        console.warn('Exit fullscreen failed:', error)
      }
    }
  }
  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto mb-6"></div>
          <p className="text-white/70 text-lg">Loading presentation...</p>
        </div>
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">Presentation Not Found</h2>
          <p className="text-xl text-white/70 mb-8">
            The presentation you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const currentPage = getCurrentPage()

  return (
    <div ref={containerRef} className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="text-white hover:bg-white/20 transition-colors"
          title="Home"
        >
          <Home className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/presentation/${id}`)}
          className="text-white hover:bg-white/20 transition-colors"
          title="Exit Presentation"
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
          className="text-white hover:bg-white/20 transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/20 transition-colors"
          title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </Button>
      </div>

      {/* Presentation Content Container - Takes full height minus navigation */}
      <div className="flex-1 flex flex-col justify-center px-6 py-16 pb-24 overflow-hidden">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col justify-center">
          {currentPage?.title && (
            <h1 className={`${getTitleFontSizeClass(titleFontSize)} font-bold text-center text-white leading-tight capitalize ${getSpacingClass(titleTopSpacing)} flex-shrink-0`}>
              {currentPage.title}
            </h1>
          )}
          
          {currentPage?.description && (
            <p className={`${getDescriptionFontSizeClass(descriptionFontSize)} text-center text-white/90 leading-relaxed max-w-5xl mx-auto capitalize ${getSpacingClass(descriptionTitleSpacing)} flex-shrink-0`}>
              {currentPage.description}
            </p>
          )}

          {currentPage?.image && (
            <div className={`flex justify-center ${getSpacingClass(imageDescriptionSpacing)} flex-1 min-h-0`}>
              <img 
                src={currentPage.image} 
                alt="Slide content" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          )}
          
          {currentPage?.code && (
            <div className={`rounded-xl overflow-hidden shadow-2xl border border-white/10 ${getSpacingClass(codeImageSpacing)} flex-1 min-h-0`}>
              <SyntaxHighlighter
                language={currentPage.codeLanguage || 'javascript'}
                style={vscDarkPlus}
                customStyle={{
                  padding: '1.5rem',
                  fontSize: '1rem',
                  lineHeight: '1.5',
                  background: 'rgba(15, 23, 42, 0.98)',
                  margin: 0,
                  height: '100%',
                  overflow: 'auto',
                }}
                showLineNumbers={true}
              >
                {currentPage.code}
              </SyntaxHighlighter>
            </div>
          )}

          {!currentPage?.title && !currentPage?.description && !currentPage?.code && !currentPage?.image && (
            <div className="text-center text-white/60 flex-1 flex flex-col justify-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                <ChevronRight className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-bold mb-4">Empty Slide</h2>
              <p className="text-xl">No content on this slide</p>
              <p className="text-sm text-white/40 mt-2">Press → to continue or Escape to exit</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls - Fixed at bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/80 backdrop-blur-sm rounded-xl px-6 py-3">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPage}
              disabled={currentPageIndex === 0}
              className="text-white hover:bg-white/20 disabled:opacity-30"
              title="Previous (← or ↑)"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-3">
              <div className="text-sm text-white/70 font-medium">
                {currentPageIndex + 1} / {pages.length}
              </div>
              <div className="flex items-center gap-1">
                {pages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentPageIndex
                        ? 'bg-primary w-8'
                        : index < currentPageIndex
                        ? 'bg-white/60 w-2'
                        : 'bg-white/30 w-2'
                    }`}
                    title={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              disabled={currentPageIndex === pages.length - 1}
              className="text-white hover:bg-white/20 disabled:opacity-30"
              title="Next (→, ↓, or Space)"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsPanelOpen && (
        <div className="absolute top-4 right-4 z-20 bg-black/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="font-medium text-white">Presentation Settings</h4>
              <p className="text-xs text-white/60 mt-1">Adjust text sizes, spacing and layout</p>
            </div>
            <button
              onClick={() => setIsSettingsPanelOpen(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-5">
            {/* Text Sizes Section */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium text-white/80 border-b border-white/10 pb-2">Text Sizes</h6>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Title Size</label>
                  <span className="text-xs text-white/60">{titleFontSize}/10</span>
                </div>
                <input
                  type="range"
                  value={titleFontSize}
                  onChange={(e) => setTitleFontSize(Number(e.target.value))}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Description Size</label>
                  <span className="text-xs text-white/60">{descriptionFontSize}/10</span>
                </div>
                <input
                  type="range"
                  value={descriptionFontSize}
                  onChange={(e) => setDescriptionFontSize(Number(e.target.value))}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Spacing Section */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium text-white/80 border-b border-white/10 pb-2">Spacing</h6>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Title Top Spacing</label>
                  <span className="text-xs text-white/60">{titleTopSpacing}</span>
                </div>
                <input
                  type="range"
                  value={titleTopSpacing}
                  onChange={(e) => setTitleTopSpacing(Number(e.target.value))}
                  max={24}
                  min={0}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Description Spacing</label>
                  <span className="text-xs text-white/60">{descriptionTitleSpacing}</span>
                </div>
                <input
                  type="range"
                  value={descriptionTitleSpacing}
                  onChange={(e) => setDescriptionTitleSpacing(Number(e.target.value))}
                  max={24}
                  min={0}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Image Spacing</label>
                  <span className="text-xs text-white/60">{imageDescriptionSpacing}</span>
                </div>
                <input
                  type="range"
                  value={imageDescriptionSpacing}
                  onChange={(e) => setImageDescriptionSpacing(Number(e.target.value))}
                  max={24}
                  min={0}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Code Spacing</label>
                  <span className="text-xs text-white/60">{codeImageSpacing}</span>
                </div>
                <input
                  type="range"
                  value={codeImageSpacing}
                  onChange={(e) => setCodeImageSpacing(Number(e.target.value))}
                  max={24}
                  min={0}
                  step={1}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/20">
            <h5 className="text-sm font-medium text-white mb-3">Keyboard Shortcuts</h5>
            <div className="text-xs text-white/60 space-y-1">
              <div className="flex justify-between">
                <span>Navigate:</span>
                <span>← → ↑ ↓ Space</span>
              </div>
              <div className="flex justify-between">
                <span>Fullscreen:</span>
                <span>F or F11</span>
              </div>
              <div className="flex justify-between">
                <span>Exit:</span>
                <span>Escape</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}