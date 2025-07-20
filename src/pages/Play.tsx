import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { X, ChevronLeft, ChevronRight, Settings } from "lucide-react"
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

  useEffect(() => {
    loadProject()
  }, [id])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPage()
      } else if (e.key === 'ArrowRight') {
        handleNextPage()
      } else if (e.key === 'Escape') {
        navigate(`/presentation/${id}`)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPageIndex, pages.length, id, navigate])

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
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/presentation/${id}`)}
          className="text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
          className="text-white hover:bg-white/20 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Presentation Content */}
      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          {currentPage?.title && (
            <h1 className={`text-4xl md:text-5xl font-bold text-center text-white leading-tight capitalize ${getSpacingClass(titleTopSpacing)}`}>
              {currentPage.title}
            </h1>
          )}
          
          {currentPage?.description && (
            <p className={`text-xl text-center text-white/90 leading-relaxed max-w-4xl mx-auto capitalize ${getSpacingClass(descriptionTitleSpacing)}`}>
              {currentPage.description}
            </p>
          )}

          {currentPage?.image && (
            <div className={`flex justify-center ${getSpacingClass(imageDescriptionSpacing)}`}>
              <img 
                src={currentPage.image} 
                alt="Slide content" 
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}
          
          {currentPage?.code && (
            <div className={`rounded-xl overflow-hidden shadow-2xl ${getSpacingClass(codeImageSpacing)}`}>
              <SyntaxHighlighter
                language={currentPage.codeLanguage || 'javascript'}
                style={vscDarkPlus}
                customStyle={{
                  padding: '2rem',
                  fontSize: '1.1rem',
                  lineHeight: '1.6',
                  background: 'rgba(30, 30, 30, 0.95)',
                  margin: 0,
                }}
                showLineNumbers={true}
              >
                {currentPage.code}
              </SyntaxHighlighter>
            </div>
          )}

          {!currentPage?.title && !currentPage?.description && !currentPage?.code && !currentPage?.image && (
            <div className="text-center text-white/60">
              <h2 className="text-4xl font-bold mb-4">Empty Slide</h2>
              <p className="text-xl">No content on this slide</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <div className="flex items-center gap-2">
            {pages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPageIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentPageIndex
                    ? 'bg-white scale-125'
                    : index < currentPageIndex
                    ? 'bg-white/60'
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPageIndex === pages.length - 1}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsPanelOpen && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-4 w-80">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white">Spacing Settings</h4>
            <button
              onClick={() => setIsSettingsPanelOpen(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">Title Top: {titleTopSpacing}</label>
              <input
                type="range"
                value={titleTopSpacing}
                onChange={(e) => setTitleTopSpacing(Number(e.target.value))}
                max={24}
                min={0}
                step={1}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">Description: {descriptionTitleSpacing}</label>
              <input
                type="range"
                value={descriptionTitleSpacing}
                onChange={(e) => setDescriptionTitleSpacing(Number(e.target.value))}
                max={24}
                min={0}
                step={1}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">Image: {imageDescriptionSpacing}</label>
              <input
                type="range"
                value={imageDescriptionSpacing}
                onChange={(e) => setImageDescriptionSpacing(Number(e.target.value))}
                max={24}
                min={0}
                step={1}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">Code: {codeImageSpacing}</label>
              <input
                type="range"
                value={codeImageSpacing}
                onChange={(e) => setCodeImageSpacing(Number(e.target.value))}
                max={24}
                min={0}
                step={1}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}