import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet'
import Footer from './Footer'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { ArrowLeft, LocateFixed, Plus, Minus } from 'lucide-react'

// Only these two categories exist in the backend
const VALID_CATEGORIES = ['Pothole', 'Garbage']

function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!L.heatLayer || !points.length) return

    // Scale intensity and cap at 1.0. We boost it slightly so even low severity cases are visible.
    const data = points.map(([lat, lng, sev]) => [lat, lng, Math.min(1.0, (sev / 10) * 1.5)])
    
    const layer = L.heatLayer(data, {
      radius:  25,
      blur:    15,
      maxZoom: 17,
      max:     1.0,
      gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#7f1d1d' },
    }).addTo(map)

    // Guard: fitBounds crashes on a single point — use setView as safe fallback
    const latlngs = data.map(([lat, lng]) => [lat, lng])
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 15)
    } else {
      const bounds = L.latLngBounds(latlngs)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }

    return () => {
      map.removeLayer(layer)
    }
  }, [map, points])

  return null
}

// Pans the map to the user's current GPS location
function LocateUser() {
  const map = useMap()
  const [userPos, setUserPos] = useState(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserPos([latitude, longitude])
        map.setView([latitude, longitude], 14)
      },
      () => { /* silently fall back to default center */ },
      { timeout: 7000 }
    )
  }, [map])

  const handleRelocate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        map.setView([pos.coords.latitude, pos.coords.longitude], 14)
      },
      () => {},
      { timeout: 7000 }
    )
  }

  // Custom blue dot icon using Tailwind classes
  const userIcon = L.divIcon({
    className: 'bg-transparent',
    html: `<div class="w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full shadow-md"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  })

  return (
    <>
      {userPos && <Marker position={userPos} icon={userIcon} />}
      <button
        onClick={handleRelocate}
        title="Go to my location"
        className="absolute top-3 right-3 z-[400] w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 flex items-center justify-center hover:bg-white transition-colors"
      >
        <LocateFixed className={`w-4 h-4 ${userPos ? 'text-emerald-700' : 'text-slate-500'}`} />
      </button>
    </>
  )
}

// Custom zoom controls that match the app's aesthetic
function ZoomButtons() {
  const map = useMap()
  
  return (
    <div className="absolute top-14 right-3 z-[400] flex flex-col shadow-sm border border-slate-100 rounded-[12px] overflow-hidden bg-white/90 backdrop-blur-md">
      <button 
        onClick={() => map.zoomIn()}
        className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border-b border-slate-100 transition-colors active:bg-slate-100"
      >
        <Plus className="w-4 h-4 text-slate-600" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-slate-100"
      >
        <Minus className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  )
}

export default function HeatmapView({ apiBase, onBack }) {
  const [points, setPoints] = useState([])
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    fetch(`${apiBase}/api/v1/heatmap`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPoints(d.points || []))
      .catch((e) => console.error('Heatmap fetch error:', e))
  }, [apiBase])

  // Build stats from only the two valid categories
  const stats = { All: points.length }
  VALID_CATEGORIES.forEach(cat => {
    const count = points.filter(p => p[3] === cat).length
    if (count > 0) stats[cat] = count
  })

  const filteredPoints = activeFilter === 'All'
    ? points
    : points.filter(p => p[3] === activeFilter)

  return (
    <div className="flex-1 flex flex-col pt-4 px-5 pb-28 max-w-[430px] mx-auto min-h-screen fade-in">
      
      {/* Top Bar: Floating Back Pill & Heatmap Title */}
      <div className="flex items-center justify-between mb-3 mt-2">
        <button 
          onClick={onBack}
          className="py-2 px-3.5 rounded-full bg-white shadow-soft text-slate-700 hover:text-emerald-900 border border-slate-100 flex items-center space-x-1.5 text-xs font-medium active:scale-95 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <div className="text-center mr-14">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Heatmap</h2>
        </div>
      </div>

      {/* Map Container with Generous 28px Radii and Leaflet Canvas */}
      <div className="w-full h-[360px] rounded-[28px] overflow-hidden shadow-soft border border-slate-100 relative mb-4 slide-up">
        <MapContainer
          center={[33.6844, 73.0479]}
          zoom={13}
          minZoom={12}
          maxBounds={[
            [33.5000, 72.9000],
            [33.8500, 73.3000]
          ]}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          className="absolute inset-0 w-full h-full"
        >
          {/* Standard OpenStreetMap Tiles */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          {filteredPoints.length > 0 && <HeatLayer points={filteredPoints} />}
          <LocateUser />
          <ZoomButtons />
        </MapContainer>
        
        {/* Floating Filter Capsules on Map */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] flex space-x-1.5 overflow-x-auto p-1 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-slate-100 slide-up delay-1">
          {Object.entries(stats).map(([cat, count]) => {
            const isActive = activeFilter === cat
            return (
              <button 
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`flex-1 py-1.5 px-3 rounded-full text-[10px] font-semibold text-center whitespace-nowrap transition-colors ${isActive ? 'bg-emerald-800 text-white shadow-sm' : 'bg-transparent hover:bg-slate-100 text-slate-600'}`}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Live Report Summary Card */}
      <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 mb-2 slide-up delay-2">
        {points.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-900">Live Report Summary</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                {points.length} Total Report{points.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(stats)
                .filter(([cat]) => cat !== 'All')
                .map(([cat, count]) => (
                  <span key={cat} className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {cat}: {count}
                  </span>
                ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <span className="text-slate-400 text-xs">No reports submitted yet.</span>
            <span className="text-slate-300 text-[10px] mt-0.5">Reports will appear on the map once submitted.</span>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <Footer />
      </div>

    </div>
  )
}
