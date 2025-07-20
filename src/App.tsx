import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { Dashboard } from "./pages/Dashboard"
import { Presentation } from "./pages/Presentation"
import { Play } from "./pages/Play"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="presentations-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/presentation/:id" element={<Presentation />} />
          <Route path="/play/:id" element={<Play />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
