import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { LayoutGrid, FileText, Paintbrush, Gauge, Download, EllipsisVertical, ChevronDown, Trash2, Pencil, Plus, Upload, FileJson, GitBranch, Tag, ArrowLeft } from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { LinkedInIcon } from './BrandIcons'

const TABS = [
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'customize', label: 'Customize', icon: Paintbrush },
  { id: 'optimize', label: 'Optimize', icon: Gauge },
]

export default function TopBar({ view, setView, onDownload, openCreate }) {
  const resume = useResume()
  const { resumes, selectResume, deleteResume, renameResume, setLabel } = useStore()
  const [menu, setMenu] = useState(null) // 'resumes' | 'more' | null
  const ref = useRef(null)

  useEffect(() => {
    const close = e => ref.current && !ref.current.contains(e.target) && setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  // Home pages (Overview, New resume) show just the app name; Content and Customize belong
  // to an open resume, so they only appear in the editor.
  const editing = resume && ['content', 'customize', 'optimize'].includes(view)
  if (!editing) {
    return (
      <header className="card sticky top-0 z-30 mx-auto flex items-center gap-3 rounded-t-none px-5 py-3.5 sm:rounded-2xl">
        <button onClick={() => setView('overview')} className="flex items-center gap-2.5 text-[17px] font-bold text-ink">
          <span className="cta grid h-8 w-8 place-items-center rounded-lg text-white"><FileText size={17} /></span>
          Resume Builder
        </button>
        {view !== 'overview' && (
          <button onClick={() => setView('overview')} className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-medium text-muted hover:bg-soft hover:text-ink">
            <LayoutGrid size={16} /> All resumes
          </button>
        )}
      </header>
    )
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${resume.name.replace(/\W+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <header ref={ref} className="card sticky top-0 z-30 mx-auto flex items-center gap-2 rounded-t-none px-4 py-3 sm:rounded-2xl lg:top-0">
      <button onClick={() => setView('overview')} title="All resumes"
        className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-soft hover:text-ink">
        <ArrowLeft size={18} /> <span className="hidden lg:inline">All resumes</span>
      </button>

      <div className="relative">
        <button onClick={() => setMenu(m => (m === 'resumes' ? null : 'resumes'))} title="Switch resume"
          className="flex max-w-[16rem] items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-semibold text-ink hover:bg-soft">
          <span className="min-w-0 truncate">{resume.name}{resume.label && <span className="font-normal text-muted"> · {resume.label}</span>}</span> <ChevronDown size={16} className="shrink-0 text-muted" />
        </button>
        {menu === 'resumes' && (
          <Menu left>
            <div className="max-h-72 overflow-auto">
              {[...resumes].sort((a, b) => b.updatedAt - a.updatedAt).map(r => (
                <MenuItem key={r.id} active={r.id === resume.id} onClick={() => { selectResume(r.id); setMenu(null) }}>
                  {r.name}{r.label && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">{r.label}</span>}
                </MenuItem>
              ))}
            </div>
            <div className="my-1 border-t border-slate-100" />
            <MenuItem icon={Plus} onClick={() => { openCreate('blank'); setMenu(null) }}>New resume…</MenuItem>
            <MenuItem icon={GitBranch} onClick={() => { openCreate('copy'); setMenu(null) }}>New version of this…</MenuItem>
            <MenuItem icon={Upload} onClick={() => { openCreate('file'); setMenu(null) }}>Import resume…</MenuItem>
            <MenuItem icon={LinkedInIcon} onClick={() => { openCreate('linkedin'); setMenu(null) }}>Import from LinkedIn…</MenuItem>
          </Menu>
        )}
      </div>

      <nav className="mx-auto flex gap-1 rounded-xl bg-field p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={clsx('flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-medium transition sm:px-5',
              view === t.id ? 'bg-white text-brand shadow-sm' : 'text-body hover:text-ink')}>
            <t.icon size={19} /> <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button onClick={onDownload} className="flex items-center gap-2.5 rounded-lg bg-ink px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-ink/90">
          Download <Download size={18} />
        </button>

        <div className="relative">
          <button onClick={() => setMenu(m => (m === 'more' ? null : 'more'))} className="grid h-11 w-10 place-items-center rounded-lg border border-ink text-ink hover:bg-soft" title="More">
            <EllipsisVertical size={18} />
          </button>
          {menu === 'more' && (
            <Menu>
              <MenuItem icon={Plus} onClick={() => { openCreate('blank'); setMenu(null) }}>New resume…</MenuItem>
              <MenuItem icon={GitBranch} onClick={() => { openCreate('copy'); setMenu(null) }}>New version of this…</MenuItem>
              <div className="my-1 border-t border-slate-100" />
              <MenuItem icon={Pencil} onClick={() => { const n = prompt('Rename resume', resume.name); if (n?.trim()) renameResume(resume.id, n.trim()); setMenu(null) }}>Rename</MenuItem>
              <MenuItem icon={Tag} onClick={() => { const l = prompt('Label (leave empty to remove), e.g. "b2c - google"', resume.label ?? ''); if (l !== null) setLabel(resume.id, l); setMenu(null) }}>{resume.label ? 'Edit label' : 'Add label'}</MenuItem>
              <MenuItem icon={FileJson} onClick={() => { exportJson(); setMenu(null) }}>Export as JSON</MenuItem>
              <MenuItem icon={Upload} onClick={() => { openCreate('file'); setMenu(null) }}>Import resume…</MenuItem>
              <div className="my-1 border-t border-slate-100" />
              <MenuItem icon={Trash2} danger onClick={() => { if (confirm(`Delete "${resume.name}"?`)) deleteResume(resume.id); setMenu(null) }}>Delete resume</MenuItem>
            </Menu>
          )}
        </div>
      </div>
    </header>
  )
}

function Menu({ children, left }) {
  return <div className={clsx('card absolute top-full z-40 mt-2 w-60 p-1.5 shadow-xl ring-1 ring-black/5', left ? 'left-0' : 'right-0')}>{children}</div>
}

function MenuItem({ icon: Icon, children, active, danger, ...p }) {
  return (
    <button {...p} className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition',
      danger ? 'text-red-600 hover:bg-red-50' : 'text-ink hover:bg-soft', active && 'bg-brand-soft font-semibold text-brand')}>
      {Icon && <Icon size={16} />} <span className="truncate">{children}</span>
    </button>
  )
}
