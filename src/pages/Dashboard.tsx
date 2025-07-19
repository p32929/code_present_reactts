import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Edit, Trash2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { DatabaseService, type Project } from "@/lib/database"

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
  
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const allProjects = await DatabaseService.getAllProjects()
      setProjects(allProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      try {
        const projectId = await DatabaseService.createProject(newProjectName.trim())
        setNewProjectName("")
        setIsDialogOpen(false)
        navigate(`/presentation/${projectId}`)
      } catch (error) {
        console.error('Failed to create project:', error)
      }
    }
  }

  const handleProjectClick = (projectId: number) => {
    navigate(`/presentation/${projectId}`)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full h-12 w-12 border-4 border-transparent border-t-primary/60 animate-ping mx-auto"></div>
          </div>
          <p className="text-muted-foreground text-lg">Loading your projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              My Presentations
            </h1>
            <p className="text-muted-foreground text-lg">Create and manage your presentation projects with ease</p>
            {projects.length > 0 && (
              <p className="text-sm text-muted-foreground/80">
                {projects.length} project{projects.length !== 1 ? 's' : ''} total
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {projects.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleResetAllData}
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg">
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Enter a name for your new presentation project.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateProject()
                      }
                    }}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                    Create Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative mx-auto mb-8 w-32 h-32">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl rotate-6"></div>
              <div className="relative bg-card border border-border rounded-3xl w-full h-full flex items-center justify-center shadow-lg">
                <Plus className="w-12 h-12 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3">Ready to create something amazing?</h3>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Start your journey by creating your first presentation project. It only takes a few seconds!
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg">
                  <Plus className="w-5 h-5" />
                  Create Your First Project
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="group relative overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-border/50 bg-gradient-to-br from-card to-card/50"
              >
                {/* Project ID Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                    #{project.id}
                  </span>
                </div>
                
                <CardHeader className="pb-4">
                  <div className="space-y-3">
                    <div 
                      className="cursor-pointer" 
                      onClick={() => handleProjectClick(project.id!)}
                    >
                      <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors pr-8">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Created {project.createdAt.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditProject(project)
                        }}
                        className="flex-1 gap-2 h-8 hover:bg-primary/10 hover:border-primary/20"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProject(project)
                        }}
                        className="flex-1 gap-2 h-8 text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div 
                    className="cursor-pointer p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => handleProjectClick(project.id!)}
                  >
                    <p className="text-sm text-muted-foreground text-center">
                      Click to open presentation
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the name of your project.
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
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Project
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
              This will permanently delete <strong>ALL {projects.length} project{projects.length !== 1 ? 's' : ''}</strong> and data. This action cannot be undone.
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
    </div>
  )
}