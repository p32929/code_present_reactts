import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef, useCallback } from "react"
import { ArrowLeft, Plus, Trash2, Type, FileText, Code2, Play, ChevronLeft, ChevronRight, Copy, X, Image, CheckSquare, Square, Save, RotateCcw, Layout } from "lucide-react"
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
  
  const [project, setProject] = useState<Project | null>(null)
  const [pages, setPages] = useState<PresentationPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Dialog states
  const [isAddPageDialogOpen, setIsAddPageDialogOpen] = useState(false)
  const [isDeletePageDialogOpen, setIsDeletePageDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<PresentationPage | null>(null)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

  // Multi-selection states
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  // Content dialog states
  const [isAddContentDialogOpen, setIsAddContentDialogOpen] = useState(false)
  const [contentType, setContentType] = useState<'title' | 'description' | 'code' | 'image' | null>(null)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  
  // Auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [tempTitle, setTempTitle] = useState("")
  const [tempDescription, setTempDescription] = useState("")
  const [tempCode, setTempCode] = useState("")
  const [tempCodeLanguage, setTempCodeLanguage] = useState("javascript")
  const [tempImage, setTempImage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Slide templates
  const slideTemplates = [
    {
      id: 'title-slide',
      name: 'Title Slide',
      description: 'Perfect for section headers and introductions',
      content: { title: 'Your Title Here', description: 'Your subtitle or description' }
    },
    {
      id: 'code-demo',
      name: 'Code Demo',
      description: 'Title with code example',
      content: { 
        title: 'Code Example',
        code: 'function hello() {\n  console.log("Hello, World!");\n}',
        codeLanguage: 'javascript'
      }
    },
    {
      id: 'image-slide',
      name: 'Image Slide',
      description: 'Title with description and image placeholder',
      content: { 
        title: 'Visual Example',
        description: 'Add your description here'
      }
    },
    {
      id: 'full-code',
      name: 'Full Code',
      description: 'Code-focused slide without title',
      content: { 
        code: '// Your code example\nconst example = "Hello World";\nconsole.log(example);',
        codeLanguage: 'javascript'
      }
    },
    {
      id: 'intro-slide',
      name: 'Introduction',
      description: 'Perfect for presentation opening',
      content: { 
        title: 'Welcome',
        description: 'An introduction to our topic'
      }
    },
    {
      id: 'summary-slide',
      name: 'Summary',
      description: 'Wrap up your presentation',
      content: { 
        title: 'Summary',
        description: 'Key takeaways and next steps'
      }
    }
  ]

  useEffect(() => {
    loadProject()
  }, [id])
  
  // Auto-save functionality
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    setAutoSaveStatus('pending')
    autoSaveTimeoutRef.current = setTimeout(() => {
      setAutoSaveStatus('saving')
      // Update project timestamp to indicate activity
      if (project?.id) {
        DatabaseService.updateProject(project.id, {})
          .then(() => {
            setAutoSaveStatus('saved')
            setLastSaved(new Date())
          })
          .catch(() => {
            setAutoSaveStatus('pending')
          })
      }
    }, 2000)
  }, [project?.id])
  
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
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
      triggerAutoSave()
    } catch (error) {
      console.error('Failed to create page:', error)
    }
  }
  
  const handleCreateFromTemplate = async (template: typeof slideTemplates[0]) => {
    if (!project) return
    
    try {
      const pageId = await DatabaseService.createPage(project.id!)
      
      // Apply template content
      const updates: Partial<PresentationPage> = {}
      if (template.content.title) updates.title = template.content.title
      if (template.content.description) updates.description = template.content.description
      if (template.content.code) {
        updates.code = template.content.code
        updates.codeLanguage = template.content.codeLanguage || 'javascript'
      }
      
      if (Object.keys(updates).length > 0) {
        await DatabaseService.updatePage(pageId, updates)
      }
      
      await loadPages(project.id!)
      setCurrentPageIndex(pages.length) // Navigate to new page
      setIsTemplateDialogOpen(false)
      triggerAutoSave()
    } catch (error) {
      console.error('Failed to create page from template:', error)
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
      setIsMultiSelectMode(false)
      
      // Adjust current page index if necessary
      if (currentPageIndex >= pages.length) {
        setCurrentPageIndex(Math.max(0, pages.length - 1))
      }
      
      setIsBulkDeleteDialogOpen(false)
    } catch (error) {
      console.error('Failed to delete pages:', error)
    }
  }

  const handlePageSelect = (pageId: number, checked: boolean) => {
    const newSelected = new Set(selectedPageIds)
    if (checked) {
      newSelected.add(pageId)
    } else {
      newSelected.delete(pageId)
    }
    setSelectedPageIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPageIds.size === pages.length) {
      setSelectedPageIds(new Set())
    } else {
      setSelectedPageIds(new Set(pages.map(p => p.id!)))
    }
  }

  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false)
    setSelectedPageIds(new Set())
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
      triggerAutoSave()
      
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
      triggerAutoSave()
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {autoSaveStatus === 'saving' && (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border border-muted-foreground border-t-transparent"></div>
                  <span>Saving...</span>
                </div>
              )}
              {autoSaveStatus === 'saved' && lastSaved && (
                <div className="flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
                </div>
              )}
              {autoSaveStatus === 'pending' && (
                <div className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  <span>Pending save...</span>
                </div>
              )}
            </div>
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
                {!isMultiSelectMode ? (
                  <>
                    <button
                      onClick={handleAddPage}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Add Blank Slide"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsTemplateDialogOpen(true)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Add From Template"
                    >
                      <Layout className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/play/${id}`)}
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
                    <button
                      onClick={() => setIsMultiSelectMode(true)}
                      disabled={pages.length === 0}
                      className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Select Multiple"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title={selectedPageIds.size === pages.length ? "Deselect All" : "Select All"}
                    >
                      {selectedPageIds.size === pages.length ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      disabled={selectedPageIds.size === 0}
                      className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-destructive hover:text-destructive"
                      title={`Delete ${selectedPageIds.size} Selected`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={exitMultiSelectMode}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Exit Selection Mode"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
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
            <div className="space-y-2">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={`group rounded-lg border transition-all ${
                    index === currentPageIndex
                      ? 'bg-primary/10 border-primary/20 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/30 hover:border-primary/30'
                  } ${selectedPageIds.has(page.id!) ? 'ring-2 ring-primary/30' : ''}`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {isMultiSelectMode && (
                        <div className="pt-1">
                          <button
                            onClick={() => handlePageSelect(page.id!, !selectedPageIds.has(page.id!))}
                            className="p-1 hover:bg-muted/50 rounded transition-colors"
                          >
                            {selectedPageIds.has(page.id!) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                      
                      {/* Slide thumbnail preview */}
                      <div 
                        onClick={() => !isMultiSelectMode && setCurrentPageIndex(index)}
                        className={`w-16 h-12 rounded border-2 flex-shrink-0 overflow-hidden cursor-pointer transition-all ${
                          index === currentPageIndex
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-muted/20 hover:border-primary/50'
                        }`}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] p-1 space-y-0.5">
                          {page.title && (
                            <div className="font-bold truncate w-full text-center leading-none">
                              {page.title.slice(0, 8)}...
                            </div>
                          )}
                          {page.description && (
                            <div className="text-muted-foreground truncate w-full text-center leading-none">
                              {page.description.slice(0, 12)}...
                            </div>
                          )}
                          {page.code && (
                            <div className="text-blue-500 text-[8px] font-mono leading-none">
                              {`<${page.codeLanguage || 'code'}/>`}
                            </div>
                          )}
                          {page.image && (
                            <div className="text-green-500 text-[8px] leading-none">
                              [IMG]
                            </div>
                          )}
                          {!page.title && !page.description && !page.code && !page.image && (
                            <div className="text-muted-foreground text-[8px] leading-none">
                              Empty
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Slide content info */}
                      <div 
                        onClick={() => !isMultiSelectMode && setCurrentPageIndex(index)}
                        className={`flex-1 min-w-0 ${!isMultiSelectMode ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-medium mt-0.5 ${
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
                            {(page.description || page.code || page.image) && (
                              <div className="text-xs text-muted-foreground truncate mt-1">
                                {page.description ? page.description.slice(0, 35) + '...' : 
                                 page.code ? `Code: ${page.codeLanguage}` :
                                 page.image ? 'Image slide' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Content type indicators and edit buttons */}
                      <div className="flex flex-col gap-1 pt-1">
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
                            disabled={!!(page.code && page.image)}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              page.title 
                                ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            title={page.code && page.image ? "Cannot add title when both code and image are present" : (page.title ? "Edit Title" : "Add Title")}
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
                            disabled={!!(page.code && page.image)}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              page.description 
                                ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            title={page.code && page.image ? "Cannot add description when both code and image are present" : (page.description ? "Edit Description" : "Add Description")}
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!page.code) {
                                setContentType('code')
                              } else {
                                handleEditContent('code')
                              }
                            }}
                            disabled={!!page.image}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              page.code 
                                ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            title={page.image ? "Cannot add code when image is present" : (page.code ? "Edit Code" : "Add Code")}
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
                            disabled={!!page.code}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              page.image 
                                ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            title={page.code ? "Cannot add image when code is present" : (page.image ? "Edit Image" : "Add Image")}
                          >
                            <Image className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="flex-1 bg-black text-white flex flex-col">
          <div className="px-6 py-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Live Preview</h3>
              <div className="text-xs text-white/60">
                {currentPageIndex + 1} of {pages.length}
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {currentPage?.title && (
                <div className="group relative">
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
                <div className="group relative">
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
                <div className="group relative flex justify-center">
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
                <div className="group relative">
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

      {/* Slide Templates Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a Slide Template</DialogTitle>
            <DialogDescription>
              Select a template to quickly create a new slide with pre-defined content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {slideTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleCreateFromTemplate(template)}
                className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Layout className="w-5 h-5 text-primary" />
                  <h4 className="font-medium">{template.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <div className="text-xs bg-muted/50 rounded p-2 font-mono">
                  {template.content.title && <div className="font-bold">{template.content.title}</div>}
                  {template.content.description && <div className="text-muted-foreground">{template.content.description}</div>}
                  {template.content.code && <div className="text-blue-600">{template.content.code.split('\n')[0]}...</div>}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}