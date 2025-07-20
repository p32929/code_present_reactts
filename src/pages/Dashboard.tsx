import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, RotateCcw, Play, FileEdit, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { DatabaseService, type Project } from "@/lib/database"

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
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
      <header className="border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">CodePresent</h1>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {projects.length > 0 && (
              <Button
                variant="outline"
                onClick={handleResetAllData}
                className="text-destructive hover:text-destructive"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All
              </Button>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6">Create your first presentation to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-lg border">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4 font-medium">ID</th>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Created</th>
                  <th className="text-left p-4 font-medium">Updated</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 text-sm text-muted-foreground">#{project.id}</td>
                    <td className="p-4 font-medium">{project.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {project.createdAt.toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {project.updatedAt.toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/presentation/${project.id}?play=true`)}
                          title="Play presentation"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/presentation/${project.id}`)}
                          title="Edit presentation"
                        >
                          <FileEdit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProject(project)}
                          title="Edit title"
                        >
                          <Type className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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