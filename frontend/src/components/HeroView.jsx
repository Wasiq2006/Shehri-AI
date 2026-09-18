import { useRef, useState, useCallback, useEffect } from 'react'
import { MapPin, Scan, Camera, Map } from 'lucide-react'
import Footer from './Footer'

const FALLBACK_LAT = 33.6844
const FALLBACK_LNG = 73.0479
const USER_ID      = 'web_user_001'

function getCoords() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      return resolve({ lat: FALLBACK_LAT, lng: FALLBACK_LNG })
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      ()  => resolve({ lat: FALLBACK_LAT, lng: FALLBACK_LNG }),
      { timeout: 7000 },
    )
  })
}

export default function HeroView({ apiBase, onReport, onViewHeatmap }) {
  const inputRef                 = useRef(null)
  const [loading, setLoading]    = useState(false)
  const [status, setStatus]      = useState('')
  const [error, setError]        = useState(null)
  
  // Async user data state
  const [address, setAddress]    = useState('Locating you...')
  const [totalCases, setTotalCases] = useState('...')

  useEffect(() => {
    // Fetch async user location
    getCoords().then(async ({ lat, lng }) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        const data = await res.json()
        if (data.address) {
          const parts = [data.address.suburb || data.address.neighbourhood, data.address.city || data.address.town]
          setAddress(parts.filter(Boolean).join(', ') || 'Location resolved')
        } else {
          setAddress('Location resolved')
        }
      } catch {
        setAddress('Location unavailable')
      }
    })

    // Fetch async total cases from backend
    fetch(`${apiBase}/api/v1/heatmap`)
      .then(r => r.json())
      .then(d => setTotalCases(d.points ? d.points.length : 0))
      .catch(() => setTotalCases('Unknown'))
  }, [apiBase])

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || loading) return

    setLoading(true)
    setError(null)

    // GPS
    setStatus('Fetching GPS…')
    const { lat, lng } = await getCoords()

    // Upload
    setStatus('Analyzing infrastructure…')
    const fd = new FormData()
    fd.append('user_id', USER_ID)
    fd.append('lat', lat.toString())
    fd.append('lng', lng.toString())
    fd.append('file', file, file.name)

    try {
      const res = await fetch(`${apiBase}/api/v1/submit_report`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'No issues detected.')
        setLoading(false)
        return
      }

      setStatus('Done!')
      await new Promise((r) => setTimeout(r, 300))
      onReport(data)
    } catch (err) {
      setError('Network error: ' + err.message)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [apiBase, loading, onReport])

  return (
    <div className="flex-1 flex flex-col justify-between pt-4 px-5 pb-28 max-w-[430px] mx-auto min-h-screen fade-in">
      
      {/* Top Branding & Editorial Intro */}
      <div className="pt-2 text-center flex flex-col items-center">
        {/* Logo Emblem */}
        <div className="relative mb-4 group cursor-pointer">
          <div className="w-36 h-36 rounded-full p-2 bg-white shadow-floating border border-slate-100 flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
            <img src="/ShehriAILogo.png" alt="ShehriAI Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shehri AI</h1>
        <p className="text-xs font-medium text-slate-500 mt-1 max-w-[280px] leading-relaxed">
          Islamabad's First Civic AI to report Potholes, Streetlights and Make Islamabad Green &amp; Clean
        </p>

        {/* Status Capsule Indicator */}
        <div className="mt-4 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white shadow-soft border border-slate-100 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-emerald-800" />
          <span>{address}</span>
        </div>
      </div>

      {/* Center Feature Card: Camera & Scanner Hub */}
      <div className="my-6">
        <div className="bg-white rounded-[28px] p-6 shadow-soft border border-slate-100/60 relative overflow-hidden flex flex-col items-center text-center">
          {/* Subtle decorative backdrop accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mb-4">
            <Scan className="w-8 h-8 stroke-[1.75]" />
          </div>

          <h2 className="text-lg font-semibold text-slate-900 mb-1">Scan</h2>
          <p className="text-xs text-slate-500 max-w-[240px] mb-6 leading-relaxed">
            Photograph street defects, fallen utility poles, or road hazards. Shehri AI routes directly to CDA.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          
          {/* Massive Tactile Apple-Style Primary Pill Button */}
          <button 
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="w-full py-4 px-6 rounded-full bg-emerald-800 hover:bg-emerald-900 active:scale-[0.98] text-white font-medium text-sm shadow-pill transition-all duration-200 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
               <span className="pulse font-semibold tracking-tight">{status}</span>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="tracking-tight font-semibold">Open Camera &amp; Scan Issue</span>
              </>
            )}
          </button>

          {/* Secondary Quick Action */}
          <div className="mt-4 flex items-center space-x-3 w-full">
            <button 
              onClick={onViewHeatmap}
              className="flex-1 py-3 px-4 rounded-full bg-stone-50 hover:bg-stone-100 active:scale-[0.98] text-slate-700 font-medium text-xs border border-slate-200/70 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50" disabled={loading}
            >
              <Map className="w-3.5 h-3.5 text-emerald-700" />
              <span>City Heatmap</span>
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-xs font-semibold text-red-600 underline">Dismiss</button>
          </div>
        )}
      </div>



      {/* Footer */}
      <Footer />

    </div>
  )
}
