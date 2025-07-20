import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ArrowLeft, Plus, Trash2, Type, FileText, Code2, Play, ChevronLeft, ChevronRight, Copy, X, Image, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatabaseService, type Project, type PresentationPage } from "@/lib/database"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const PROGRAMMING_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'markdown', label: 'Markdown' },
]

export function Presentation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [project, setProject] = useState<Project | null>(null)
  const [pages, setPages] = useState<PresentationPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPlayMode, setIsPlayMode] = useState(false)

  // Dialog states
  const [isAddPageDialogOpen, setIsAddPageDialogOpen] = useState(false)
  const [isDeletePageDialogOpen, setIsDeletePageDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<PresentationPage | null>(null)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

  // Multi-selection states
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set())

  // Content dialog states
  const [isAddContentDialogOpen, setIsAddContentDialogOpen] = useState(false)
  const [contentType, setContentType] = useState<'title' | 'description' | 'code' | 'image' | null>(null)
  const [tempTitle, setTempTitle] = useState("")
  const [tempDescription, setTempDescription] = useState("")
  const [tempCode, setTempCode] = useState("")
  const [tempCodeLanguage, setTempCodeLanguage] = useState("javascript")
  const [tempImage, setTempImage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Settings states
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [titleTopSpacing, setTitleTopSpacing] = useState(8) // Top margin for title
  const [descriptionTitleSpacing, setDescriptionTitleSpacing] = useState(6) // Space between title and description
  const [imageDescriptionSpacing, setImageDescriptionSpacing] = useState(6) // Space between description and image
  const [codeImageSpacing, setCodeImageSpacing] = useState(6) // Space between image and code

  useEffect(() => {
    loadProject()
  }, [id])

  useEffect(() => {
    // Check if we should start in play mode
    const playParam = searchParams.get('play')
    if (playParam === 'true') {
      setIsPlayMode(true)
    }
  }, [searchParams])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isPlayMode) {
        if (e.key === 'ArrowLeft') {
          handlePrevPage()
        } else if (e.key === 'ArrowRight') {
          handleNextPage()
        } else if (e.key === 'Escape') {
          setIsPlayMode(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlayMode, currentPageIndex, pages.length])

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
      
      // Create first page if none exist
      if (projectPages.length === 0) {
        await handleAddPage()
      }
    } catch (error) {
      console.error('Failed to load pages:', error)
    }
  }

  const handleAddPage = async () => {
    if (!project) return
    
    try {
      await DatabaseService.createPage(project.id!)
      await loadPages(project.id!)
      setCurrentPageIndex(pages.length) // Navigate to new page
      setIsAddPageDialogOpen(false)
    } catch (error) {
      console.error('Failed to create page:', error)
    }
  }

  const handleClonePage = async (pageId: number) => {
    if (!project) return
    
    try {
      await DatabaseService.clonePage(pageId)
      await loadPages(project.id!)
      setCurrentPageIndex(pages.length) // Navigate to cloned page
    } catch (error) {
      console.error('Failed to clone page:', error)
    }
  }

  const handleDeletePage = async () => {
    if (!pageToDelete) return

    try {
      await DatabaseService.deletePage(pageToDelete.id!)
      await loadPages(project!.id!)
      
      // Adjust current page index if necessary
      if (currentPageIndex >= pages.length - 1) {
        setCurrentPageIndex(Math.max(0, pages.length - 2))
      }
      
      setIsDeletePageDialogOpen(false)
      setPageToDelete(null)
    } catch (error) {
      console.error('Failed to delete page:', error)
    }
  }

  const handleBulkDeletePages = async () => {
    if (selectedPageIds.size === 0) return

    try {
      await DatabaseService.deleteMultiplePages(Array.from(selectedPageIds))
      await loadPages(project!.id!)
      
      // Reset multi-select
      setSelectedPageIds(new Set())
      
      // Adjust current page index if necessary
      if (currentPageIndex >= pages.length) {
        setCurrentPageIndex(Math.max(0, pages.length - 1))
      }
      
      setIsBulkDeleteDialogOpen(false)
    } catch (error) {
      console.error('Failed to delete pages:', error)
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

  const handleEditContent = (type: 'title' | 'description' | 'code' | 'image') => {
    const currentPage = getCurrentPage()
    if (!currentPage) return

    // Pre-fill the form with existing content
    if (type === 'title') {
      setTempTitle(currentPage.title || "")
    } else if (type === 'description') {
      setTempDescription(currentPage.description || "")
    } else if (type === 'code') {
      setTempCode(currentPage.code || "")
      setTempCodeLanguage(currentPage.codeLanguage || "javascript")
    } else if (type === 'image') {
      setTempImage(currentPage.image || "")
    }

    setContentType(type)
  }

  const handleAddContent = async () => {
    const currentPage = getCurrentPage()
    if (!currentPage || !contentType) return

    try {
      const updates: Partial<PresentationPage> = {}
      
      if (contentType === 'title') {
        updates.title = tempTitle
      } else if (contentType === 'description') {
        updates.description = tempDescription
      } else if (contentType === 'code') {
        updates.code = tempCode
        updates.codeLanguage = tempCodeLanguage
      } else if (contentType === 'image') {
        updates.image = tempImage
      }

      await DatabaseService.updatePage(currentPage.id!, updates)
      await loadPages(project!.id!)
      
      // Reset form
      setTempTitle("")
      setTempDescription("")
      setTempCode("")
      setTempImage("")
      setIsDragOver(false)
      setContentType(null)
      setIsAddContentDialogOpen(false)
    } catch (error) {
      console.error('Failed to add content:', error)
    }
  }

  const handleDeleteContent = async (contentType: 'title' | 'description' | 'code' | 'image') => {
    const currentPage = getCurrentPage()
    if (!currentPage) return

    try {
      const updates: Partial<PresentationPage> = {}
      
      if (contentType === 'title') {
        updates.title = undefined
      } else if (contentType === 'description') {
        updates.description = undefined
      } else if (contentType === 'code') {
        updates.code = undefined
        updates.codeLanguage = undefined
      } else if (contentType === 'image') {
        updates.image = undefined
      }

      await DatabaseService.updatePage(currentPage.id!, updates)
      await loadPages(project!.id!)
    } catch (error) {
      console.error('Failed to delete content:', error)
    }
  }

  const handleImageFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTempImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      handleImageFile(imageFile)
    }
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
    // Find the closest available spacing value
    const availableValues = Object.keys(spacingMap).map(Number).sort((a, b) => a - b)
    const closest = availableValues.reduce((prev, curr) => 
      Math.abs(curr - spacingValue) < Math.abs(prev - spacingValue) ? curr : prev
    )
    return spacingMap[closest] || 'mt-8'
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full h-12 w-12 border-4 border-transparent border-t-primary/60 animate-ping mx-auto"></div>
          </div>
          <p className="text-muted-foreground text-lg">Loading presentation...</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="border-b border-border">
          <div className="px-6 py-3 flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Project Not Found</h1>
          </div>
        </header>
        
        <main className="px-6 py-6">
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold mb-4">Project Not Found</h2>
            <p className="text-xl text-muted-foreground mb-8">
              The presentation project you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate("/")}>
              Go Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const currentPage = getCurrentPage()

  // Play Mode Layout
  if (isPlayMode) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col relative">
        {/* Exit Button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPlayMode(false)}
            className="text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
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
                <p className="text-xl">Exit play mode to add content to this slide</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-4">
            {/* Previous Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPage}
              disabled={currentPageIndex === 0}
              className="text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            {/* Progress Dots */}
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

            {/* Next Button */}
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
      </div>
    )
  }

  // Edit Mode Layout
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">{project?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-69px)]">
        {/* Left Panel - Slides */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            {/* Header with Actions */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Slides</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsSettingsDialogOpen(true)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Presentation Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAddPage}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Add Slide"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlayMode(true)}
                  disabled={pages.length === 0}
                  className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Present"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => getCurrentPage() && handleClonePage(getCurrentPage()!.id!)}
                  disabled={!getCurrentPage()}
                  className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clone Slide"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (getCurrentPage()) {
                      setPageToDelete(getCurrentPage()!)
                      setIsDeletePageDialogOpen(true)
                    }
                  }}
                  disabled={!getCurrentPage()}
                  className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-destructive hover:text-destructive"
                  title="Delete Slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {currentPageIndex + 1}/{pages.length}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPageIndex === pages.length - 1}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Slides List */}
            <div className="space-y-1">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                    index === currentPageIndex
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-background/50 hover:bg-muted/50'
                  }`}
                >
                  <div 
                    onClick={() => setCurrentPageIndex(index)}
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      index === currentPageIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {page.pageNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate capitalize">
                        {page.title || `Slide ${page.pageNumber}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!page.title) {
                          setContentType('title')
                        } else {
                          handleEditContent('title')
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        page.title 
                          ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                      title={page.title ? "Edit Title" : "Add Title"}
                    >
                      <Type className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!page.description) {
                          setContentType('description')
                        } else {
                          handleEditContent('description')
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        page.description 
                          ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                      title={page.description ? "Edit Description" : "Add Description"}
                    >
                      <FileText className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!page.code) {
                          setContentType('code')
                        } else {
                          handleEditContent('code')
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        page.code 
                          ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                      title={page.code ? "Edit Code" : "Add Code"}
                    >
                      <Code2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!page.image) {
                          setContentType('image')
                        } else {
                          handleEditContent('image')
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        page.image 
                          ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                      title={page.image ? "Edit Image" : "Add Image"}
                    >
                      <Image className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="flex-1 bg-black text-white flex flex-col">
          <div className="px-6 py-4 border-b border-white/20">
            <h3 className="font-medium">Live Preview</h3>
          </div>
          
          <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              {currentPage?.title && (
                <div className={`group relative ${getSpacingClass(titleTopSpacing)}`}>
                  <h1 
                    className="text-3xl md:text-4xl font-bold text-center leading-tight cursor-pointer hover:text-white/80 transition-colors capitalize"
                    onClick={() => handleEditContent('title')}
                  >
                    {currentPage.title}
                  </h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteContent('title')
                    }}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500/20 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {currentPage?.description && (
                <div className={`group relative ${getSpacingClass(descriptionTitleSpacing)}`}>
                  <p 
                    className="text-lg text-center text-white/90 leading-relaxed max-w-3xl mx-auto cursor-pointer hover:text-white transition-colors capitalize"
                    onClick={() => handleEditContent('description')}
                  >
                    {currentPage.description}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteContent('description')
                    }}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500/20 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {currentPage?.image && (
                <div className={`group relative flex justify-center ${getSpacingClass(imageDescriptionSpacing)}`}>
                  <img 
                    src={currentPage.image} 
                    alt="Slide content" 
                    className="max-w-full max-h-96 object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleEditContent('image')}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteContent('image')
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500/20 hover:text-red-400 bg-black/50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {currentPage?.code && (
                <div className={`group relative ${getSpacingClass(codeImageSpacing)}`}>
                  <div 
                    className="rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/20 transition-all"
                    onClick={() => handleEditContent('code')}
                  >
                    <SyntaxHighlighter
                      language={currentPage.codeLanguage || 'javascript'}
                      style={vscDarkPlus}
                      customStyle={{
                        padding: '1.5rem',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        background: 'rgba(15, 23, 42, 0.8)',
                        margin: 0,
                      }}
                      showLineNumbers={true}
                    >
                      {currentPage.code}
                    </SyntaxHighlighter>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteContent('code')
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-500/20 hover:text-red-400 bg-black/50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {!currentPage?.title && !currentPage?.description && !currentPage?.code && !currentPage?.image && (
                <div className="text-center text-white/50 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Empty Slide</h2>
                  <p className="text-white/70">Click "Add Content" to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Content Dialog */}
      <Dialog open={isAddContentDialogOpen} onOpenChange={setIsAddContentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Content</DialogTitle>
            <DialogDescription>
              Choose what type of content to add to this slide.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => setContentType('title')}
            >
              <Type className="w-6 h-6" />
              <span>Title</span>
            </Button>
            <Button
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => setContentType('description')}
            >
              <FileText className="w-6 h-6" />
              <span>Description</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => setContentType('code')}
            >
              <Code2 className="w-6 h-6" />
              <span>Code</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => setContentType('image')}
            >
              <Image className="w-6 h-6" />
              <span>Image</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddContentDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Edit Dialog */}
      <Dialog open={contentType !== null} onOpenChange={(open) => {
        if (!open) {
          setContentType(null)
          setTempTitle("")
          setTempDescription("")
          setTempCode("")
          setTempImage("")
          setIsDragOver(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contentType === 'title' && (getCurrentPage()?.title ? 'Edit Title' : 'Add Title')}
              {contentType === 'description' && (getCurrentPage()?.description ? 'Edit Description' : 'Add Description')} 
              {contentType === 'code' && (getCurrentPage()?.code ? 'Edit Code' : 'Add Code')}
              {contentType === 'image' && (getCurrentPage()?.image ? 'Edit Image' : 'Add Image')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {contentType === 'title' && (
              <Input
                placeholder="Enter slide title..."
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                autoFocus
              />
            )}
            {contentType === 'description' && (
              <Textarea
                placeholder="Enter slide description..."
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                rows={4}
                autoFocus
              />
            )}
            {contentType === 'code' && (
              <div className="space-y-3">
                <Select value={tempCodeLanguage} onValueChange={setTempCodeLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAMMING_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Enter your code..."
                  value={tempCode}
                  onChange={(e) => setTempCode(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
            )}
            {contentType === 'image' && (
              <div className="space-y-4">
                {!tempImage ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isDragOver ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        <Image className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isDragOver ? 'Drop image here' : 'Upload an image'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Drag and drop or click to browse
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <img 
                        src={tempImage} 
                        alt="Preview" 
                        className="max-w-full max-h-40 object-contain mx-auto rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTempImage("")
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ""
                          }
                        }}
                      >
                        Remove
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Image
                      </Button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImageFile(file)
                    }
                  }}
                  className="hidden"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentType(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddContent}>
              {contentType === 'title' && (getCurrentPage()?.title ? 'Save Changes' : 'Add Title')}
              {contentType === 'description' && (getCurrentPage()?.description ? 'Save Changes' : 'Add Description')}
              {contentType === 'code' && (getCurrentPage()?.code ? 'Save Changes' : 'Add Code')}
              {contentType === 'image' && (getCurrentPage()?.image ? 'Save Changes' : 'Add Image')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <Dialog open={isAddPageDialogOpen} onOpenChange={setIsAddPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
            <DialogDescription>
              Create a new page for your presentation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPage}>
              Add Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeletePageDialogOpen} onOpenChange={setIsDeletePageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete page {pageToDelete?.pageNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletePageDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePage}>
              Delete Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Pages Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Pages</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedPageIds.size} selected page{selectedPageIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeletePages}>
              Delete {selectedPageIds.size} Page{selectedPageIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Presentation Settings</DialogTitle>
            <DialogDescription>
              Adjust settings that apply to all slides in this presentation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Title Top Spacing</label>
              <div className="space-y-3">
                <input
                  type="range"
                  value={titleTopSpacing}
                  onChange={(e) => setTitleTopSpacing(Number(e.target.value))}
                  max={24}
                  min={0}
                  step={1}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>No spacing</span>
                  <span className="font-medium">Current: {titleTopSpacing}</span>
                  <span>Max spacing</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Controls the vertical spacing between title and other content elements.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}