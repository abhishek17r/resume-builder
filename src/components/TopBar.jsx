import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  FileText, Paintbrush, Gauge, Archive, Download, MoreHorizontal, ChevronDown, Trash2, Pencil, Plus, Upload, FileJson,
  GitBranch, Tag, Home, Files, Target, HardDrive, Menu as MenuIcon, X, PanelLeftClose, PanelLeftOpen, Plug,
} from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { useServerStatus } from '../lib/useServerStatus'
import { APP_NAME } from '../config/app'
import { LinkedInIcon } from './BrandIcons'

// The app's frame: a left sidebar on desktop (a compact bar with a drawer on small screens).

export function Mark({ size = 28 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[7px] bg-ink text-canvas" style={{ width: size, height: size }}>
      <span className="display leading-none" style={{ fontSize: size * 0.78, marginTop: -size * 0.04 }}>o</span>
    </span>
  )
}

// Collapsed or expanded, as last chosen; until you choose, it's collapsed in the editor (room for the page preview).
const PREF = 'rw.sidebar'
const readPref = () => { try { return localStorage.getItem(PREF) } catch { return null } }

export function Sidebar({ view, setView, openCreate, createTab }) {
  const { resumes, currentId, selectResume } = useStore()
  const vaultCount = useStore(s => s.vault.items.reduce((n, i) => n + i.bullets.length, 0))
  const [open, setOpen] = useState(false)
  const recent = [...resumes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  const editing = ['content', 'customize', 'optimize'].includes(view)
  const go = v => { setView(v); setOpen(false) }
  const [pref, setPref] = useState(readPref)
  const collapsed = pref ? pref === 'collapsed' : editing
  const toggle = () => {
    const next = collapsed ? 'expanded' : 'collapsed'
    setPref(next)
    try { localStorage.setItem(PREF, next) } catch { /* private mode */ }
  }
  useEffect(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggle() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rail = (
    <div className="flex h-full flex-col items-center gap-1 py-5">
      <button onClick={() => go('home')} title={APP_NAME} className="mb-3"><Mark /></button>
      <RailBtn title="New resume" onClick={() => openCreate('blank')} dark><Plus size={17} /></RailBtn>
      <div className="my-2 h-px w-6 bg-rule" />
      <RailBtn title="Home" active={view === 'home'} onClick={() => go('home')}><Home size={17} /></RailBtn>
      <RailBtn title={`Resumes (${resumes.length})`} active={view === 'overview'} onClick={() => go('overview')}><Files size={17} /></RailBtn>
      <RailBtn title={`Vault (${vaultCount})`} active={view === 'vault'} onClick={() => go('vault')}><Archive size={17} /></RailBtn>
      <RailBtn title="Tailor to a job" active={view === 'new' && createTab === 'job'} onClick={() => openCreate('job')}><Target size={17} /></RailBtn>
      <RailBtn title="Integrations" active={view === 'integrations'} onClick={() => go('integrations')}><Plug size={17} /></RailBtn>
      <div className="mt-auto flex flex-col items-center gap-2">
        <button onClick={() => go('integrations')} className="grid h-5 w-5 place-items-center"><LocalDot /></button>
        <RailBtn title="Expand sidebar (⌘\)" onClick={toggle}><PanelLeftOpen size={17} /></RailBtn>
      </div>
    </div>
  )

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 pb-5 pl-5 pr-3 pt-6">
        <button onClick={() => go('home')} className="flex min-w-0 items-center gap-2.5 text-left">
          <Mark />
          <span className="display truncate text-[19px] leading-none text-ink">{APP_NAME}</span>
        </button>
        <button onClick={toggle} title="Collapse sidebar (⌘\)" className="ml-auto hidden h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-field hover:text-ink md:grid">
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="px-3">
        <button onClick={() => { openCreate('blank'); setOpen(false) }} className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2.5 text-[14px] font-medium text-white transition hover:bg-ink/85">
          <Plus size={16} /> New resume
        </button>
      </div>

      <nav className="mt-5 space-y-0.5 px-3">
        <NavItem icon={Home} active={view === 'home'} onClick={() => go('home')}>Home</NavItem>
        <NavItem icon={Files} active={view === 'overview'} onClick={() => go('overview')} count={resumes.length}>Resumes</NavItem>
        <NavItem icon={Archive} active={view === 'vault'} onClick={() => go('vault')} count={vaultCount}>Vault</NavItem>
        <NavItem icon={Target} active={view === 'new' && createTab === 'job'} onClick={() => { openCreate('job'); setOpen(false) }}>Tailor to a job</NavItem>
        <NavItem icon={Plug} active={view === 'integrations'} onClick={() => go('integrations')}>Integrations</NavItem>
      </nav>

      {recent.length > 0 && (
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3">
          <p className="meta px-2.5 pb-2 uppercase tracking-[0.08em] text-muted">Recent</p>
          <div className="space-y-0.5">
            {recent.map(r => (
              <button key={r.id} onClick={() => { selectResume(r.id); go('content') }}
                className={clsx('group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition',
                  editing && r.id === currentId ? 'bg-white text-ink ring-1 ring-rule' : 'text-body hover:bg-white/60 hover:text-ink')}>
                <FileText size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {r.label && <span className="meta shrink-0 truncate text-[11px] text-muted">{r.label}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <LocalStatus onOpen={() => go('integrations')} />
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className={clsx('sticky top-0 hidden h-screen shrink-0 border-r border-rule bg-paper md:block', collapsed ? 'w-[60px]' : 'w-60')}>
        {collapsed ? rail : nav}
      </aside>

      {/* Small screens: a compact bar and a drawer */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-rule bg-paper px-4 py-3 md:hidden">
        <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-md text-ink hover:bg-field" aria-label="Menu"><MenuIcon size={18} /></button>
        <button onClick={() => go('home')} className="flex items-center gap-2"><Mark size={24} /><span className="display text-[19px] text-ink">{APP_NAME}</span></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-rule bg-paper">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-field" aria-label="Close"><X size={16} /></button>
            {nav}
          </aside>
        </div>
      )}
    </>
  )
}

function RailBtn({ title, active, dark, children, ...p }) {
  return (
    <button {...p} title={title} aria-label={title}
      className={clsx('grid h-9 w-9 place-items-center rounded-md transition',
        dark ? 'bg-ink text-white hover:bg-ink/85' : active ? 'bg-white text-brand ring-1 ring-rule' : 'text-muted hover:bg-white/70 hover:text-ink')}>
      {children}
    </button>
  )
}

function LocalDot() {
  const server = useServerStatus()
  const dot = server === null ? 'bg-slate-300' : server === false ? 'bg-red-500' : server.mock ? 'bg-amber-500' : 'bg-emerald-600'
  const text = server === null ? 'Checking AI server…' : server === false ? 'AI server offline' : server.mock ? 'AI in demo mode' : `AI · ${server.label ?? server.provider} · ${server.model}`
  return <span title={`Saved in this browser · ${text}`} className={clsx('mb-1 h-[7px] w-[7px] rounded-full', dot)} />
}

function NavItem({ icon: Icon, active, count, children, ...p }) {
  return (
    <button {...p} className={clsx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] transition',
      active ? 'bg-white font-medium text-ink ring-1 ring-rule' : 'text-body hover:bg-white/60 hover:text-ink')}>
      <Icon size={16} className={active ? 'text-brand' : 'text-muted'} />
      <span className="flex-1">{children}</span>
      {count != null && <span className="meta text-muted">{count}</span>}
    </button>
  )
}

// Where things live: resumes in this browser, AI through the local server.
function LocalStatus({ onOpen }) {
  const server = useServerStatus()
  const dot = server === null ? 'bg-slate-300' : server === false ? 'bg-red-500' : server.mock ? 'bg-amber-500' : 'bg-emerald-600'
  const text = server === null ? 'Checking AI server…' : server === false ? 'AI server offline' : server.mock ? 'AI in demo mode · set up' : `AI · ${server.model ?? server.provider}`
  return (
    <div className="mt-auto border-t border-rule px-5 py-4">
      <p className="flex items-center gap-2 text-[12.5px] text-body"><HardDrive size={13} className="text-muted" /> Saved in this browser</p>
      <button onClick={onOpen} className="mt-1.5 flex w-full items-center gap-2 text-left text-[12.5px] text-body hover:text-ink" title={server === false ? 'Start it with npm run dev' : 'AI provider settings'}>
        <span className={clsx('ml-[3px] h-[7px] w-[7px] shrink-0 rounded-full', dot)} /> <span className="truncate">{text}</span>
      </button>
    </div>
  )
}

const TABS = [
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'customize', label: 'Design', icon: Paintbrush },
  { id: 'optimize', label: 'Optimize', icon: Gauge },
]

// Header for an open resume: where you are, the three editor tabs, and document actions.
export function EditorHeader({ view, setView, onDownload, openCreate }) {
  const resume = useResume()
  const { resumes, selectResume, deleteResume, renameResume, setLabel, duplicateResume } = useStore()
  const [menu, setMenu] = useState(null) // 'resumes' | 'more' | null
  const ref = useRef(null)

  useEffect(() => {
    const close = e => ref.current && !ref.current.contains(e.target) && setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${resume.name.replace(/\W+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <header ref={ref} className="z-30 shrink-0 border-b border-rule bg-canvas/95 px-4 backdrop-blur sm:px-8">
      <div className="flex items-center gap-3 pt-4">
        <div className="relative min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <button onClick={() => setView('overview')} className="hover:text-ink">Resumes</button>
            <span>/</span>
          </div>
          <button onClick={() => setMenu(m => (m === 'resumes' ? null : 'resumes'))} title="Switch resume"
            className="-ml-1 flex max-w-[26rem] items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-field">
            <span className="display min-w-0 truncate text-[26px] leading-tight text-ink">{resume.name}</span>
            {resume.label && <span className="meta shrink-0 rounded-sm bg-brand-soft px-1.5 py-0.5 text-brand">{resume.label}</span>}
            <ChevronDown size={16} className="shrink-0 text-muted" />
          </button>
          {menu === 'resumes' && (
            <Menu left>
              <div className="max-h-72 overflow-auto">
                {[...resumes].sort((a, b) => b.updatedAt - a.updatedAt).map(r => (
                  <MenuItem key={r.id} active={r.id === resume.id} onClick={() => { selectResume(r.id); setMenu(null) }}>
                    {r.name}{r.label && <span className="meta ml-1.5 text-muted">{r.label}</span>}
                  </MenuItem>
                ))}
              </div>
              <div className="my-1 border-t border-rule" />
              <MenuItem icon={Plus} onClick={() => { openCreate('blank'); setMenu(null) }}>New resume…</MenuItem>
              <MenuItem icon={GitBranch} onClick={() => { duplicateResume(resume.id); setMenu(null) }}>New version of this…</MenuItem>
              <MenuItem icon={Upload} onClick={() => { openCreate('file'); setMenu(null) }}>Import resume…</MenuItem>
              <MenuItem icon={LinkedInIcon} onClick={() => { openCreate('linkedin'); setMenu(null) }}>Import from LinkedIn…</MenuItem>
            </Menu>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={onDownload} className="flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-white transition hover:bg-ink/85">
            <Download size={16} /> <span className="hidden sm:inline">Download PDF</span>
          </button>
          <div className="relative">
            <button onClick={() => setMenu(m => (m === 'more' ? null : 'more'))} className="grid h-9 w-9 place-items-center rounded-md border border-rule bg-white text-ink hover:bg-field" title="More">
              <MoreHorizontal size={17} />
            </button>
            {menu === 'more' && (
              <Menu>
                <MenuItem icon={GitBranch} onClick={() => { duplicateResume(resume.id); setMenu(null) }}>New version of this…</MenuItem>
                <MenuItem icon={Pencil} onClick={() => { const n = prompt('Rename resume', resume.name); if (n?.trim()) renameResume(resume.id, n.trim()); setMenu(null) }}>Rename</MenuItem>
                <MenuItem icon={Tag} onClick={() => { const l = prompt('Label (leave empty to remove), e.g. "b2c - google"', resume.label ?? ''); if (l !== null) setLabel(resume.id, l); setMenu(null) }}>{resume.label ? 'Edit label' : 'Add label'}</MenuItem>
                <MenuItem icon={FileJson} onClick={() => { exportJson(); setMenu(null) }}>Export as JSON</MenuItem>
                <div className="my-1 border-t border-rule" />
                <MenuItem icon={Trash2} danger onClick={() => { if (confirm(`Delete "${resume.name}"?`)) deleteResume(resume.id); setMenu(null) }}>Delete resume</MenuItem>
              </Menu>
            )}
          </div>
        </div>
      </div>

      <nav className="-mb-px mt-3 flex gap-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={clsx('flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-[14px] font-medium transition',
              view === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function Menu({ children, left }) {
  return <div className={clsx('absolute top-full z-40 mt-2 w-64 rounded-lg border border-rule bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(23,23,27,.25)]', left ? 'left-0' : 'right-0')}>{children}</div>
}

function MenuItem({ icon: Icon, children, active, danger, ...p }) {
  return (
    <button {...p} className={clsx('flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] transition',
      danger ? 'text-red-600 hover:bg-red-50' : 'text-ink hover:bg-field', active && 'bg-brand-soft font-medium text-brand')}>
      {Icon && <Icon size={15} />} <span className="truncate">{children}</span>
    </button>
  )
}
