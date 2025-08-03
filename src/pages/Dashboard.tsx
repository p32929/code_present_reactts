import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, RotateCcw, Play, FileEdit, Type, Search, Clock, Presentation, Filter, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { DatabaseService, type Project, type PresentationPage } from "@/lib/database"

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectStats, setProjectStats] = useState<{ [key: number]: { slideCount: number; lastSlide?: PresentationPage } }>({})
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'updated' | 'slides'>('updated')
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Edit project states
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editProjectName, setEditProjectName] = useState("")
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  // Delete project states
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Reset all data states
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState("")
  const [resetRandomNumber, setResetRandomNumber] = useState(0)
  
  // Import presentation states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  // Reload projects when returning to dashboard (to update slide counts)
  useEffect(() => {
    const handleFocus = () => {
      loadProjects()
    }
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProjects()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    filterAndSortProjects()
  }, [projects, searchQuery, sortBy])

  const loadProjects = async () => {
    try {
      const allProjects = await DatabaseService.getAllProjects()
      setProjects(allProjects)
      
      // Load stats for each project
      const stats: { [key: number]: { slideCount: number; lastSlide?: PresentationPage } } = {}
      for (const project of allProjects) {
        const pages = await DatabaseService.getProjectPages(project.id!)
        stats[project.id!] = {
          slideCount: pages.length,
          lastSlide: pages[pages.length - 1]
        }
      }
      setProjectStats(stats)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortProjects = () => {
    let filtered = projects.filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'slides':
          return (projectStats[b.id!]?.slideCount || 0) - (projectStats[a.id!]?.slideCount || 0)
        default:
          return 0
      }
    })

    setFilteredProjects(filtered)
  }

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      try {
        const projectId = await DatabaseService.createProject(newProjectName.trim())
        setNewProjectName("")
        setIsCreateDialogOpen(false)
        navigate(`/presentation/${projectId}`)
      } catch (error) {
        console.error('Failed to create project:', error)
      }
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setEditProjectName(project.name)
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (editingProject && editProjectName.trim()) {
      try {
        await DatabaseService.updateProject(editingProject.id!, { name: editProjectName.trim() })
        await loadProjects()
        setIsEditDialogOpen(false)
        setEditingProject(null)
        setEditProjectName("")
      } catch (error) {
        console.error('Failed to update project:', error)
      }
    }
  }

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project)
    setIsDeleteDialogOpen(true)
  }


  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleExportPresentation = async (project: Project) => {
    try {
      const pages = await DatabaseService.getProjectPages(project.id!)
      const exportData = {
        name: project.name,
        slides: pages.map(page => ({
          title: page.title || '',
          description: page.description || '',
          subtitle: page.subtitle || '',
          code: page.code || '',
          codeLanguage: page.codeLanguage || 'javascript',
          image: page.image || ''
        }))
      }
      
      const dataStr = JSON.stringify(exportData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export presentation:', error)
    }
  }

  const handleConfirmDelete = async () => {
    if (deletingProject) {
      try {
        await DatabaseService.deleteProject(deletingProject.id!)
        await loadProjects()
        setIsDeleteDialogOpen(false)
        setDeletingProject(null)
      } catch (error) {
        console.error('Failed to delete project:', error)
      }
    }
  }

  const handleResetAllData = () => {
    const randomNum = Math.floor(Math.random() * 90) + 10 // 10-99
    setResetRandomNumber(randomNum)
    setResetConfirmation("")
    setIsResetDialogOpen(true)
  }

  const handleConfirmReset = async () => {
    if (resetConfirmation === resetRandomNumber.toString()) {
      try {
        await DatabaseService.deleteAllProjects()
        await loadProjects()
        setIsResetDialogOpen(false)
        setResetConfirmation("")
      } catch (error) {
        console.error('Failed to reset data:', error)
      }
    }
  }

  const handleImportPresentation = () => {
    setImportFile(null)
    setImportError("")
    setIsDragOver(false)
    setIsImportDialogOpen(true)
  }

  const validateAndSetFile = (file: File) => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      setImportFile(file)
      setImportError("")
    } else {
      setImportError("Please select a valid JSON file")
      setImportFile(null)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      validateAndSetFile(file)
    }
  }

  const handleConfirmImport = async () => {
    if (!importFile) return

    setIsImporting(true)
    setImportError("")

    try {
      const fileContent = await importFile.text()
      const importData = JSON.parse(fileContent)

      // Validate the import data structure
      if (!importData.name || !Array.isArray(importData.slides)) {
        throw new Error("Invalid file format. Expected a JSON file with 'name' and 'slides' properties.")
      }

      // Create a new project
      const projectId = await DatabaseService.createProject(importData.name)

      // Import all slides
      for (const slide of importData.slides) {
        const pageId = await DatabaseService.createPage(projectId)
        await DatabaseService.updatePage(pageId, {
          title: slide.title || '',
          description: slide.description || '',
          subtitle: slide.subtitle || '',
          code: slide.code || '',
          codeLanguage: slide.codeLanguage || 'javascript',
          image: slide.image || ''
        })
      }

      // Reload projects and navigate to the imported project
      await loadProjects()
      setIsImportDialogOpen(false)
      setImportFile(null)
      navigate(`/presentation/${projectId}`)
    } catch (error) {
      console.error('Failed to import presentation:', error)
      if (error instanceof SyntaxError) {
        setImportError("Invalid JSON file format")
      } else if (error instanceof Error) {
        setImportError(error.message)
      } else {
        setImportError("Failed to import presentation")
      }
    } finally {
      setIsImporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">CodePresent</h1>
              <p className="text-muted-foreground text-sm">Create and deliver stunning code presentations</p>
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {projects.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAllData}
                  className="text-destructive hover:text-destructive"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleImportPresentation}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Presentation
              </Button>
            </div>
          </div>
          
          {/* Search and Filters */}
          {projects.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search presentations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span>Sort by:</span>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Recently Updated</SelectItem>
                    <SelectItem value="created">Recently Created</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                    <SelectItem value="slides">Most Slides</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredProjects.length} of {projects.length} presentations
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Presentation className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Welcome to CodePresent</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">Create beautiful presentations with code syntax highlighting, images, and interactive elements.</p>
            <Button size="lg" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Presentation
            </Button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No presentations found</h3>
            <p className="text-muted-foreground">Try adjusting your search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => {
              const stats = projectStats[project.id!] || { slideCount: 0 }
              
              return (
                <div key={project.id} className="group bg-card border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg leading-tight line-clamp-2 flex-1 pr-2">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPresentation(project)}
                          className="transition-opacity"
                          title="Export as JSON"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProject(project)}
                          className="transition-opacity"
                          title="Rename"
                        >
                          <Type className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project)}
                          className="transition-opacity text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Slide count */}
                    <div className="text-sm text-muted-foreground mb-3">
                      {stats.slideCount === 0 ? 'No slides yet' : 
                       stats.slideCount === 1 ? '1 slide' : 
                       `${stats.slideCount} slides`}
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(project.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Actions */}
                  <div className="px-4 pb-4 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/play/${project.id}`)}
                      disabled={stats.slideCount === 0}
                      className="flex-1"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Present
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/presentation/${project.id}`)}
                      className="flex-1"
                    >
                      <FileEdit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Presentation</DialogTitle>
            <DialogDescription>
              Enter a name for your new presentation. You can always change this later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., React Hooks Deep Dive, Node.js Best Practices"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateProject()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              Create Presentation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Presentation</DialogTitle>
            <DialogDescription>
              Update the name of your presentation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Project name"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveEdit()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editProjectName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Presentation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This will permanently delete all slides and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Presentation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset All Data Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />
              Reset All Data
            </DialogTitle>
            <DialogDescription className="text-base">
              This will permanently delete <strong>ALL {projects.length} presentation{projects.length !== 1 ? 's' : ''}</strong> and their slides. This action cannot be undone.
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
                    {resetRandomNumber}
                  </span>
                </div>
              </div>
              <Input
                placeholder="Enter the number above"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                className="text-center text-lg font-mono border-destructive/50 focus:border-destructive bg-background"
                autoFocus
              />
              {resetConfirmation && resetConfirmation !== resetRandomNumber.toString() && (
                <p className="text-sm text-destructive text-center">
                  The number doesn't match. Please try again.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReset}
              disabled={resetConfirmation !== resetRandomNumber.toString()}
              className="bg-gradient-to-r from-destructive to-destructive/90"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Presentation Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Presentation</DialogTitle>
            <DialogDescription>
              Select a JSON file exported from CodePresent to import a presentation with all its slides.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file-input"
              />
              <label htmlFor="import-file-input">
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragOver 
                      ? 'border-primary bg-primary/5' 
                      : importFile 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                        : 'border-border hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${
                    isDragOver 
                      ? 'text-primary' 
                      : importFile 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-muted-foreground'
                  }`} />
                  <p className="text-sm font-medium mb-1">
                    {isDragOver 
                      ? 'Drop your JSON file here' 
                      : importFile 
                        ? importFile.name 
                        : 'Drag and drop a JSON file, or click to select'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only JSON files exported from CodePresent are supported
                  </p>
                </div>
              </label>
            </div>
            {importError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{importError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmImport} 
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Presentation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}