import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const getIcon = () => {
    if (theme === "light") return <Sun className="h-[1.2rem] w-[1.2rem]" />
    if (theme === "dark") return <Moon className="h-[1.2rem] w-[1.2rem]" />
    return <Sun className="h-[1.2rem] w-[1.2rem] dark:hidden" />
  }

  const getTitle = () => {
    if (theme === "light") return "Switch to dark mode"
    if (theme === "dark") return "Switch to system theme"
    return "Switch to light mode"
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={getTitle()}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}