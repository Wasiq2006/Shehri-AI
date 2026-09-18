import { useEffect, useState } from 'react'
import { ArrowLeft, Map, MapPin, Building2, Clock, Zap, UserCheck, Check, LayoutGrid } from 'lucide-react'
import Footer from './Footer'

export default function ResultsView({ data, onReset }) {
  const [uploadAddress, setUploadAddress] = useState('Resolving location...')
  const [exifAddress, setExifAddress] = useState('Resolving location...')
  const [note, setNote] = useState('')
  
  useEffect(() => {
    const fetchAddress = async (lat, lng) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        const d = await r.json()
        if (d.address) {
          const parts = [d.address.road, d.address.suburb, d.address.city || d.address.town]
          return parts.filter(Boolean).join(', ') || 'Location resolved'
        }
        return 'Location resolved'
      } catch {
        return 'Location unavailable'
      }
    }

    if (!data) return

    if (data.lat && data.lng) {
      fetchAddress(data.lat, data.lng).then(setUploadAddress)
    } else {
      setUploadAddress('Current Location (GPS)')
    }

    if (data.exif_location?.latitude && data.exif_location?.longitude) {
      fetchAddress(data.exif_location.latitude, data.exif_location.longitude).then(setExifAddress)
    } else {
      setExifAddress('No EXIF Data')
    }
  }, [data])

  if (!data) {
    return (
      <div className="flex-1 flex flex-col pt-4 px-5 pb-28 max-w-[430px] mx-auto min-h-screen fade-in">
        <div className="flex items-center justify-between mb-4 mt-2">
          <button 
            onClick={onReset}
            className="py-2 px-3.5 rounded-full bg-white shadow-soft text-slate-700 hover:text-emerald-900 border border-slate-100 flex items-center space-x-1.5 text-xs font-medium active:scale-95 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="text-center mr-14">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Report</h2>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center -mt-10">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100/60 shadow-soft">
            <LayoutGrid className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No active report</h3>
          <p className="text-sm text-slate-500 max-w-[220px] leading-relaxed">Scan an issue using the camera to generate a civic AI report.</p>
          <button 
            onClick={onReset}
            className="mt-6 py-2.5 px-6 rounded-full bg-emerald-800 hover:bg-emerald-900 active:scale-[0.98] text-white font-medium text-xs shadow-[0_4px_14px_rgba(6,78,59,0.2)] transition-all"
          >
            Open Scanner
          </button>
        </div>

        <div className="mt-4">
          <Footer />
        </div>
      </div>
    )
  }

  const score = data.severity_score ?? 0
  
  const isHigh = score >= 5
  const severityBadgeClass = isHigh
    ? 'bg-rose-50 border border-rose-100 text-rose-700'
    : 'bg-amber-50 border border-amber-100 text-amber-700'
  const severityDotClass = isHigh ? 'bg-rose-500' : 'bg-amber-500'
  const severityText = isHigh ? 'High Severity • Priority 1' : 'Moderate Severity • Priority 2'

  return (
    <div className="flex-1 flex flex-col pt-4 px-5 pb-28 max-w-[430px] mx-auto min-h-screen fade-in">
      
      {/* Top Navigation Pill Header for Results */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <button onClick={onReset} className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center text-slate-600 hover:text-emerald-900 transition-colors border border-slate-100">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inspection Analysis</span>
        <button className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center text-slate-600 hover:text-emerald-900 transition-colors border border-slate-100">
          <Map className="w-4 h-4" />
        </button>
      </div>

      {/* Annotated image map header (added from previous API requirement while maintaining aesthetic) */}
      <div className="bg-white rounded-[28px] overflow-hidden shadow-soft border border-slate-100/70 mb-4 slide-up">
        <div className="relative">
          <img src={data.annotated_image} alt="Annotated detection" className="w-full object-cover max-h-56" />
          <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
            AI Annotated
          </span>
        </div>
      </div>

      {/* Primary Incident Header Card */}
      <div className="bg-white rounded-[28px] p-5 shadow-soft border border-slate-100/70 mb-4 slide-up delay-1">
        <div className="flex items-start justify-between">
          <div>
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full ${severityBadgeClass} text-[11px] font-medium mb-2`}>
              <span className={`w-1.5 h-1.5 rounded-full ${severityDotClass} mr-1.5`}></span>
              {severityText}
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{data.detection || 'Unknown Issue'}</h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center truncate max-w-[200px]" title={uploadAddress}>
              <MapPin className="w-3.5 h-3.5 text-emerald-800 mr-1 shrink-0" />
              <span className="truncate">{uploadAddress}</span>
            </p>
          </div>
          {/* Severity Dial / Metric Badge */}
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center shrink-0">
            <span className="text-base font-bold text-amber-800">{score.toFixed(1)}</span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-700">Risk</span>
          </div>
        </div>
      </div>

      {/* Bento Cards Grid: Soft Apple-Style Summary Units */}
      <div className="grid grid-cols-2 gap-3 mb-4 slide-up delay-2">
        
        {/* Bento Card 1: EXIF & Upload Location */}
        <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mb-1 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block leading-none mb-0.5">Capture Location</span>
              <span className="text-[11px] font-semibold text-slate-800 block truncate" title={exifAddress}>
                {exifAddress}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block leading-none mb-0.5">Upload Location</span>
              <span className="text-[11px] font-semibold text-slate-800 block truncate" title={uploadAddress}>
                {uploadAddress}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Card 2: Upload Time */}
        <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Upload Time</span>
            <span className="text-xs font-semibold text-slate-800">
              {data.upload_time ? new Date(data.upload_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
            </span>
          </div>
        </div>

        {/* Bento Card 3: Hazard Classification */}
        <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center mb-2">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">AI Confidence</span>
            <span className="text-xs font-semibold text-slate-800">{Math.round((data.confidence ?? 0) * 100)}% Match</span>
          </div>
        </div>

        {/* Bento Card 4: Note Input */}
        <div className="bg-white rounded-[24px] p-4 shadow-soft border border-slate-100/70 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mb-2 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="w-full">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">Add Note</span>
            <input 
              type="text" 
              placeholder="Tap to type..." 
              className="w-full text-xs font-semibold text-slate-800 bg-transparent border-b border-slate-200 focus:border-emerald-500 focus:outline-none pb-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

      </div>

      {/* Action Confirmation Pill */}
      <div className="mt-auto space-y-2.5 slide-up delay-3">
        <a 
          href={`mailto:cdacares@cda.gov.pk?subject=ShehriAI Report: ${data.detection}&body=Report ID: ${data.report_id}%0ASeverity: ${score}/10${note ? `%0AUser Note: ${encodeURIComponent(note)}` : ''}`}
          className="w-full py-4 px-6 rounded-full hover:bg-emerald-900 active:scale-[0.98] text-white font-medium text-sm shadow-pill transition-all duration-200 flex items-center justify-center space-x-2 bg-slate-900"
        >
          <Check className="w-4 h-4" />
          <span className="font-semibold">Forward Report to CDA</span>
        </a>
        <button 
          onClick={onReset}
          className="w-full py-3 px-6 rounded-full bg-white hover:bg-stone-50 active:scale-[0.98] text-slate-700 font-medium text-xs border border-slate-200/80 transition-all text-center"
        >
          Cancel or Rescan
        </button>
      </div>
      
      <div className="mt-4">
        <Footer />
      </div>

    </div>
  )
}
