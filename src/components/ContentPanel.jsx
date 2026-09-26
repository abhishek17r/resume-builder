import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ChevronDown, GripVertical, Eye, EyeOff, Trash2, Plus, Check, Pencil, SquarePen,
  Mail, Phone, MapPin, Camera, X,
} from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { SECTION_TYPES, LEVELS } from '../lib/sections'
import { LINK_TYPES } from './ResumeDocument'
import { SortableList, SortableItem } from './Sortable'
import RichText from './RichText'
import AddContentModal from './AddContentModal'
import { analyzeQuality } from '../lib/optimize/rules'

// Open quality issues per entry, for the markers in the editor (same checks as Optimize).
function useEntryIssues(resume) {
  const pages = useStore(s => s.pageCount)
  return useMemo(() => {
    const ignored = new Set(resume.optimize?.ignored ?? [])
    const map = {}
    for (const i of analyzeQuality(resume, { pages }).issues) {
      if (ignored.has(i.id) || !i.target?.entryId || i.severity === 'info') continue
      ;(map[i.target.entryId] ??= []).push(i)
    }
    return map
  }, [resume, pages])
}

export default function ContentPanel() {
  const resume = useResume()
  const moveSection = useStore(s => s.moveSection)
  const [editing, setEditing] = useState(null) // null | {kind:'personal'} | {kind:'entry', sectionId, entryId}
  // Sections start open so the content is visible in the editor; we remember which ones were closed.
  const [closed, setClosed] = useState(() => new Set())
  const [adding, setAdding] = useState(false)
  const issuesByEntry = useEntryIssues(resume)
  const { focus, setFocus } = useStore()

  // "Show" from Optimize: open the entry it points at (or the section), then clear the request.
  useEffect(() => {
    if (!focus) return
    if (focus.entryId && resume.sections.some(s => s.id === focus.sectionId && s.entries.some(e => e.id === focus.entryId))) {
      setEditing({ kind: 'entry', sectionId: focus.sectionId, entryId: focus.entryId, bullet: focus.bullet })
    } else if (focus.sectionId) {
      setClosed(prev => { const next = new Set(prev); next.delete(focus.sectionId); return next })
      setTimeout(() => document.getElementById(`section-${focus.sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    setFocus(null)
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('editor-pane')?.scrollTo(0, 0)
  }, [editing])

  const toggle = id => setClosed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  if (editing?.kind === 'personal') return <PersonalEditor onDone={() => setEditing(null)} />
  if (editing?.kind === 'entry') {
    const section = resume.sections.find(s => s.id === editing.sectionId)
    const entry = section?.entries.find(e => e.id === editing.entryId)
    if (section && entry) return <EntryEditor section={section} entry={entry} issues={issuesByEntry[entry.id] ?? []} focusBullet={editing.bullet} onDone={() => setEditing(null)} />
  }

  const ids = resume.sections.map(s => s.id)

  return (
    <div className="space-y-5 pb-24">
      <PersonalCard onEdit={() => setEditing({ kind: 'personal' })} />

      <SortableList ids={ids} onMove={moveSection}>
        <div className="space-y-5">
          {resume.sections.map(section => (
            <SortableItem key={section.id} id={section.id}>
              {({ handleProps }) => (
                <SectionCard
                  section={section}
                  open={!closed.has(section.id)}
                  onToggle={() => toggle(section.id)}
                  handleProps={handleProps}
                  onEditEntry={entryId => setEditing({ kind: 'entry', sectionId: section.id, entryId })}
                  issuesByEntry={issuesByEntry}
                />
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>

      <div className="flex justify-center pt-4">
        <button onClick={() => setAdding(true)} className="cta flex items-center gap-3 rounded-xl px-10 py-4 text-[18px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110">
          <Plus size={22} strokeWidth={2.6} /> Add Content
        </button>
      </div>

      {adding && (
        <AddContentModal
          onClose={() => setAdding(false)}
          onAdded={(sectionId, entryId) => {
            setAdding(false)
            setClosed(prev => { const next = new Set(prev); next.delete(sectionId); return next })
            if (entryId) setEditing({ kind: 'entry', sectionId, entryId })
          }}
        />
      )}
    </div>
  )
}

/* ---------------- personal details ---------------- */

function PersonalCard({ onEdit }) {
  const p = useResume().personal
  const rows = [
    p.email && [Mail, p.email],
    p.phone && [Phone, p.phone],
    p.location && [MapPin, p.location],
  ].filter(Boolean)
  return (
    <div className="card relative cursor-pointer p-8 transition hover:shadow-md" onClick={onEdit}>
      <button onClick={e => { e.stopPropagation(); onEdit() }} className="cta absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white" title="Edit personal details">
        <SquarePen size={17} />
      </button>
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold text-ink">{p.fullName || 'Your name'}</h2>
          <p className="mt-1 text-[19px] leading-snug text-muted">{p.jobTitle || 'Job title'}</p>
          <div className="mt-5 space-y-3">
            {rows.map(([Icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-[16px] text-ink">
                <Icon size={20} strokeWidth={1.8} /> <span className="truncate">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid h-28 w-28 shrink-0 self-center place-items-center overflow-hidden rounded-full bg-field text-slate-300">
          {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <Camera size={40} />}
        </div>
      </div>
    </div>
  )
}

function PersonalEditor({ onDone }) {
  const p = useResume().personal
  const { setPersonal, addLink, setLink, removeLink } = useStore()

  const onPhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    // Shrink to 400px on the long edge so photos don't bloat stored resumes.
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 400 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      setPersonal('photo', c.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  const field = (key, label, placeholder) => (
    <div>
      <label className="label">{label}</label>
      <input className="field" value={p[key]} placeholder={placeholder} onChange={e => setPersonal(key, e.target.value)} />
    </div>
  )

  return (
    <div className="space-y-5 pb-24">
      <div className="card p-8">
        <h2 className="mb-6 text-[24px] font-bold text-ink">Edit Personal Details</h2>
        <div className="mb-6 flex items-center gap-5">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-field text-slate-300">
            {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <Camera size={34} />}
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-lg bg-field px-4 py-2 text-[14px] font-semibold text-ink hover:bg-slate-200">
              {p.photo ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
            {p.photo && (
              <button onClick={() => setPersonal('photo', '')} className="rounded-lg px-3 py-2 text-[14px] font-semibold text-red-600 hover:bg-red-50">Remove</button>
            )}
          </div>
        </div>
        <div className="grid gap-5">
          {field('fullName', 'Full Name', 'e.g. John Doe')}
          {field('jobTitle', 'Professional Title', 'e.g. Senior Product Designer')}
          <div className="grid grid-cols-2 gap-4">
            {field('email', 'Email', 'you@example.com')}
            {field('phone', 'Phone', '+1 555 000 0000')}
          </div>
          {field('location', 'Location', 'City, Country')}

          {p.links.map(l => {
            const T = LINK_TYPES[l.type] ?? LINK_TYPES.other
            return (
              <div key={l.id}>
                <label className="label">{T.label}</label>
                <div className="flex gap-2">
                  <input className="field" value={l.value} placeholder="example.com/you" onChange={e => setLink(l.id, e.target.value)} />
                  <button onClick={() => removeLink(l.id)} className="grid w-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" title="Remove">
                    <X size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mb-3 mt-7 text-[14px] font-semibold text-ink">Add details</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LINK_TYPES).map(([type, T]) => (
            <button key={type} onClick={() => addLink(type)} className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[14px] font-medium text-ink hover:border-brand hover:text-brand">
              <Plus size={15} /> {T.label}
            </button>
          ))}
        </div>
      </div>
      <DoneBar onDone={onDone} />
    </div>
  )
}

/* ---------------- sections ---------------- */

function SectionCard({ section, open, onToggle, handleProps, onEditEntry, issuesByEntry = {} }) {
  const def = SECTION_TYPES[section.type]
  const { renameSection, toggleSectionHidden, removeSection, addEntry, moveEntry, toggleEntryHidden } = useStore()
  const [renaming, setRenaming] = useState(false)
  const Icon = def.icon

  // Single-entry sections (summary, declaration) edit inline instead of listing entries.
  const single = def.single

  return (
    <div id={`section-${section.id}`} className={clsx('card group/section scroll-mt-4', section.hidden && 'opacity-60')}>
      <div className="relative flex cursor-pointer items-center gap-4 px-7 py-7" onClick={onToggle}>
        <button {...handleProps} onClick={e => e.stopPropagation()} className="absolute -left-1 top-1/2 hidden -translate-y-1/2 cursor-grab touch-none rounded p-1 text-slate-300 hover:text-slate-500 group-hover/section:block" title="Drag to reorder">
          <GripVertical size={18} />
        </button>
        <Icon size={26} className="shrink-0 text-ink" strokeWidth={2} />
        {renaming ? (
          <input
            autoFocus
            className="field max-w-xs py-1.5 text-[20px] font-extrabold"
            value={section.heading}
            onClick={e => e.stopPropagation()}
            onChange={e => renameSection(section.id, e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={e => e.key === 'Enter' && setRenaming(false)}
          />
        ) : (
          <h3 className="truncate text-[21px] font-extrabold text-ink">{section.heading}</h3>
        )}
        {open && !renaming && (
          <button onClick={e => { e.stopPropagation(); setRenaming(true) }} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-field px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-slate-200">
            <Pencil size={13} /> Edit Heading
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {open && (
            <>
              <IconBtn title={section.hidden ? 'Show on resume' : 'Hide from resume'} onClick={e => { e.stopPropagation(); toggleSectionHidden(section.id) }}>
                {section.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
              </IconBtn>
              <IconBtn title="Delete section" danger onClick={e => {
                e.stopPropagation()
                if (confirm(`Delete the "${section.heading}" section?`)) removeSection(section.id)
              }}>
                <Trash2 size={17} />
              </IconBtn>
            </>
          )}
          <ChevronDown size={20} className={clsx('text-ink transition', open && 'rotate-180')} />
        </div>
      </div>

      {open && single && (
        <div className="space-y-4 px-7 pb-7">
          <SingleEditor section={section} />
        </div>
      )}

      {open && !single && (
        <div className="pb-5">
          <SortableList ids={section.entries.map(e => e.id)} onMove={(a, b) => moveEntry(section.id, a, b)}>
            {section.entries.map(entry => {
              const [title, sub] = def.title(entry)
              return (
                <SortableItem key={entry.id} id={entry.id}>
                  {({ handleProps: h }) => (
                    <div className="group/entry mx-4 flex items-center gap-2 rounded-xl px-3 py-3 hover:bg-soft">
                      <button {...h} className="cursor-grab touch-none text-slate-400 hover:text-slate-600" title="Drag to reorder">
                        <GripVertical size={18} />
                      </button>
                      <button onClick={() => onEditEntry(entry.id)} className={clsx('min-w-0 flex-1 truncate text-left text-[15px] text-ink', entry.hidden && 'opacity-50')}>
                        {title || sub ? (
                          <>
                            <span className="font-bold">{title}</span>
                            {sub && <span>{title ? ', ' : ''}{sub}</span>}
                          </>
                        ) : (
                          <span className="italic text-muted">Untitled entry</span>
                        )}
                      </button>
                      {issuesByEntry[entry.id]?.length > 0 && (
                        <button onClick={() => onEditEntry(entry.id)} title={`${issuesByEntry[entry.id].length} suggestion${issuesByEntry[entry.id].length === 1 ? '' : 's'} from Optimize`}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-700 hover:bg-amber-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {issuesByEntry[entry.id].length}
                        </button>
                      )}
                      <IconBtn title={entry.hidden ? 'Show on resume' : 'Hide from resume'} onClick={() => toggleEntryHidden(section.id, entry.id)}>
                        {entry.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                      </IconBtn>
                    </div>
                  )}
                </SortableItem>
              )
            })}
          </SortableList>
          <div className="mt-3 flex justify-center">
            <button onClick={() => onEditEntry(addEntry(section.id))} className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-[15px] font-semibold text-ink hover:border-brand hover:text-brand">
              <Plus size={17} /> Entry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SingleEditor({ section }) {
  const setEntry = useStore(s => s.setEntry)
  const entry = section.entries[0]
  const def = SECTION_TYPES[section.type]
  return <FieldGrid fields={def.fields} entry={entry} onChange={(k, v) => setEntry(section.id, entry.id, k, v)} />
}

/* ---------------- entry editor ---------------- */

// Quality notes for this entry (from the Optimize checks), with one-click fixes where possible.
function EntryIssues({ issues, focusBullet, onFix }) {
  const sorted = [...issues].sort((a, b) => (a.target.bullet === focusBullet ? -1 : 0) - (b.target.bullet === focusBullet ? -1 : 0))
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="mb-2 text-[13px] font-semibold text-amber-800">{issues.length} suggestion{issues.length === 1 ? '' : 's'} from Optimize</p>
      <ul className="space-y-1.5">
        {sorted.map(i => (
          <li key={i.id} className={clsx('flex items-start gap-2 rounded-lg px-2 py-1 text-[13px]', i.target.bullet === focusBullet && focusBullet >= 0 && 'bg-white ring-1 ring-amber-300')}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span className="min-w-0 flex-1 text-ink">
              {i.target.bullet >= 0 && <span className="font-semibold">Bullet {i.target.bullet + 1}: </span>}
              {i.title}
              <span className="block text-muted">{i.detail}</span>
            </span>
            {i.fix && <button onClick={() => onFix(i)} className="shrink-0 rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand-soft">Fix</button>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-amber-800/80">AI rewrites for these are in the Optimize tab.</p>
    </div>
  )
}

function EntryEditor({ section, entry, issues = [], focusBullet, onDone }) {
  const def = SECTION_TYPES[section.type]
  const { setEntry, removeEntry, toggleEntryHidden, applyEdit } = useStore()
  return (
    <div className="space-y-5 pb-24">
      <div className="card p-8">
        <div className="mb-6 flex items-center gap-2">
          <h2 className="text-[24px] font-bold text-ink">Edit Entry</h2>
          <span className="ml-2 rounded-full bg-field px-3 py-1 text-[12px] font-medium text-muted">{section.heading}</span>
          <div className="ml-auto flex gap-1">
            <IconBtn title={entry.hidden ? 'Show on resume' : 'Hide from resume'} onClick={() => toggleEntryHidden(section.id, entry.id)}>
              {entry.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconBtn>
            <IconBtn title="Delete entry" danger onClick={() => {
              if (confirm('Delete this entry?')) { removeEntry(section.id, entry.id); onDone() }
            }}>
              <Trash2 size={17} />
            </IconBtn>
          </div>
        </div>
        {issues.length > 0 && <EntryIssues issues={issues} focusBullet={focusBullet} onFix={i => applyEdit({ kind: 'autofix', fix: i.fix, target: i.target })} />}
        <FieldGrid fields={def.fields} entry={entry} onChange={(k, v) => setEntry(section.id, entry.id, k, v)} />
      </div>
      <DoneBar onDone={onDone} />
    </div>
  )
}

function FieldGrid({ fields, entry, onChange }) {
  const [linkOpen, setLinkOpen] = useState({})
  return (
    <div className="grid grid-cols-6 gap-x-4 gap-y-5">
      {fields.map(f => {
        // Dates sit side by side (half a row each) so month and year both have room; other fields take a full row.
        const col = f.kind === 'month' ? 'col-span-6 sm:col-span-3' : 'col-span-6'
        if (f.kind === 'rich') {
          return (
            <div key={f.key} className={col}>
              <label className="label">{f.label}</label>
              <RichText value={entry[f.key]} onChange={v => onChange(f.key, v)} placeholder="Describe what you did and the impact it had…" />
            </div>
          )
        }
        if (f.kind === 'level') {
          const level = entry.level ?? -1
          return (
            <div key={f.key} className={col}>
              <label className="label">{f.label} <span className="font-normal text-muted">— {level >= 0 ? LEVELS[level] : 'not shown'}</span></label>
              <div className="flex gap-1.5">
                {LEVELS.map((name, i) => (
                  <button key={name} title={name} onClick={() => onChange('level', level === i ? -1 : i)}
                    className={clsx('h-9 flex-1 rounded-md transition', i <= level ? 'bg-brand' : 'bg-field hover:bg-slate-200')} />
                ))}
              </div>
            </div>
          )
        }
        if (f.kind === 'month') {
          return (
            <div key={f.key} className={col}>
              <label className="label">{f.label}</label>
              <MonthYear value={entry[f.key] || ''} onChange={v => onChange(f.key, v)} presentLabel={f.presentLabel} />
            </div>
          )
        }
        const linkKey = `${f.key}Link`
        return (
          <div key={f.key} className={col}>
            <label className="label">{f.label}</label>
            <div className="relative">
              <input className="field pr-20" value={entry[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
              {f.link && (
                <button onClick={() => setLinkOpen(o => ({ ...o, [f.key]: !o[f.key] }))}
                  className={clsx('absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium', entry[linkKey] ? 'bg-brand-soft text-brand' : 'bg-white text-muted hover:text-ink')}>
                  <LinkMini /> Link
                </button>
              )}
            </div>
            {f.link && (linkOpen[f.key] || entry[linkKey]) && (
              <input className="field mt-2 text-[14px]" placeholder="https://" value={entry[linkKey] || ''} onChange={e => onChange(linkKey, e.target.value)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Value is "YYYY-MM", "YYYY" (month unknown) or "". For end dates, "" means "Present".
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: THIS_YEAR + 5 - 1950 + 1 }, (_, i) => String(THIS_YEAR + 5 - i))

function MonthYear({ value, onChange, presentLabel }) {
  const [y = '', m = ''] = value.split('-')
  const present = !!presentLabel && !value
  const set = (yy, mm) => onChange(yy ? (mm ? `${yy}-${mm}` : yy) : '')
  const sel = 'field cursor-pointer appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23555%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>\')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-6 disabled:cursor-default disabled:opacity-50'
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5">
        <select value={m} disabled={present || !y} onChange={e => set(y, e.target.value)} className={`${sel} min-w-0 px-3`} title="Month (optional)">
          <option value="">Month</option>
          {MONTH_ABBR.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
        </select>
        <select value={y} disabled={present} onChange={e => set(e.target.value, e.target.value ? m : '')} className={`${sel} min-w-0 px-3`} title="Year">
          <option value="">Year</option>
          {YEARS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
        </select>
      </div>
      {presentLabel && (
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" className="accent-[var(--color-brand)]" checked={present}
            onChange={e => onChange(e.target.checked ? '' : String(THIS_YEAR))} />
          {presentLabel}
        </label>
      )}
    </div>
  )
}

const LinkMini = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
)

/* ---------------- shared bits ---------------- */

function DoneBar({ onDone }) {
  return (
    <div className="card sticky bottom-4 flex justify-center p-6">
      <button onClick={onDone} className="cta flex w-full max-w-xs items-center justify-center gap-3 rounded-xl py-4 text-[18px] font-semibold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110">
        <Check size={20} strokeWidth={2.6} /> Done
      </button>
    </div>
  )
}

function IconBtn({ children, danger, ...p }) {
  return (
    <button {...p} className={clsx('grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition', danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-field hover:text-ink')}>
      {children}
    </button>
  )
}
