import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Archive, Plus, Check, ChevronDown } from 'lucide-react'
import { useStore } from '../lib/store'
import { KIND_OF_SECTION, VAULT_KINDS } from '../config/taxonomy'
import { useVaultTags } from '../lib/vault/useVaultTags'
import { SECTION_TYPES } from '../lib/sections'
import { norm, fingerprint } from '../lib/vault/sync'
import { getItems, appendBullet } from '../lib/optimize/bullets'

// The entity name the vault groups this entry under (company for experience, school for education…).
const TITLE_FIELD = { experience: 'employer', education: 'school', organisations: 'organisation', projects: 'title', certificates: 'name', awards: 'award', publications: 'title', courses: 'course', custom: 'title' }

// "Insert from vault" for an entry's description: bullets from the same company/project first,
// filterable by tag, one click to add.
export default function VaultPicker({ section, entry }) {
  const { tags: TAGS, byId: TAG_BY_ID } = useVaultTags()
  const vault = useStore(s => s.vault)
  const setEntry = useStore(s => s.setEntry)
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState(null)
  const [scope, setScope] = useState('this') // this | kind

  const kind = KIND_OF_SECTION[section.type]
  const richKey = SECTION_TYPES[section.type]?.fields.find(f => f.kind === 'rich')?.key
  const title = entry[TITLE_FIELD[section.type]] || ''
  const present = useMemo(() => new Set(getItems(entry[richKey]).map(i => fingerprint(i.text))), [entry, richKey])

  if (!kind || !richKey) return null
  const same = vault.items.filter(i => i.kind === kind && title && norm(i.title) === norm(title))
  const pool = scope === 'this' ? same : vault.items.filter(i => i.kind === kind)
  const rows = pool.flatMap(i => i.bullets.map(b => ({ item: i, b }))).filter(({ b }) => !tag || b.tags.includes(tag))
  const total = same.reduce((n, i) => n + i.bullets.length, 0)
  const kindLabel = VAULT_KINDS.find(k => k.id === kind)?.label.toLowerCase()

  const add = b => setEntry(section.id, entry.id, richKey, appendBullet(entry[richKey], b.html || b.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))))

  return (
    <div className="mt-5 rounded-lg border border-slate-200">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Archive size={16} className="text-brand" />
        <span className="flex-1 text-[14px] font-semibold text-ink">Insert from vault</span>
        <span className="text-[12px] text-muted">{total ? `${total} bullet${total === 1 ? '' : 's'} for ${title || 'this entry'}` : `from all ${kindLabel}`}</span>
        <ChevronDown size={16} className={clsx('text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <div className="mr-2 flex rounded-lg bg-field p-0.5 text-[12px]">
              {[['this', title || 'This entry'], ['kind', `All ${kindLabel}`]].map(([id, label]) => (
                <button key={id} onClick={() => setScope(id)} className={clsx('max-w-[160px] truncate rounded-md px-2.5 py-1', scope === id ? 'bg-white font-semibold text-ink shadow-sm' : 'text-muted')}>{label}</button>
              ))}
            </div>
            {TAGS.filter(t => pool.some(i => i.bullets.some(b => b.tags.includes(t.id)))).map(t => (
              <button key={t.id} onClick={() => setTag(tag === t.id ? null : t.id)}
                className={clsx('rounded-full px-2.5 py-0.5 text-[12px] ring-1', tag === t.id ? 'text-white ring-transparent' : 'text-ink ring-slate-200')}
                style={tag === t.id ? { background: t.color } : undefined}>{t.label}</button>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-[13px] text-muted">{scope === 'this' && !same.length ? 'Nothing in the vault for this entry yet. Try “All”.' : 'No bullets match.'}</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-auto pr-1">
              {rows.map(({ item, b }) => {
                const inHere = b.origins.some(fp => present.has(fp)) || present.has(fingerprint(b.text))
                return (
                  <li key={b.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-soft">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink">{b.text}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted">
                        {scope === 'kind' && <span>{item.title}{b.role ? ` · ${b.role}` : ''} ·</span>}
                        {b.tags.map(id => TAG_BY_ID[id] && <span key={id} style={{ color: TAG_BY_ID[id].color }}>{TAG_BY_ID[id].label}</span>)}
                      </p>
                    </div>
                    {inHere
                      ? <span className="flex shrink-0 items-center gap-1 text-[12px] text-emerald-700"><Check size={13} /> In entry</span>
                      : <button onClick={() => add(b)} className="flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[12px] font-semibold text-brand hover:bg-brand-hover"><Plus size={13} /> Add</button>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
