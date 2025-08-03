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

  // Settings states with localStorage persistence
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [titleTopSpacing, setTitleTopSpacing] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-titleTopSpacing')
    return saved ? Number(saved) : 8
  })
  const [descriptionTitleSpacing, setDescriptionTitleSpacing] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-descriptionTitleSpacing')
    return saved ? Number(saved) : 6
  })
  const [imageDescriptionSpacing, setImageDescriptionSpacing] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-imageDescriptionSpacing')
    return saved ? Number(saved) : 6
  })
  const [codeImageSpacing, setCodeImageSpacing] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-codeImageSpacing')
    return saved ? Number(saved) : 6
  })
  const [titleFontSize, setTitleFontSize] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-titleFontSize')
    return saved ? Number(saved) : 5
  })
  const [descriptionFontSize, setDescriptionFontSize] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-descriptionFontSize')
    return saved ? Number(saved) : 5
  })
  const [subtitleFontSize, setSubtitleFontSize] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-subtitleFontSize')
    return saved ? Number(saved) : 4
  })
  const [subtitleSpacing, setSubtitleSpacing] = useState(() => {
    const saved = localStorage.getItem('presentation-settings-subtitleSpacing')
    return saved ? Number(saved) : 8
  })
  
  // Presentation controls
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Subtitle navigation
  const [currentSubtitleSentenceIndex, setCurrentSubtitleSentenceIndex] = useState(0)
  
  // Utility function to split subtitle into sentences
  const splitIntoSentences = (text: string): string[] => {
    if (!text) return []

    const finalSentences: string[] = []
    const minWords = 3
    const maxLength = 80 // Max characters per subtitle chunk

    // First, split by sentence endings
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)

    sentences.forEach(sentence => {
      // Further split by commas, but only if the parts are long enough
      const commaSplits = sentence.split(',')
      let tempChunk = ''

      commaSplits.forEach(split => {
        const trimmedSplit = split.trim()
        if (trimmedSplit.split(' ').length >= minWords) {
          if (tempChunk) {
            finalSentences.push(tempChunk.trim())
          }
          finalSentences.push(trimmedSplit)
          tempChunk = ''
        } else {
          tempChunk += (tempChunk ? ',' : '') + split
        }
      })

      if (tempChunk) {
        finalSentences.push(tempChunk.trim())
      }
    })

    // Final pass to break up any remaining long sentences
    const trulyFinalSentences: string[] = []
    finalSentences.forEach(sentence => {
      if (sentence.length > maxLength) {
        let currentChunk = ''
        const words = sentence.split(' ')
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > maxLength && currentChunk.trim().split(' ').length >= 2) {
            trulyFinalSentences.push(currentChunk.trim())
            currentChunk = word
          } else {
            currentChunk += (currentChunk ? ' ' : '') + word
          }
        }
        if (currentChunk.trim().length > 0) {
          trulyFinalSentences.push(currentChunk.trim())
        }
      } else {
        trulyFinalSentences.push(sentence)
      }
    })

    // Final cleanup pass to merge single-word segments with adjacent ones
    const cleanedSentences: string[] = []
    for (let i = 0; i < trulyFinalSentences.length; i++) {
      const current = trulyFinalSentences[i].trim()
      const wordCount = current.split(' ').length
      
      if (wordCount < 2) {
        // If this is a single word, try to merge with next or previous
        if (i < trulyFinalSentences.length - 1) {
          // Merge with next sentence
          const next = trulyFinalSentences[i + 1].trim()
          cleanedSentences.push(`${current} ${next}`)
          i++ // Skip the next sentence since we merged it
        } else if (cleanedSentences.length > 0) {
          // Merge with previous sentence
          const lastIndex = cleanedSentences.length - 1
          cleanedSentences[lastIndex] = `${cleanedSentences[lastIndex]} ${current}`
        } else {
          // If it's the only sentence, keep it as is
          cleanedSentences.push(current)
        }
      } else {
        cleanedSentences.push(current)
      }
    }

    return cleanedSentences.filter(s => s.length > 0)
  }

  useEffect(() => {
    loadProject()
  }, [id])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('presentation-settings-titleTopSpacing', titleTopSpacing.toString())
  }, [titleTopSpacing])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-descriptionTitleSpacing', descriptionTitleSpacing.toString())
  }, [descriptionTitleSpacing])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-imageDescriptionSpacing', imageDescriptionSpacing.toString())
  }, [imageDescriptionSpacing])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-codeImageSpacing', codeImageSpacing.toString())
  }, [codeImageSpacing])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-titleFontSize', titleFontSize.toString())
  }, [titleFontSize])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-descriptionFontSize', descriptionFontSize.toString())
  }, [descriptionFontSize])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-subtitleFontSize', subtitleFontSize.toString())
  }, [subtitleFontSize])
  
  useEffect(() => {
    localStorage.setItem('presentation-settings-subtitleSpacing', subtitleSpacing.toString())
  }, [subtitleSpacing])
  

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Disable default browser shortcuts in fullscreen
      if (isFullscreen && (e.key === 'F11' || (e.key === 'f' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault()
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // Previous navigation logic
        if (currentSubtitleSentenceIndex > 0) {
          setCurrentSubtitleSentenceIndex(prev => prev - 1)
        } else if (currentPageIndex > 0) {
          const previousPage = pages[currentPageIndex - 1]
          const prevSubtitleSentences = previousPage?.subtitle ? splitIntoSentences(previousPage.subtitle) : []
          setCurrentPageIndex(prev => prev - 1)
          setCurrentSubtitleSentenceIndex(prevSubtitleSentences.length > 0 ? prevSubtitleSentences.length - 1 : 0)
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        // Next navigation logic
        const currentPage = pages[currentPageIndex]
        const subtitleSentences = currentPage?.subtitle ? splitIntoSentences(currentPage.subtitle) : []
        
        if (subtitleSentences.length > 0 && currentSubtitleSentenceIndex < subtitleSentences.length - 1) {
          setCurrentSubtitleSentenceIndex(prev => prev + 1)
        } else if (currentPageIndex < pages.length - 1) {
          setCurrentPageIndex(prev => prev + 1)
          setCurrentSubtitleSentenceIndex(0)
        }
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
        setCurrentSubtitleSentenceIndex(0)
      } else if (e.key === 'End') {
        setCurrentPageIndex(pages.length - 1)
        setCurrentSubtitleSentenceIndex(0)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPageIndex, pages, id, navigate, isFullscreen, currentSubtitleSentenceIndex])
  
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
  
  const getSubtitleFontSizeClass = (sizeValue: number) => {
    const sizeMap: { [key: number]: string } = {
      1: 'text-xs md:text-sm lg:text-base',
      2: 'text-sm md:text-base lg:text-lg',
      3: 'text-base md:text-lg lg:text-xl',
      4: 'text-lg md:text-xl lg:text-2xl',
      5: 'text-xl md:text-2xl lg:text-3xl',
      6: 'text-2xl md:text-3xl lg:text-4xl',
      7: 'text-3xl md:text-4xl lg:text-5xl',
      8: 'text-4xl md:text-5xl lg:text-6xl',
      9: 'text-5xl md:text-6xl lg:text-7xl',
      10: 'text-6xl md:text-7xl lg:text-8xl'
    }
    return sizeMap[sizeValue] || 'text-lg md:text-xl'
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
          
          {/* Subtitle display at the bottom */}
          {currentPage?.subtitle && (() => {
            const subtitleSentences = splitIntoSentences(currentPage.subtitle)
            const currentSentence = subtitleSentences[currentSubtitleSentenceIndex] || subtitleSentences[0] || ''
            return (
              <div className={`text-center ${getSpacingClass(subtitleSpacing)} flex-shrink-0`}>
                <p className={`${getSubtitleFontSizeClass(subtitleFontSize)} text-white/80 leading-relaxed max-w-4xl mx-auto italic`}>
                  {currentSentence}
                </p>
                {subtitleSentences.length > 1 && (
                  <div className="mt-2 flex justify-center space-x-1">
                    {subtitleSentences.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index <= currentSubtitleSentenceIndex ? 'bg-white/60' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Navigation Controls - Fixed at bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/80 backdrop-blur-sm rounded-xl px-6 py-3">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (currentSubtitleSentenceIndex > 0) {
                  setCurrentSubtitleSentenceIndex(prev => prev - 1)
                } else if (currentPageIndex > 0) {
                  const previousPage = pages[currentPageIndex - 1]
                  const prevSubtitleSentences = previousPage?.subtitle ? splitIntoSentences(previousPage.subtitle) : []
                  setCurrentPageIndex(prev => prev - 1)
                  setCurrentSubtitleSentenceIndex(prevSubtitleSentences.length > 0 ? prevSubtitleSentences.length - 1 : 0)
                }
              }}
              disabled={currentPageIndex === 0 && currentSubtitleSentenceIndex === 0}
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
              onClick={() => {
                const currentPage = pages[currentPageIndex]
                const subtitleSentences = currentPage?.subtitle ? splitIntoSentences(currentPage.subtitle) : []
                
                if (subtitleSentences.length > 0 && currentSubtitleSentenceIndex < subtitleSentences.length - 1) {
                  setCurrentSubtitleSentenceIndex(prev => prev + 1)
                } else if (currentPageIndex < pages.length - 1) {
                  setCurrentPageIndex(prev => prev + 1)
                  setCurrentSubtitleSentenceIndex(0)
                }
              }}
              disabled={(() => {
                const currentPage = pages[currentPageIndex]
                const subtitleSentences = currentPage?.subtitle ? splitIntoSentences(currentPage.subtitle) : []
                return currentPageIndex === pages.length - 1 && (subtitleSentences.length === 0 || currentSubtitleSentenceIndex >= subtitleSentences.length - 1)
              })()}
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
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Subtitle Size</label>
                  <span className="text-xs text-white/60">{subtitleFontSize}/10</span>
                </div>
                <input
                  type="range"
                  value={subtitleFontSize}
                  onChange={(e) => setSubtitleFontSize(Number(e.target.value))}
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
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Subtitle Spacing</label>
                  <span className="text-xs text-white/60">{subtitleSpacing}</span>
                </div>
                <input
                  type="range"
                  value={subtitleSpacing}
                  onChange={(e) => setSubtitleSpacing(Number(e.target.value))}
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