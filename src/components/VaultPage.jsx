import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, RefreshCw, Sparkles, Plus, Trash2, Loader2, Tag, X, LayoutList, Grid3x3, AlertCircle, Pencil, Check } from 'lucide-react'
import { useStore } from '../lib/store'
import { TAGS, TAG_BY_ID, VAULT_KINDS } from '../config/taxonomy'
import { post, health } from '../lib/api'

const KIND_LABEL = Object.fromEntries(VAULT_KINDS.map(k => [k.id, k.label]))
const monthYear = v => (v ? v.split('-').reverse().join('/') : '')
const range = (a, b) => [monthYear(a), b ? monthYear(b) : a ? 'Present' : ''].filter(Boolean).join(' – ')

export default function VaultPage() {
  const vault = useStore(s => s.vault)
  const { syncVault, addVaultItem } = useStore()
  const [selected, setSelected] = useState('all') // 'all' | kind id | item id
  const [tagFilter, setTagFilter] = useState(() => new Set())
  const [untaggedOnly, setUntaggedOnly] = useState(false)
  const [q, setQ] = useState('')
  const [view, setView] = useState('list')
  const [tagging, setTagging] = useState({ status: 'idle' })
  const [server, setServer] = useState(null)

  useEffect(() => { syncVault(); health().then(h => setServer(h ?? false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const items = vault.items
  const kindsPresent = VAULT_KINDS.filter(k => items.some(i => i.kind === k.id))
  const allBullets = items.flatMap(i => i.bullets.map(b => ({ item: i, b })))

  // Items in scope for the selected vertical (kind or single item).
  const scopedItems = selected === 'all' ? items : items.filter(i => i.kind === selected || i.id === selected)
  const matches = b => (!tagFilter.size || [...tagFilter].every(t => b.tags.includes(t))) && (!untaggedOnly || !b.tags.length) && (!q.trim() || b.text.toLowerCase().includes(q.trim().toLowerCase()))
  const visible = scopedItems
    .map(item => ({ item, bullets: item.bullets.filter(matches) }))
    .filter(({ item, bullets }) => bullets.length || (!tagFilter.size && !untaggedOnly && (!q.trim() || item.title.toLowerCase().includes(q.trim().toLowerCase()))))

  const tagCounts = useMemo(() => {
    const scoped = scopedItems.flatMap(i => i.bullets)
    return Object.fromEntries(TAGS.map(t => [t.id, scoped.filter(b => b.tags.includes(t.id)).length]))
  }, [scopedItems])

  const toggleTag = id => setTagFilter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const aiTag = async onlyUntouched => {
    const targets = allBullets.filter(({ b }) => b.tagSource !== 'user' && (!onlyUntouched || b.tagSource === 'rules'))
    if (!targets.length) return
    setTagging({ status: 'loading', done: 0, total: targets.length })
    let applied = 0
    try {
      for (let i = 0; i < targets.length; i += 60) {
        const batch = targets.slice(i, i + 60)
        const data = await post('/api/vault/tag', {
          taxonomy: TAGS.map(({ id, label, description }) => ({ id, label, description })),
          bullets: batch.map(({ item, b }) => ({ ref: b.id, text: b.text, context: [KIND_LABEL[item.kind], item.title, b.role].filter(Boolean).join(' · ') })),
        })
        if (data.mock) { setTagging({ status: 'error', error: 'The AI server is in demo mode (no API key), so keyword tags were kept.' }); return }
        const updates = data.tags.map(t => ({ bulletId: t.ref, tags: t.tagIds }))
        useStore.getState().setVaultTags(updates)
        applied += updates.length
        setTagging({ status: 'loading', done: Math.min(i + 60, targets.length), total: targets.length })
      }
      if (!applied) throw new Error('The AI returned no tags. Try again in a moment.')
      setTagging({ status: 'done', total: applied })
    } catch (e) {
      setTagging({ status: 'error', error: e.message })
    }
  }

  const newItem = () => {
    const kind = VAULT_KINDS.find(k => k.id === selected)?.id ?? items.find(i => i.id === selected)?.kind ?? 'experience'
    const title = prompt(`New ${KIND_LABEL[kind].replace(/s$/, '').toLowerCase()} name`)
    if (title?.trim()) setSelected(addVaultItem({ kind, title: title.trim() }))
  }

  const untagged = allBullets.filter(({ b }) => !b.tags.length).length
  const byRules = allBullets.filter(({ b }) => b.tagSource === 'rules').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-0">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="mb-1 text-[30px] font-extrabold text-ink">Vault</h1>
          <p className="text-muted">
            Everything from all your resumes, in one place: {items.length} entries · {allBullets.length} bullets. Updates automatically; edit freely.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
            {[['list', LayoutList, 'List'], ['matrix', Grid3x3, 'Matrix']].map(([id, Icon, label]) => (
              <button key={id} onClick={() => setView(id)} className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium', view === id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink')}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <button onClick={syncVault} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[14px] font-semibold text-ink ring-1 ring-slate-200 hover:ring-slate-400" title="Pull in anything new from your resumes">
            <RefreshCw size={15} /> Sync
          </button>
          <button onClick={() => aiTag(true)} disabled={tagging.status === 'loading' || server === false || !byRules}
            className="cta flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
            title={server === false ? 'AI server offline' : 'Refine keyword tags with AI (your own tags are never changed)'}>
            {tagging.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {tagging.status === 'loading' ? `Tagging ${tagging.done}/${tagging.total}…` : `AI tag ${byRules} bullets`}
          </button>
        </div>
      </div>
      {tagging.status === 'error' && <div className="mb-4 flex gap-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {tagging.error}</div>}
      {tagging.status === 'done' && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800">Tagged {tagging.total} bullets with AI. Tags you set yourself were left as they were.</div>}

      <div className="flex flex-col gap-6 md:flex-row">
        {/* vertical dimension */}
        <aside className="md:sticky md:top-24 md:h-fit md:w-64 md:shrink-0">
          <div className="card max-h-[75vh] overflow-auto p-2">
            <NavRow active={selected === 'all'} onClick={() => setSelected('all')} label="Everything" count={allBullets.length} bold />
            {kindsPresent.map(k => (
              <div key={k.id} className="mt-2">
                <NavRow active={selected === k.id} onClick={() => setSelected(k.id)} label={k.label} count={items.filter(i => i.kind === k.id).reduce((n, i) => n + i.bullets.length, 0)} bold />
                {items.filter(i => i.kind === k.id).map(i => (
                  <NavRow key={i.id} active={selected === i.id} onClick={() => setSelected(i.id)} label={i.title} count={i.bullets.length} indent />
                ))}
              </div>
            ))}
            <button onClick={newItem} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-soft hover:text-ink">
              <Plus size={14} /> Add entry
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {/* horizontal dimension */}
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(t => (
                <button key={t.id} onClick={() => toggleTag(t.id)} title={t.description}
                  className={clsx('flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ring-1 transition', tagFilter.has(t.id) ? 'text-white ring-transparent' : 'bg-white text-ink ring-slate-200 hover:ring-slate-400')}
                  style={tagFilter.has(t.id) ? { background: t.color } : undefined}>
                  {!tagFilter.has(t.id) && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
                  {t.label} <span className={tagFilter.has(t.id) ? 'text-white/80' : 'text-muted'}>{tagCounts[t.id]}</span>
                </button>
              ))}
              <button onClick={() => setUntaggedOnly(v => !v)} className={clsx('rounded-full px-3 py-1 text-[13px] ring-1', untaggedOnly ? 'bg-ink text-white ring-ink' : 'bg-white text-muted ring-slate-200 hover:ring-slate-400')}>
                Untagged {untagged}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-lg bg-field px-3">
                <Search size={15} className="text-muted" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search bullets" className="w-full bg-transparent py-2 text-[14px] outline-none" />
              </label>
              {(tagFilter.size > 0 || untaggedOnly || q) && (
                <button onClick={() => { setTagFilter(new Set()); setUntaggedOnly(false); setQ('') }} className="text-[13px] font-medium text-muted hover:text-ink">Clear filters</button>
              )}
            </div>
          </div>

          {view === 'matrix'
            ? <Matrix items={scopedItems} onPick={(itemId, tagId) => { setSelected(itemId); setTagFilter(new Set([tagId])); setView('list') }} />
            : visible.length === 0
              ? <div className="card p-8 text-center text-muted">{items.length ? 'Nothing matches these filters.' : 'Your vault fills up automatically as you add content to resumes.'}</div>
              : visible.map(({ item, bullets }) => <ItemCard key={item.id} item={item} bullets={bullets} />)}
        </div>
      </div>
    </div>
  )
}

function NavRow({ active, onClick, label, count, bold, indent }) {
  return (
    <button onClick={onClick} className={clsx('flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-[14px] transition', indent ? 'pl-6' : 'pl-3', active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-soft', bold && 'font-semibold')}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[12px] font-normal text-muted">{count}</span>
    </button>
  )
}

function ItemCard({ item, bullets }) {
  const { updateVaultItem, deleteVaultItem, addVaultBullet } = useStore()
  const [adding, setAdding] = useState('')
  const [renaming, setRenaming] = useState(false)
  const roles = [...new Set(bullets.map(b => b.role).filter(Boolean))]
  const groups = item.kind === 'experience' || item.kind === 'education' || item.kind === 'organisations'
    ? [...item.roles.map(r => r.title), ...roles].filter((v, i, a) => v && a.indexOf(v) === i).map(role => ({ role, list: bullets.filter(b => b.role === role) })).concat([{ role: '', list: bullets.filter(b => !b.role) }]).filter(g => g.list.length)
    : [{ role: '', list: bullets }]
  const roleMeta = title => item.roles.find(r => r.title === title)

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[item.kind]}</p>
          {renaming ? (
            <input autoFocus defaultValue={item.title} className="field mt-1 py-1 text-[18px] font-bold"
              onBlur={e => { if (e.target.value.trim()) updateVaultItem(item.id, { title: e.target.value.trim() }); setRenaming(false) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(false) }} />
          ) : (
            <button onClick={() => setRenaming(true)} className="group/t flex items-center gap-1.5 text-left" title="Rename">
              <h3 className="text-[18px] font-bold text-ink">{item.title}</h3>
              <Pencil size={13} className="text-muted opacity-0 group-hover/t:opacity-100" />
            </button>
          )}
          {(item.subtitle || item.end) && <p className="text-[13px] text-muted">{[item.subtitle, range(item.start, item.end)].filter(Boolean).join(' · ')}</p>}
        </div>
        <button onClick={() => confirm(`Remove “${item.title}” and its ${item.bullets.length} bullets from the vault? Your resumes aren’t changed, and it won’t be re-added.`) && deleteVaultItem(item.id)}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove from vault"><Trash2 size={15} /></button>
      </div>

      {groups.map(g => (
        <div key={g.role || '_'} className="mb-2">
          {g.role && (
            <p className="mb-1 mt-3 text-[14px] font-semibold text-ink">
              {g.role} <span className="font-normal text-muted">{roleMeta(g.role) && range(roleMeta(g.role).start, roleMeta(g.role).end)}</span>
            </p>
          )}
          <ul className="space-y-1.5">{g.list.map(b => <BulletRow key={b.id} item={item} b={b} />)}</ul>
        </div>
      ))}

      <div className="mt-3 flex gap-2">
        <input value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a bullet to the vault…" className="field py-2 text-[14px]"
          onKeyDown={e => { if (e.key === 'Enter' && adding.trim()) { addVaultBullet(item.id, adding.trim(), item.roles[0]?.title ?? ''); setAdding('') } }} />
        <button disabled={!adding.trim()} onClick={() => { addVaultBullet(item.id, adding.trim(), item.roles[0]?.title ?? ''); setAdding('') }}
          className="shrink-0 rounded-lg bg-field px-3 text-[13px] font-semibold text-ink hover:bg-slate-200 disabled:opacity-40">Add</button>
      </div>
    </div>
  )
}

function BulletRow({ item, b }) {
  const { updateVaultBullet, deleteVaultBullet } = useStore()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(b.text)
  const [picking, setPicking] = useState(false)
  useEffect(() => setText(b.text), [b.text])

  const toggle = id => updateVaultBullet(item.id, b.id, { tags: b.tags.includes(id) ? b.tags.filter(t => t !== id) : [...b.tags, id], tagSource: 'user' })
  const resumes = new Set(b.sources.map(s => s.resumeId)).size

  return (
    <li className="group/b rounded-lg px-3 py-2 hover:bg-soft">
      <div className="flex items-start gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-2">
              <textarea autoFocus value={text} onChange={e => setText(e.target.value)} className="field min-h-[64px] text-[14px]" />
              <div className="flex flex-col gap-1">
                <button onClick={() => { if (text.trim()) updateVaultBullet(item.id, b.id, { text: text.trim() }); setEditing(false) }} className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white" title="Save"><Check size={15} /></button>
                <button onClick={() => { setText(b.text); setEditing(false) }} className="grid h-8 w-8 place-items-center rounded-md bg-field text-ink" title="Cancel"><X size={15} /></button>
              </div>
            </div>
          ) : (
            <p onClick={() => setEditing(true)} className="cursor-text text-[14px] text-ink" title="Click to edit">
              {b.html ? <span dangerouslySetInnerHTML={{ __html: b.html }} /> : b.text}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {b.tags.map(id => TAG_BY_ID[id] && (
              <button key={id} onClick={() => toggle(id)} title="Remove tag" className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: TAG_BY_ID[id].color }}>
                {TAG_BY_ID[id].label}
              </button>
            ))}
            <div className="relative">
              <button onClick={() => setPicking(v => !v)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-slate-200 hover:text-ink"><Tag size={11} /> Tag</button>
              {picking && (
                <div className="card absolute left-0 top-full z-20 mt-1 w-64 p-1.5 shadow-xl ring-1 ring-black/5" onMouseLeave={() => setPicking(false)}>
                  {TAGS.map(t => (
                    <button key={t.id} onClick={() => toggle(t.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-soft">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                      <span className="flex-1">{t.label}</span>
                      {b.tags.includes(t.id) && <Check size={14} className="text-brand" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {b.tagSource === 'ai' ? 'AI tags' : b.tagSource === 'user' ? 'your tags' : 'keyword tags'}
              {' · '}
              {b.manual ? 'added in vault' : resumes ? `in ${resumes} resume${resumes === 1 ? '' : 's'}` : 'not in any resume now'}
            </span>
          </div>
        </div>
        <button onClick={() => deleteVaultBullet(item.id, b.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover/b:opacity-100" title="Remove from vault">
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

// Vertical × horizontal: bullet counts per entry and tag.
function Matrix({ items, onPick }) {
  const rows = items.filter(i => i.bullets.length)
  if (!rows.length) return <div className="card p-8 text-center text-muted">No bullets yet.</div>
  return (
    <div className="card overflow-auto p-0">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 bg-white p-3 text-left font-semibold text-ink">Entry</th>
            {TAGS.map(t => (
              <th key={t.id} className="p-2 text-center align-bottom font-medium text-muted" title={t.description}>
                <span className="mx-auto mb-1 block h-2 w-2 rounded-full" style={{ background: t.color }} />
                <span className="block w-16 text-[11px] leading-tight">{t.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(i => (
            <tr key={i.id} className="border-b border-slate-50">
              <td className="sticky left-0 bg-white p-3">
                <p className="max-w-[200px] truncate font-semibold text-ink">{i.title}</p>
                <p className="text-[11px] text-muted">{KIND_LABEL[i.kind]}</p>
              </td>
              {TAGS.map(t => {
                const n = i.bullets.filter(b => b.tags.includes(t.id)).length
                return (
                  <td key={t.id} className="p-1 text-center">
                    {n > 0 && (
                      <button onClick={() => onPick(i.id, t.id)} className="grid h-8 w-10 place-items-center rounded-md font-semibold text-white hover:brightness-110"
                        style={{ background: t.color, opacity: Math.min(1, 0.35 + n * 0.2) }}>{n}</button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
