import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { DatabaseService, type Project } from "@/lib/database"

export function Presentation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadProject()
  }, [id])

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading presentation...</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border p-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
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
        
        <main className="max-w-6xl mx-auto p-6">
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-semibold">{project?.name}</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center py-20">
          <h2 className="text-4xl font-bold mb-4">Welcome to Presentation Page</h2>
          <p className="text-xl text-muted-foreground mb-8">
            This is your presentation workspace for "{project?.name}"
          </p>
          <div className="bg-card border border-border rounded-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4">Getting Started</h3>
            <p className="text-muted-foreground mb-4">
              This is where you'll create and edit your presentations. 
              The presentation editor and tools will be implemented here.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Project ID: {project?.id}</p>
              <p>Created: {project?.createdAt.toLocaleDateString()}</p>
              <p>Last updated: {project?.updatedAt.toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}