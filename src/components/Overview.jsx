import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Plus, Copy, Trash2, Search, Pencil, Upload, Target, FileText } from 'lucide-react'
import { useStore } from '../lib/store'
import { Thumbnail } from './Preview'
import { LinkedInIcon } from './BrandIcons'
import { LabelEditor, useLabels } from './ResumeLabel'
import { TEMPLATES } from '../lib/templates'
import { jobScore } from '../lib/optimize/jobScore'

const THUMB_W = 200

export function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`
  return new Date(t).toLocaleDateString()
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-rule pb-6">
      <div>
        <h1 className="display text-[40px] leading-none text-ink">{title}</h1>
        {sub && <p className="mt-2 text-muted">{sub}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function Button({ primary, icon: Icon, children, className, ...p }) {
  return (
    <button {...p} className={clsx('flex items-center gap-2 rounded-md px-4 py-2 text-[14px] font-medium transition disabled:opacity-40',
      primary ? 'bg-ink text-white hover:bg-ink/85' : 'border border-rule bg-white text-ink hover:border-ink/40', className)}>
      {Icon && <Icon size={15} />} {children}
    </button>
  )
}

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
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-lg border border-rule bg-white text-muted"><FileText size={24} /></span>
        <h1 className="display text-[40px] leading-none text-ink">Start with what you have</h1>
        <p className="mt-3 text-muted">Import an existing resume (PDF, Word, text or JSON) or your LinkedIn profile, or start from a blank page.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button icon={Upload} onClick={() => onCreate('file')}>Import a file</Button>
          <Button icon={LinkedInIcon} onClick={() => onCreate('linkedin')}>From LinkedIn</Button>
          <Button primary icon={Plus} onClick={() => onCreate('blank')}>Blank resume</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 pb-28">
      <PageHeader title="Resumes" sub={`${resumes.length} version${resumes.length === 1 ? '' : 's'} · saved in this browser`}>
        <Button icon={Upload} onClick={() => onCreate('file')}>Import</Button>
        <Button icon={Target} onClick={() => onCreate('job')}>Tailor to a job</Button>
        <Button primary icon={Plus} onClick={() => onCreate('blank')}>New resume</Button>
      </PageHeader>

      {(labels.length > 0 || resumes.length > 3) && (
        <div className="-mt-2 mb-8 flex flex-wrap items-center gap-x-5 gap-y-2">
          {labels.length > 0 && [null, ...labels].map(l => (
            <button key={l ?? '__all'} onClick={() => setLabelFilter(l)}
              className={clsx('border-b-2 pb-1 text-[14px] transition', labelFilter === l ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}>
              {l ?? 'All'}
            </button>
          ))}
          {resumes.length > 3 && (
            <label className="ml-auto flex items-center gap-2 rounded-md border border-rule bg-white px-3 focus-within:border-brand">
              <Search size={15} className="text-muted" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="w-44 bg-transparent py-2 text-[14px] outline-none" />
            </label>
          )}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-8 gap-y-10">
        {list.map(r => {
          const template = TEMPLATES.find(t => t.id === r.settings.templateId)?.name
          const job = r.optimize?.job
          const match = job?.analysis && job?.match ? jobScore(r, job.analysis, job.match)?.overall : null
          return (
            <div key={r.id} className="group">
              <div className="relative w-fit">
                <button onClick={() => { selectResume(r.id); onOpen() }} title="Open"
                  className={clsx('block overflow-hidden rounded-[3px] bg-white ring-1 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_36px_-20px_rgba(23,23,27,.4)]',
                    r.id === currentId ? 'ring-ink/50' : 'ring-rule')}>
                  <Thumbnail resume={r} width={THUMB_W} />
                </button>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => duplicateResume(r.id)} className="grid h-7 w-7 place-items-center rounded border border-rule bg-white text-body hover:text-ink" title="Duplicate as a new version"><Copy size={14} /></button>
                  <button onClick={() => confirm(`Delete "${r.name}"? This can't be undone.`) && deleteResume(r.id)} className="grid h-7 w-7 place-items-center rounded border border-rule bg-white text-body hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                </div>
                {match != null && (
                  <span className={clsx('meta absolute bottom-2 left-2 rounded-sm px-1.5 py-0.5 text-white', match >= 80 ? 'bg-emerald-700' : match >= 60 ? 'bg-amber-600' : 'bg-red-600')} title={`Match for ${job.analysis.title}`}>
                    {match} match
                  </span>
                )}
              </div>
              <div className="mt-3" style={{ maxWidth: THUMB_W }}>
                {renaming === r.id ? (
                  <input autoFocus defaultValue={r.name} className="field py-1 text-[15px] font-medium"
                    onBlur={e => { renameResume(r.id, e.target.value.trim() || r.name); setRenaming(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }} />
                ) : (
                  <button onClick={() => setRenaming(r.id)} className="group/name flex max-w-full items-center gap-1.5 text-left" title="Rename">
                    <span className="truncate text-[15px] font-medium text-ink">{r.name}</span>
                    <Pencil size={12} className="shrink-0 text-muted opacity-0 group-hover/name:opacity-100" />
                  </button>
                )}
                <p className="meta mt-1 truncate text-muted">{[ago(r.updatedAt), template].filter(Boolean).join(' · ')}</p>
                <div className="mt-1.5"><LabelEditor resume={r} /></div>
              </div>
            </div>
          )
        })}
      </div>
      {(query || labelFilter) && !list.length && <p className="mt-6 text-muted">No resumes match{query ? ` “${query}”` : ''}{labelFilter ? ` with label “${labelFilter}”` : ''}.</p>}
    </div>
  )
}
