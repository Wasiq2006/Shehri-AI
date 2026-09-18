import { Scan, LayoutGrid, MapPin } from 'lucide-react'

const tabs = [
  { id: 'hero',    label: 'Scanner',  Icon: Scan       },
  { id: 'results', label: 'Report',   Icon: LayoutGrid },
  { id: 'heatmap', label: 'Heatmap',  Icon: MapPin     },
]

export default function NavigationDock({ active, onChange }) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[390px] z-[500]">
      <div className="bg-white/50 backdrop-blur-2xl rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-between transition-all duration-300">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`relative flex-1 py-3 px-3 rounded-full flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.92] ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-[0_2px_12px_rgba(6,78,59,0.3)]'
                  : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isActive ? 'scale-110' : 'scale-100'}`} />
              <span className={`text-[11px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isActive ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
