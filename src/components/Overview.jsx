import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Plus, Copy, Trash2, Search, Pencil, Upload, FileText } from 'lucide-react'
import { useStore } from '../lib/store'
import { Thumbnail } from './Preview'
import { LinkedInIcon } from './BrandIcons'
import { LabelEditor, useLabels } from './ResumeLabel'

const THUMB_W = 220

export default function Overview({ onOpen, onCreate }) {
  const { resumes, currentId, selectResume, duplicateResume, deleteResume, renameResume } = useStore()
  const [query, setQuery] = useState('')
  const [labelFilter, setLabelFilter] = useState(null)
  const labels = useLabels()
  const [renaming, setRenaming] = useState(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return resumes
      .filter(r => !labelFilter || r.label === labelFilter)
      .filter(r => !q || `${r.name} ${r.label ?? ''} ${r.personal.fullName} ${r.personal.jobTitle}`.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [resumes, query, labelFilter])

  if (!resumes.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white text-muted shadow-sm"><FileText size={30} /></span>
        <h1 className="text-[26px] font-extrabold text-ink">No resumes yet</h1>
        <p className="mt-2 text-muted">Start from scratch or import an existing resume (PDF, Word, text or JSON).</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => onCreate('file')} className="flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-ink ring-1 ring-slate-200 hover:ring-slate-400">
            <Upload size={17} /> Import a file
          </button>
          <button onClick={() => onCreate('linkedin')} className="flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-ink ring-1 ring-slate-200 hover:ring-slate-400">
            <LinkedInIcon size={17} /> From LinkedIn
          </button>
          <button onClick={() => onCreate('blank')} className="cta flex items-center gap-2 rounded-lg px-5 py-3 font-semibold text-white hover:brightness-110">
            <Plus size={18} /> New resume
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-0">
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="mb-1 text-[30px] font-extrabold text-ink">Your resumes</h1>
          <p className="text-muted">{resumes.length} resume{resumes.length === 1 ? '' : 's'} · saved in this browser automatically</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {resumes.length > 3 && (
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand/40">
              <Search size={16} className="text-muted" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search resumes" className="w-44 bg-transparent py-2.5 text-[14px] outline-none" />
            </label>
          )}
          <button onClick={() => onCreate('blank')} className="cta flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white hover:brightness-110">
            <Plus size={18} /> New resume
          </button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">Labels</span>
          {[null, ...labels].map(l => (
            <button key={l ?? '__all'} onClick={() => setLabelFilter(l)}
              className={`rounded-full px-3 py-1 text-[13px] transition ${labelFilter === l ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-slate-200 hover:ring-slate-400'}`}>
              {l ?? 'All'}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
        {list.map(r => {
          return (
            <div key={r.id} className={clsx('card group relative p-3 transition', r.id === currentId && 'ring-2 ring-brand/50')}>
              <button onClick={() => { selectResume(r.id); onOpen() }} className="block w-full" title="Open">
                <div className="mx-auto w-fit overflow-hidden rounded-md ring-1 ring-slate-200 transition group-hover:ring-brand/40">
                  <Thumbnail resume={r} width={THUMB_W} />
                </div>
              </button>
              <div className="mt-3 flex items-center gap-1 px-1">
                <div className="min-w-0 flex-1">
                  {renaming === r.id ? (
                    <input
                      autoFocus
                      defaultValue={r.name}
                      className="field py-1 text-[15px] font-bold"
                      onBlur={e => { renameResume(r.id, e.target.value.trim() || r.name); setRenaming(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }}
                    />
                  ) : (
                    <button onClick={() => setRenaming(r.id)} className="group/name flex max-w-full items-center gap-1.5 text-left" title="Rename">
                      <span className="truncate font-bold text-ink">{r.name}</span>
                      <Pencil size={13} className="shrink-0 text-muted opacity-0 group-hover/name:opacity-100" />
                    </button>
                  )}
                  <div className="my-1"><LabelEditor resume={r} /></div>
                  <p className="text-[12px] text-muted">Edited {new Date(r.updatedAt).toLocaleString()}</p>
                </div>
                <>
                    <button onClick={() => duplicateResume(r.id)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-field hover:text-ink" title="Duplicate as new version"><Copy size={16} /></button>
                    <button onClick={() => confirm(`Delete "${r.name}"? This can't be undone.`) && deleteResume(r.id)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                </>
              </div>
            </div>
          )
        })}
      </div>
      {(query || labelFilter) && !list.length && <p className="mt-6 text-muted">No resumes match{query ? ` “${query}”` : ''}{labelFilter ? ` with label “${labelFilter}”` : ''}.</p>}


    </div>
  )
}
