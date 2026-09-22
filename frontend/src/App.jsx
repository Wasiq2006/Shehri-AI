import { useState } from 'react'
import HeroView from './components/HeroView'
import ResultsView from './components/ResultsView'
import HeatmapView from './components/HeatmapView'
import NavigationDock from './components/NavigationDock'

// In dev: VITE_API_URL is empty → Vite proxy forwards /api/* to localhost:10000
// In prod: set VITE_API_URL in Vercel's Environment Variables dashboard
const API_BASE = import.meta.env.VITE_API_URL || ''

export default function App() {
  // 'hero' | 'results' | 'heatmap'
  const [view, setView]       = useState('hero')
  const [result, setResult]   = useState(null)

  function handleReport(data) {
    setResult(data)
    setView('results')
  }

  function resetToHero() {
    setResult(null)
    setView('hero')
  }

  return (
    <div className="min-h-screen">
      {view === 'hero' && (
        <HeroView apiBase={API_BASE} onReport={handleReport} onViewHeatmap={() => setView('heatmap')} />
      )}
      {view === 'results' && (
        <ResultsView data={result} onReset={resetToHero} />
      )}
      {view === 'heatmap' && (
        <HeatmapView apiBase={API_BASE} onBack={() => setView('hero')} />
      )}

      <NavigationDock active={view} onChange={setView} />
    </div>
  )
}
