import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, RotateCcw, Play, FileEdit, Type, Search, Clock, Presentation, Filter, Download, Upload, ChevronDown, Database, FileText, Settings, MoreVertical, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { DatabaseService, type Project, type PresentationPage } from "@/lib/database"
import { GeneratePresentationDialog } from "@/components/GeneratePresentationDialog"

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
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  
  // Generate presentation states
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)

  // Menu states
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Export dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    projects: true,
    settings: true
  })
  
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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

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
        setImportFile(null)
        setImportError("")
        setIsDragOver(false)
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

  const handleExportAllData = async () => {
    try {
      const allData = {
        projects: [],
        settings: {
          titleTopSpacing: localStorage.getItem('presentation-settings-titleTopSpacing') || '8',
          descriptionTitleSpacing: localStorage.getItem('presentation-settings-descriptionTitleSpacing') || '6',
          imageDescriptionSpacing: localStorage.getItem('presentation-settings-imageDescriptionSpacing') || '6',
          codeImageSpacing: localStorage.getItem('presentation-settings-codeImageSpacing') || '6',
          titleFontSize: localStorage.getItem('presentation-settings-titleFontSize') || '5',
          descriptionFontSize: localStorage.getItem('presentation-settings-descriptionFontSize') || '5',
          subtitleFontSize: localStorage.getItem('presentation-settings-subtitleFontSize') || '4',
          subtitleSpacing: localStorage.getItem('presentation-settings-subtitleSpacing') || '8'
        },
        exportedAt: new Date().toISOString()
      }

      for (const project of projects) {
        const pages = await DatabaseService.getProjectPages(project.id!)
        allData.projects.push({
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          slides: pages.map(page => ({
            title: page.title || '',
            description: page.description || '',
            subtitle: page.subtitle || '',
            code: page.code || '',
            codeLanguage: page.codeLanguage || 'javascript',
            image: page.image || ''
          }))
        })
      }

      const dataStr = JSON.stringify(allData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `codepresent_full_backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export all data:', error)
    }
  }

  const handleExportAllSlides = async () => {
    try {
      const allSlides = []

      for (const project of projects) {
        const pages = await DatabaseService.getProjectPages(project.id!)
        allSlides.push({
          name: project.name,
          slides: pages.map(page => ({
            title: page.title || '',
            description: page.description || '',
            subtitle: page.subtitle || '',
            code: page.code || '',
            codeLanguage: page.codeLanguage || 'javascript',
            image: page.image || ''
          }))
        })
      }

      const exportData = {
        presentations: allSlides,
        exportedAt: new Date().toISOString()
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `codepresent_slides_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export slides:', error)
    }
  }

  const handleExportSettings = () => {
    try {
      const settings = {
        titleTopSpacing: localStorage.getItem('presentation-settings-titleTopSpacing') || '8',
        descriptionTitleSpacing: localStorage.getItem('presentation-settings-descriptionTitleSpacing') || '6',
        imageDescriptionSpacing: localStorage.getItem('presentation-settings-imageDescriptionSpacing') || '6',
        codeImageSpacing: localStorage.getItem('presentation-settings-codeImageSpacing') || '6',
        titleFontSize: localStorage.getItem('presentation-settings-titleFontSize') || '5',
        descriptionFontSize: localStorage.getItem('presentation-settings-descriptionFontSize') || '5',
        subtitleFontSize: localStorage.getItem('presentation-settings-subtitleFontSize') || '4',
        subtitleSpacing: localStorage.getItem('presentation-settings-subtitleSpacing') || '8',
        exportedAt: new Date().toISOString()
      }

      const dataStr = JSON.stringify(settings, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `codepresent_settings_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export settings:', error)
    }
  }

  const handleImportAllData = async (file: File) => {
    try {
      const fileContent = await file.text()
      const importData = JSON.parse(fileContent)

      // Validate the import data structure
      if (!importData.projects || !Array.isArray(importData.projects) || !importData.settings) {
        throw new Error("Invalid file format. Expected a JSON file with 'projects' and 'settings' properties.")
      }

      // Import settings
      Object.entries(importData.settings).forEach(([key, value]) => {
        if (key !== 'exportedAt' && typeof value === 'string') {
          localStorage.setItem(`presentation-settings-${key}`, value)
        }
      })

      // Import all projects
      for (const projectData of importData.projects) {
        const projectId = await DatabaseService.createProject(projectData.name)
        
        // Import all slides for this project
        for (const slide of projectData.slides) {
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
      }

      await loadProjects()
    } catch (error) {
      console.error('Failed to import all data:', error)
      throw error
    }
  }

  const handleImportAllPresentations = async (file: File) => {
    try {
      const fileContent = await file.text()
      const importData = JSON.parse(fileContent)

      // Validate the import data structure
      if (!importData.presentations || !Array.isArray(importData.presentations)) {
        throw new Error("Invalid file format. Expected a JSON file with 'presentations' property.")
      }

      // Import all presentations
      for (const presentationData of importData.presentations) {
        const projectId = await DatabaseService.createProject(presentationData.name)
        
        // Import all slides for this presentation
        for (const slide of presentationData.slides) {
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
      }

      await loadProjects()
    } catch (error) {
      console.error('Failed to import presentations:', error)
      throw error
    }
  }

  const handleImportSettings = async (file: File) => {
    try {
      const fileContent = await file.text()
      const importData = JSON.parse(fileContent)

      // Validate the import data structure
      if (typeof importData !== 'object' || !importData.titleTopSpacing) {
        throw new Error("Invalid file format. Expected a settings JSON file.")
      }

      // Import settings
      Object.entries(importData).forEach(([key, value]) => {
        if (key !== 'exportedAt' && typeof value === 'string') {
          localStorage.setItem(`presentation-settings-${key}`, value)
        }
      })

    } catch (error) {
      console.error('Failed to import settings:', error)
      throw error
    }
  }

  const handleUnifiedImport = async (file: File) => {
    try {
      const fileContent = await file.text()
      const importData = JSON.parse(fileContent)

      // Auto-detect file type based on structure
      if (importData.projects && Array.isArray(importData.projects) && importData.settings) {
        // Full backup file (projects + settings)
        console.log('Detected: Full backup file')
        await handleImportAllData(file)
        return 'Imported full backup (projects and settings)'
      } else if (importData.presentations && Array.isArray(importData.presentations)) {
        // Multiple presentations export
        console.log('Detected: Multiple presentations file')
        await handleImportAllPresentations(file)
        return 'Imported multiple presentations'
      } else if (importData.name && Array.isArray(importData.slides)) {
        // Single presentation export
        console.log('Detected: Single presentation file')
        setImportFile(file)
        await handleConfirmImport()
        return 'Imported single presentation'
      } else if (importData.titleTopSpacing && typeof importData === 'object') {
        // Settings export
        console.log('Detected: Settings file')
        await handleImportSettings(file)
        return 'Imported settings'
      } else {
        throw new Error("Unknown file format. Please ensure you're importing a valid CodePresent export file.")
      }
    } catch (error) {
      console.error('Failed to import file:', error)
      if (error instanceof SyntaxError) {
        throw new Error("Invalid JSON file format")
      }
      throw error
    }
  }

  const handleUnifiedExport = async () => {
    try {
      let exportData: any = {}
      let filename = 'codepresent_export'

      if (exportOptions.projects && exportOptions.settings) {
        // Export everything (full backup)
        exportData = {
          projects: [],
          settings: {
            titleTopSpacing: localStorage.getItem('presentation-settings-titleTopSpacing') || '8',
            descriptionTitleSpacing: localStorage.getItem('presentation-settings-descriptionTitleSpacing') || '6',
            imageDescriptionSpacing: localStorage.getItem('presentation-settings-imageDescriptionSpacing') || '6',
            codeImageSpacing: localStorage.getItem('presentation-settings-codeImageSpacing') || '6',
            titleFontSize: localStorage.getItem('presentation-settings-titleFontSize') || '5',
            descriptionFontSize: localStorage.getItem('presentation-settings-descriptionFontSize') || '5',
            subtitleFontSize: localStorage.getItem('presentation-settings-subtitleFontSize') || '4',
            subtitleSpacing: localStorage.getItem('presentation-settings-subtitleSpacing') || '8'
          },
          exportedAt: new Date().toISOString()
        }

        for (const project of projects) {
          const pages = await DatabaseService.getProjectPages(project.id!)
          exportData.projects.push({
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            slides: pages.map(page => ({
              title: page.title || '',
              description: page.description || '',
              subtitle: page.subtitle || '',
              code: page.code || '',
              codeLanguage: page.codeLanguage || 'javascript',
              image: page.image || ''
            }))
          })
        }
        filename = 'codepresent_full_backup'
      } else if (exportOptions.projects) {
        // Export only presentations
        const allSlides = []
        for (const project of projects) {
          const pages = await DatabaseService.getProjectPages(project.id!)
          allSlides.push({
            name: project.name,
            slides: pages.map(page => ({
              title: page.title || '',
              description: page.description || '',
              subtitle: page.subtitle || '',
              code: page.code || '',
              codeLanguage: page.codeLanguage || 'javascript',
              image: page.image || ''
            }))
          })
        }
        exportData = {
          presentations: allSlides,
          exportedAt: new Date().toISOString()
        }
        filename = 'codepresent_presentations'
      } else if (exportOptions.settings) {
        // Export only settings
        exportData = {
          titleTopSpacing: localStorage.getItem('presentation-settings-titleTopSpacing') || '8',
          descriptionTitleSpacing: localStorage.getItem('presentation-settings-descriptionTitleSpacing') || '6',
          imageDescriptionSpacing: localStorage.getItem('presentation-settings-imageDescriptionSpacing') || '6',
          codeImageSpacing: localStorage.getItem('presentation-settings-codeImageSpacing') || '6',
          titleFontSize: localStorage.getItem('presentation-settings-titleFontSize') || '5',
          descriptionFontSize: localStorage.getItem('presentation-settings-descriptionFontSize') || '5',
          subtitleFontSize: localStorage.getItem('presentation-settings-subtitleFontSize') || '4',
          subtitleSpacing: localStorage.getItem('presentation-settings-subtitleSpacing') || '8',
          exportedAt: new Date().toISOString()
        }
        filename = 'codepresent_settings'
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
      setIsExportDialogOpen(false)
    } catch (error) {
      console.error('Failed to export data:', error)
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
      setIsCreateDialogOpen(false)
      setNewProjectName("")
      setImportFile(null)
      setImportError("")
      setIsDragOver(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
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
              <Button variant="outline" onClick={() => setIsGenerateDialogOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Presentation
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Presentation
              </Button>
              <div className="relative" ref={menuRef}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="ml-1"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            try {
                              const message = await handleUnifiedImport(file)
                              alert(message)
                            } catch (error: any) {
                              alert(`Import failed: ${error.message}`)
                            }
                          }
                          setIsMenuOpen(false)
                          e.target.value = ''
                        }}
                        className="hidden"
                        id="unified-import-input"
                      />
                      <label htmlFor="unified-import-input">
                        <button
                          onClick={() => document.getElementById('unified-import-input')?.click()}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
                        >
                          <Upload className="w-4 h-4 mr-3" />
                          Import
                        </button>
                      </label>
                      
                      {projects.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              setIsExportDialogOpen(true)
                              setIsMenuOpen(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
                          >
                            <Download className="w-4 h-4 mr-3" />
                            Export
                          </button>
                          <div className="border-t border-border my-1"></div>
                          <button
                            onClick={() => {
                              handleResetAllData()
                              setIsMenuOpen(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-3" />
                            Reset All Data
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
              Create a new presentation by entering a name or import from a JSON file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Create from scratch */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Create from scratch</h4>
              <Input
                placeholder="e.g., React Hooks Deep Dive, Node.js Best Practices"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newProjectName.trim()) {
                    handleCreateProject()
                  }
                }}
              />
            </div>
            
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or import from file
                </span>
              </div>
            </div>
            
            {/* Import from file */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Import presentation</h4>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : importFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                <Upload className={`w-6 h-6 mx-auto mb-2 ${
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
              {importError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive">{importError}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false)
              setNewProjectName("")
              setImportFile(null)
              setImportError("")
            }}>
              Cancel
            </Button>
            <Button 
              onClick={importFile ? handleConfirmImport : handleCreateProject} 
              disabled={!newProjectName.trim() && !importFile}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Importing...
                </>
              ) : importFile ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Presentation
                </>
              ) : (
                'Create Presentation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for single presentation import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        className="hidden"
      />

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

      {/* Generate Presentation Dialog */}
      <GeneratePresentationDialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
        onComplete={async (projectId) => {
          await loadProjects()
          navigate(`/presentation/${projectId}`)
        }}
      />

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>
              Choose what you'd like to export. The system will automatically create the appropriate file format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">What to export:</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.projects}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, projects: e.target.checked }))}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                  />
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm">All Presentations</span>
                  </div>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.settings}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, settings: e.target.checked }))}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                  />
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-primary" />
                    <span className="text-sm">Presentation Settings</span>
                  </div>
                </label>
              </div>
            </div>
            
            {exportOptions.projects && exportOptions.settings && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Full Backup</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  This will create a complete backup with all presentations and settings.
                </p>
              </div>
            )}
            
            {exportOptions.projects && !exportOptions.settings && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Presentations Only</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Export only your presentations without settings.
                </p>
              </div>
            )}
            
            {!exportOptions.projects && exportOptions.settings && (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Settings Only</span>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Export only your presentation settings configuration.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUnifiedExport}
              disabled={!exportOptions.projects && !exportOptions.settings}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}