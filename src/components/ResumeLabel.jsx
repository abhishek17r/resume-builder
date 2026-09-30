import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../lib/store'

// Existing labels, for suggestions.
export const useLabels = () => {
  const resumes = useStore(s => s.resumes)
  return [...new Set(resumes.map(r => r.label).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function LabelChip({ label, className, onClick }) {
  if (!label) return null
  return (
    <span onClick={onClick} className={clsx('inline-flex max-w-full items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand', onClick && 'cursor-pointer hover:bg-brand-hover', className)}>
      <Tag size={11} className="shrink-0" /> <span className="truncate">{label}</span>
    </span>
  )
}

// Click-to-edit label for a resume. Empty clears it.
export function LabelEditor({ resume }) {
  const setLabel = useStore(s => s.setLabel)
  const labels = useLabels()
  const [editing, setEditing] = useState(false)
  const listId = `labels-${resume.id}`

  if (!editing) {
    return resume.label
      ? <LabelChip label={resume.label} onClick={() => setEditing(true)} />
      : (
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] text-muted hover:bg-field hover:text-ink">
          <Tag size={11} /> Add label
        </button>
      )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        list={listId}
        defaultValue={resume.label ?? ''}
        placeholder="e.g. b2c - google"
        maxLength={40}
        className="field w-40 px-2 py-1 text-[13px]"
        onBlur={e => { setLabel(resume.id, e.target.value); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
      />
      {resume.label && (
        <button onMouseDown={e => { e.preventDefault(); setLabel(resume.id, ''); setEditing(false) }} className="text-muted hover:text-red-600" title="Remove label"><X size={14} /></button>
      )}
      <datalist id={listId}>{labels.map(l => <option key={l} value={l} />)}</datalist>
    </span>
  )
}
