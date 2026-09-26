import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { SECTION_TYPES } from '../lib/sections'

export default function AddContentModal({ onClose, onAdded }) {
  const resume = useResume()
  const { addSection, addEntry } = useStore()
  const present = new Set(resume.sections.map(s => s.type))

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = type => {
    const existing = resume.sections.find(s => s.type === type)
    if (existing && type !== 'custom') {
      if (SECTION_TYPES[type].single) return onAdded(existing.id)
      return onAdded(existing.id, addEntry(existing.id))
    }
    const sectionId = addSection(type)
    if (SECTION_TYPES[type].single) return onAdded(sectionId)
    onAdded(sectionId, addEntry(sectionId))
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6 backdrop-blur-[2px]" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-3xl overflow-auto p-8" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center">
          <h2 className="text-[24px] font-bold text-ink">Add content</h2>
          <button onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-field"><X size={20} /></button>
        </div>
        <p className="mb-6 text-muted">Pick a section to add. Sections you already have get a new entry instead.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(SECTION_TYPES).map(([type, def]) => {
            const Icon = def.icon
            const has = present.has(type) && type !== 'custom'
            return (
              <button key={type} onClick={() => pick(type)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand hover:bg-brand-soft">
                <div className="flex w-full items-center gap-2">
                  <Icon size={22} className="text-ink group-hover:text-brand" />
                  <span className="font-bold text-ink">{def.label}</span>
                  {has && <span className="ml-auto rounded-full bg-field px-2 py-0.5 text-[11px] font-medium text-muted">added</span>}
                </div>
                <span className="text-[13px] leading-snug text-muted">{def.blurb}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
