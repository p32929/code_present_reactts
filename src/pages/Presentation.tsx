import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useState, useCallback } from "react"
import { ArrowLeft, Plus, Trash2, Type, FileText, Code2, Play, ChevronLeft, ChevronRight, Copy, RotateCcw, CheckSquare, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [isResetPagesDialogOpen, setIsResetPagesDialogOpen] = useState(false)
  const [resetPagesConfirmation, setResetPagesConfirmation] = useState("")
  const [resetPagesRandomNumber, setResetPagesRandomNumber] = useState(0)

  // Multi-selection states
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  // Content editing states
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const [tempTitle, setTempTitle] = useState("")
  const [tempDescription, setTempDescription] = useState("")
  const [tempCode, setTempCode] = useState("")
  const [tempCodeLanguage, setTempCodeLanguage] = useState("javascript")
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

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
      if (isPlayMode && !editingTitle && !editingDescription && !editingCode) {
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
  }, [isPlayMode, currentPageIndex, pages.length, editingTitle, editingDescription, editingCode])

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

  const handleResetAllPages = () => {
    const randomNum = Math.floor(Math.random() * 90) + 10
    setResetPagesRandomNumber(randomNum)
    setResetPagesConfirmation("")
    setIsResetPagesDialogOpen(true)
  }

  const handleConfirmResetPages = async () => {
    if (resetPagesConfirmation === resetPagesRandomNumber.toString() && project) {
      try {
        await DatabaseService.deleteAllProjectPages(project.id!)
        await loadPages(project.id!)
        setCurrentPageIndex(0)
        setSelectedPageIds(new Set())
        setIsMultiSelectMode(false)
        setIsResetPagesDialogOpen(false)
        setResetPagesConfirmation("")
      } catch (error) {
        console.error('Failed to reset pages:', error)
      }
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

  const autoSave = useCallback(async (field: 'title' | 'description' | 'code', value: string, language?: string) => {
    const currentPage = getCurrentPage()
    if (!currentPage) return

    try {
      if (field === 'title') {
        await DatabaseService.updatePage(currentPage.id!, { title: value })
      } else if (field === 'description') {
        await DatabaseService.updatePage(currentPage.id!, { description: value })
      } else if (field === 'code') {
        await DatabaseService.updatePage(currentPage.id!, { 
          code: value, 
          codeLanguage: language || tempCodeLanguage 
        })
      }
      await loadPages(project!.id!)
    } catch (error) {
      console.error('Failed to auto-save:', error)
    }
  }, [project, tempCodeLanguage, getCurrentPage, loadPages])

  const debounceAutoSave = useCallback((field: 'title' | 'description' | 'code', value: string, language?: string) => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }
    
    const timeout = setTimeout(() => {
      autoSave(field, value, language)
    }, 1000)
    
    setAutoSaveTimeout(timeout)
  }, [autoSave, autoSaveTimeout])

  const handleTitleChange = (value: string) => {
    setTempTitle(value)
    debounceAutoSave('title', value)
  }

  const handleDescriptionChange = (value: string) => {
    setTempDescription(value)
    debounceAutoSave('description', value)
  }

  const handleCodeChange = (value: string) => {
    setTempCode(value)
    debounceAutoSave('code', value, tempCodeLanguage)
  }

  const handleCodeLanguageChange = (language: string) => {
    setTempCodeLanguage(language)
    debounceAutoSave('code', tempCode, language)
  }

  const startEditingTitle = () => {
    if (isPlayMode) return
    const currentPage = getCurrentPage()
    setTempTitle(currentPage?.title || "")
    setEditingTitle(true)
  }

  const startEditingDescription = () => {
    if (isPlayMode) return
    const currentPage = getCurrentPage()
    setTempDescription(currentPage?.description || "")
    setEditingDescription(true)
  }

  const startEditingCode = () => {
    if (isPlayMode) return
    const currentPage = getCurrentPage()
    setTempCode(currentPage?.code || "")
    setTempCodeLanguage(currentPage?.codeLanguage || "javascript")
    setEditingCode(true)
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
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="px-4 py-4 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-semibold">Project Not Found</h1>
          </div>
        </header>
        
        <main className="px-4 py-4">
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
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-5xl w-full space-y-12">
            {currentPage?.title && (
              <h1 className="text-5xl md:text-6xl font-bold text-center text-white leading-tight">
                {currentPage.title}
              </h1>
            )}
            
            {currentPage?.description && (
              <p className="text-xl md:text-2xl text-center text-white/90 leading-relaxed max-w-4xl mx-auto">
                {currentPage.description}
              </p>
            )}
            
            {currentPage?.code && (
              <div className="rounded-2xl overflow-hidden shadow-2xl">
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

            {!currentPage?.title && !currentPage?.description && !currentPage?.code && (
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{project?.name}</h1>
              <p className="text-sm text-muted-foreground">
                Editing Mode • Page {currentPageIndex + 1} of {pages.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsPlayMode(true)}
              disabled={pages.length === 0}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Play Presentation
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-81px)]">
        {/* Left Sidebar - Pages List */}
        <div className="w-64 border-r border-border/50 bg-background/50 backdrop-blur-sm px-4 py-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Pages</h2>
                <div className="flex gap-1">
                  {!isMultiSelectMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => getCurrentPage() && handleClonePage(getCurrentPage()!.id!)}
                        disabled={!getCurrentPage()}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddPage}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exitMultiSelectMode}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              
              {!isMultiSelectMode ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsMultiSelectMode(true)}
                    className="flex-1 text-xs"
                    disabled={pages.length === 0}
                  >
                    Select Multiple
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetAllPages}
                    className="text-destructive hover:text-destructive text-xs"
                    disabled={pages.length === 0}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset All
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedPageIds.size} of {pages.length} selected
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSelectAll}
                      className="h-6 text-xs"
                    >
                      {selectedPageIds.size === pages.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  {selectedPageIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      className="w-full text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Selected ({selectedPageIds.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {pages.map((page, index) => {
                const isSelected = selectedPageIds.has(page.id!)
                return (
                  <Card 
                    key={page.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md group ${
                      index === currentPageIndex 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    } ${
                      isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => {
                      if (isMultiSelectMode) {
                        handlePageSelect(page.id!, !isSelected)
                      } else {
                        setCurrentPageIndex(index)
                      }
                    }}
                  >
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isMultiSelectMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePageSelect(page.id!, !isSelected)
                              }}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                            {page.pageNumber}
                          </span>
                          <CardTitle className="text-sm truncate">
                            {page.title || `Slide ${page.pageNumber}`}
                          </CardTitle>
                        </div>
                        {!isMultiSelectMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPageToDelete(page)
                              setIsDeletePageDialogOpen(true)
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {page.title && <div className="flex items-center gap-1"><Type className="w-3 h-3" /> Title</div>}
                        {page.description && <div className="flex items-center gap-1"><FileText className="w-3 h-3" /> Description</div>}
                        {page.code && <div className="flex items-center gap-1"><Code2 className="w-3 h-3" /> {page.codeLanguage}</div>}
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side - Live Preview */}
        <div className="flex-1 flex">
          {/* Editor Panel */}
          <div className="w-80 px-4 py-4 overflow-y-auto border-r border-border/50 bg-background/30">
            <div className="space-y-4">
              <div className="text-center pb-3 border-b">
                <h2 className="text-base font-semibold mb-1">Edit Content</h2>
                <p className="text-xs text-muted-foreground">Page {currentPage?.pageNumber}</p>
              </div>

              {/* Title Editor */}
              <div className="space-y-3">
                <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  <Type className="w-3 h-3" />
                  TITLE
                </label>
                {editingTitle ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter title..."
                      value={tempTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      onBlur={() => setEditingTitle(false)}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">Auto-saving... Press Enter or click outside to finish</p>
                  </div>
                ) : (
                  <div
                    onClick={startEditingTitle}
                    className="p-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm text-muted-foreground">
                      {currentPage?.title || "Click to add title"}
                    </p>
                  </div>
                )}
              </div>

              {/* Description Editor */}
              <div className="space-y-3">
                <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  DESCRIPTION
                </label>
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Enter description..."
                      value={tempDescription}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      onBlur={() => setEditingDescription(false)}
                      rows={4}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">Auto-saving... Press Escape or click outside to finish</p>
                  </div>
                ) : (
                  <div
                    onClick={startEditingDescription}
                    className="p-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm text-muted-foreground">
                      {currentPage?.description || "Click to add description"}
                    </p>
                  </div>
                )}
              </div>

              {/* Code Editor */}
              <div className="space-y-3">
                <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  <Code2 className="w-3 h-3" />
                  CODE
                </label>
                {editingCode ? (
                  <div className="space-y-2">
                    <Select value={tempCodeLanguage} onValueChange={handleCodeLanguageChange}>
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
                      placeholder="Enter code..."
                      value={tempCode}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      onBlur={() => setEditingCode(false)}
                      rows={8}
                      className="font-mono text-sm"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">Auto-saving... Press Escape or click outside to finish</p>
                  </div>
                ) : (
                  <div
                    onClick={startEditingCode}
                    className="p-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm text-muted-foreground">
                      {currentPage?.code ? `${currentPage.codeLanguage} code` : "Click to add code"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex-1 bg-black text-white flex items-center justify-center px-4 py-4">
            <div className="max-w-4xl w-full space-y-8">
              {currentPage?.title && (
                <h1 className="text-4xl md:text-5xl font-bold text-center leading-tight">
                  {currentPage.title}
                </h1>
              )}
              
              {currentPage?.description && (
                <p className="text-lg md:text-xl text-center text-white/90 leading-relaxed">
                  {currentPage.description}
                </p>
              )}
              
              {currentPage?.code && (
                <div className="rounded-xl overflow-hidden">
                  <SyntaxHighlighter
                    language={currentPage.codeLanguage || 'javascript'}
                    style={vscDarkPlus}
                    customStyle={{
                      padding: '1.5rem',
                      fontSize: '0.95rem',
                      lineHeight: '1.5',
                      background: 'rgba(15, 23, 42, 0.8)',
                      margin: 0,
                    }}
                    showLineNumbers={true}
                  >
                    {currentPage.code}
                  </SyntaxHighlighter>
                </div>
              )}

              {!currentPage?.title && !currentPage?.description && !currentPage?.code && (
                <div className="text-center text-white/50">
                  <h2 className="text-3xl font-bold mb-4">Empty Slide</h2>
                  <p className="text-lg">Add content using the editor on the left</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {/* Reset All Pages Dialog */}
      <Dialog open={isResetPagesDialogOpen} onOpenChange={setIsResetPagesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />
              Reset All Pages
            </DialogTitle>
            <DialogDescription className="text-base">
              This will permanently delete <strong>ALL {pages.length} page{pages.length !== 1 ? 's' : ''}</strong> in this presentation. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-xl p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-destructive mb-2">
                  To confirm this dangerous action, please type the number:
                </p>
                <div className="bg-destructive/20 rounded-lg p-4 mb-4">
                  <span className="font-bold text-3xl text-destructive tracking-wider">
                    {resetPagesRandomNumber}
                  </span>
                </div>
              </div>
              <Input
                placeholder="Enter the number above"
                value={resetPagesConfirmation}
                onChange={(e) => setResetPagesConfirmation(e.target.value)}
                className="text-center text-lg font-mono border-destructive/50 focus:border-destructive bg-background"
                autoFocus
              />
              {resetPagesConfirmation && resetPagesConfirmation !== resetPagesRandomNumber.toString() && (
                <p className="text-sm text-destructive text-center">
                  The number doesn't match. Please try again.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPagesDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmResetPages}
              disabled={resetPagesConfirmation !== resetPagesRandomNumber.toString()}
              className="bg-gradient-to-r from-destructive to-destructive/90"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Pages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}