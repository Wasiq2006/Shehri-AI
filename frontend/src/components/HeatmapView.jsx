import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import Footer from './Footer'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { ArrowLeft } from 'lucide-react'

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

    const bounds = L.latLngBounds(data.map(([lat, lng]) => [lat, lng]))
    map.fitBounds(bounds, { padding: [40, 40] })

    return () => {
      map.removeLayer(layer)
    }
  }, [map, points])

  return null
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

  const stats = { All: points.length }
  points.forEach(p => {
    const cat = p[3] || 'Unknown'
    stats[cat] = (stats[cat] || 0) + 1
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

      {/* Incident Cluster Detail Card */}
      <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 mb-2 slide-up delay-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs font-bold text-slate-900">Islamabad Zone 1 Hotspot</span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">Updated {points.length ? 'Just now' : '4m ago'}</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Highest cluster reported in Sectors F-7 and G-8. Priority repair crews have been deployed to Street 14 and Faisal Ave.
        </p>
      </div>
      
      <div className="mt-4">
        <Footer />
      </div>

    </div>
  )
}
