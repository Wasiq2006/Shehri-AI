import { useState } from 'react'
import HeroView from './components/HeroView'
import ResultsView from './components/ResultsView'
import HeatmapView from './components/HeatmapView'
import NavigationDock from './components/NavigationDock'

const API_BASE = 'http://localhost:8000'

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
        <HeroView apiBase={API_BASE} onReport={handleReport} />
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
