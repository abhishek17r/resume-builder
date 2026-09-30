import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, RefreshCw, Sparkles, Plus, Trash2, Loader2, Tag, X, LayoutList, Grid3x3, AlertCircle, Pencil, Check, Wand2, EyeOff, RotateCcw, ChevronDown, User, Mail, Phone, MapPin, Link2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { VAULT_KINDS } from '../config/taxonomy'
import { useVaultTags } from '../lib/vault/useVaultTags'
import { post } from '../lib/api'
import { useAi } from '../lib/useAi'
import AiNotice from './AiNotice'
import { scoreVault, scoreBg } from '../lib/vault/score'
import { autoFixText } from '../lib/optimize/rules'
import { Ring } from './OptimizePanel'

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
  const ai = useAi()
  const server = ai.ready ? ai : ai.state === 'checking' ? null : false // false: AI can't be used
  const [needsWorkOnly, setNeedsWorkOnly] = useState(false)
  const { tags: TAGS } = useVaultTags()
  const resumes = useStore(s => s.resumes)
  const { addVaultTag, removeVaultTag } = useStore()
  const [newTag, setNewTag] = useState('')
  const [finding, setFinding] = useState({ status: 'idle' })

  useEffect(() => { syncVault() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const items = vault.items
  const scores = useMemo(() => scoreVault(vault), [vault])
  const needsWork = b => (scores.byBullet[b.id]?.score ?? 100) < 70
  const kindsPresent = VAULT_KINDS.filter(k => items.some(i => i.kind === k.id))
  const allBullets = items.flatMap(i => i.bullets.map(b => ({ item: i, b })))

  // Items in scope for the selected vertical (kind or single item).
  const scopedItems = selected === 'all' ? items : items.filter(i => i.kind === selected || i.id === selected)
  const matches = b => (!tagFilter.size || [...tagFilter].every(t => b.tags.includes(t))) && (!untaggedOnly || !b.tags.length) && (!needsWorkOnly || needsWork(b)) && (!q.trim() || b.text.toLowerCase().includes(q.trim().toLowerCase()))
  const visible = scopedItems
    .map(item => ({ item, bullets: item.bullets.filter(matches) }))
    .filter(({ item, bullets }) => bullets.length || (!tagFilter.size && !untaggedOnly && !needsWorkOnly && (!q.trim() || item.title.toLowerCase().includes(q.trim().toLowerCase()))))

  const tagCounts = useMemo(() => {
    const scoped = scopedItems.flatMap(i => i.bullets)
    return Object.fromEntries(TAGS.map(t => [t.id, scoped.filter(b => b.tags.includes(t.id)).length]))
  }, [scopedItems, TAGS])

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
        if (data.mock) { setTagging({ status: 'error', error: 'The AI server is in demo mode, so keyword tags were kept.' }); return }
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

  // AI proposes new tags from your bullets and the job descriptions you've analysed; they're added straight away.
  const findTags = async () => {
    setFinding({ status: 'loading' })
    try {
      const jobs = resumes.map(r => r.optimize?.job?.analysis).filter(Boolean)
        .map(a => ({ title: a.title, requirements: a.requirements.map(q => q.text).slice(0, 40) })).slice(0, 20)
      const bullets = allBullets.filter(({ item }) => item.kind !== 'skills' && item.kind !== 'summaries').map(({ b }) => b.text).slice(0, 150)
      const data = await post('/api/vault/suggest-tags', { existing: TAGS.map(t => t.label), jobs, bullets })
      if (data.mock) { setFinding({ status: 'error', error: 'The AI server is in demo mode. Tags are still inferred from your bullets automatically.' }); return }
      const added = data.tags.map(t => addVaultTag({ ...t, source: 'ai' })).filter(Boolean)
      setFinding({ status: 'done', added: data.tags.map(t => t.label), count: added.length })
    } catch (e) {
      setFinding({ status: 'error', error: e.message })
    }
  }
  const addTag = () => { if (newTag.trim()) { addVaultTag({ label: newTag }); setNewTag('') } }

  const newItem = () => {
    const kind = VAULT_KINDS.find(k => k.id === selected)?.id ?? items.find(i => i.id === selected)?.kind ?? 'experience'
    const title = prompt(`New ${KIND_LABEL[kind].replace(/s$/, '').toLowerCase()} name`)
    if (title?.trim()) setSelected(addVaultItem({ kind, title: title.trim() }))
  }

  const untagged = allBullets.filter(({ b }) => !b.tags.length).length
  const byRules = allBullets.filter(({ b }) => b.tagSource === 'rules').length

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <AiNotice what="use AI tagging or rewrites (everything else in the vault works)" className="mb-6" />
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-rule pb-6">
        <div>
          <h1 className="display text-[40px] leading-none text-ink">Vault</h1>
          <p className="mt-2 text-muted">
            Your career, deduplicated across every resume: <span className="meta text-ink">{items.length}</span> entries · <span className="meta text-ink">{allBullets.length}</span> bullets. Updates as you edit resumes.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-rule bg-white">
            {[['list', LayoutList, 'List'], ['matrix', Grid3x3, 'Matrix']].map(([id, Icon, label], i) => (
              <button key={id} onClick={() => setView(id)} className={clsx('flex items-center gap-1.5 px-3 py-2 text-[14px]', i > 0 && 'border-l border-rule', view === id ? 'bg-ink text-white' : 'text-body hover:bg-field hover:text-ink')}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <button onClick={syncVault} className="flex items-center gap-2 rounded-md border border-rule bg-white px-4 py-2 text-[14px] font-medium text-ink hover:border-ink/40" title="Pull in anything new from your resumes">
            <RefreshCw size={15} /> Sync
          </button>
          <button onClick={() => aiTag(true)} disabled={tagging.status === 'loading' || server === false || !byRules}
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-deep disabled:opacity-40"
            title={server === false ? 'AI isn’t connected: open Integrations' : 'Refine keyword tags with AI (your own tags are never changed)'}>
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
            <NavRow active={selected === 'profile'} onClick={() => setSelected('profile')} label="Profile" bold />
            <NavRow active={selected === 'all'} onClick={() => setSelected('all')} label="Everything" count={allBullets.length} bold />
            {kindsPresent.map(k => (
              <div key={k.id} className="mt-2">
                <NavRow active={selected === k.id} onClick={() => setSelected(k.id)} label={k.label} count={items.filter(i => i.kind === k.id).reduce((n, i) => n + i.bullets.length, 0)} bold />
                {items.filter(i => i.kind === k.id).map(i => (
                  <NavRow key={i.id} active={selected === i.id} onClick={() => setSelected(i.id)} label={i.title} count={i.bullets.length} score={scores.byItem[i.id]} indent />
                ))}
              </div>
            ))}
            <button onClick={newItem} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-soft hover:text-ink">
              <Plus size={14} /> Add entry
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {(selected === 'profile' || selected === 'all') && <ProfileCard />}
          {selected !== 'profile' && scores.count > 0 && <ScoreCard scores={scores} active={needsWorkOnly} onNeedsWork={() => setNeedsWorkOnly(v => !v)} />}
          {/* horizontal dimension */}
          {selected !== 'profile' && <>
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">Your tags</span>
              <span className="text-[12px] text-muted">· added automatically when your bullets or job descriptions show a theme (✦)</span>
              <button onClick={findTags} disabled={finding.status === 'loading' || server === false}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-rule bg-white px-2.5 py-1 text-[12px] font-medium text-ink hover:border-ink/40 disabled:opacity-40"
                title={server === false ? 'AI isn’t connected: open Integrations' : 'Suggest new tags from your bullets and the jobs you target'}>
                {finding.status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Find tags with AI
              </button>
            </div>
            {finding.status === 'error' && <p className="flex gap-1.5 text-[12px] text-red-700"><AlertCircle size={14} className="shrink-0" /> {finding.error}</p>}
            {finding.status === 'done' && <p className="text-[12px] text-emerald-800">{finding.count ? `Added ${finding.added.join(', ')}. Use “AI tag” to apply them to your bullets.` : 'No new tags to add: your tags already cover your bullets and jobs.'}</p>}
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(t => (
                <span key={t.id} className="group/tag relative">
                  <button onClick={() => toggleTag(t.id)} title={[t.description, t.source === 'inferred' ? 'Added because your bullets or job descriptions show it.' : t.source === 'ai' ? 'Suggested by AI.' : ''].filter(Boolean).join(' ')}
                    className={clsx('flex items-center gap-1.5 rounded-full py-1 pl-3 pr-3 text-[13px] ring-1 transition group-hover/tag:pr-7', tagFilter.has(t.id) ? 'text-white ring-transparent' : 'bg-white text-ink ring-rule hover:ring-ink/30')}
                    style={tagFilter.has(t.id) ? { background: t.color } : undefined}>
                    {!tagFilter.has(t.id) && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
                    {t.label}
                    {(t.source === 'inferred' || t.source === 'ai') && <span className={tagFilter.has(t.id) ? 'text-white/80' : 'text-brand'}>✦</span>}
                    <span className={clsx('meta', tagFilter.has(t.id) ? 'text-white/80' : 'text-muted')}>{tagCounts[t.id]}</span>
                  </button>
                  <button onClick={() => confirm(`Remove the tag “${t.label}” from your vault? It comes off every bullet and won’t be added again automatically.`) && removeVaultTag(t.id)}
                    className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-full p-0.5 text-muted hover:bg-red-50 hover:text-red-600 group-hover/tag:block" title="Remove tag"><X size={12} /></button>
                </span>
              ))}
              <span className="flex items-center rounded-full border border-dashed border-ink/25 bg-white pl-2.5 focus-within:border-brand">
                <Plus size={13} className="text-muted" />
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} maxLength={40}
                  placeholder="Add tag" className="w-28 bg-transparent px-1.5 py-1 text-[13px] outline-none" />
              </span>
              <button onClick={() => setUntaggedOnly(v => !v)} className={clsx('rounded-full px-3 py-1 text-[13px] ring-1', untaggedOnly ? 'bg-ink text-white ring-ink' : 'bg-white text-muted ring-slate-200 hover:ring-slate-400')}>
                Untagged {untagged}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-lg bg-field px-3">
                <Search size={15} className="text-muted" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search bullets" className="w-full bg-transparent py-2 text-[14px] outline-none" />
              </label>
              {(tagFilter.size > 0 || untaggedOnly || needsWorkOnly || q) && (
                <button onClick={() => { setTagFilter(new Set()); setUntaggedOnly(false); setNeedsWorkOnly(false); setQ('') }} className="text-[13px] font-medium text-muted hover:text-ink">Clear filters</button>
              )}
            </div>
          </div>

          {view === 'matrix'
            ? <Matrix items={scopedItems} onPick={(itemId, tagId) => { setSelected(itemId); setTagFilter(new Set([tagId])); setView('list') }} />
            : visible.length === 0
              ? <div className="card p-8 text-center text-muted">{items.length ? 'Nothing matches these filters.' : 'Your vault fills up automatically as you add content to resumes.'}</div>
              : visible.map(({ item, bullets }) => <ItemCard key={item.id} item={item} bullets={bullets} scores={scores} server={server} />)}
          </>}
        </div>
      </div>
    </div>
  )
}

// Profile details: filled from your resumes (newest first), editable here; sync never overwrites edits.
function ProfileCard() {
  const profile = useStore(s => s.vault.profile) ?? {}
  const { updateVaultProfile, removeVaultHeadline } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [newHeadline, setNewHeadline] = useState('')
  const headlines = profile.headlines ?? []
  const links = profile.links ?? []
  const start = () => { setDraft({ ...profile, links: links.map(l => ({ ...l })) }); setEditing(true) }
  const save = () => {
    updateVaultProfile({ fullName: draft.fullName?.trim() ?? '', email: draft.email?.trim() ?? '', phone: draft.phone?.trim() ?? '', location: draft.location?.trim() ?? '', links: (draft.links ?? []).filter(l => l.value.trim()) })
    setEditing(false)
  }
  const addHeadline = () => { const h = newHeadline.trim(); if (h && !headlines.includes(h)) updateVaultProfile({ headlines: [...headlines, h] }); setNewHeadline('') }
  const field = (key, label, Icon) => (
    <label className="block">
      <span className="label flex items-center gap-1.5"><Icon size={13} /> {label}</span>
      <input className="field py-2 text-[14px]" value={draft[key] ?? ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
    </label>
  )
  const empty = !profile.fullName && !profile.email && !headlines.length

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start gap-3">
        {profile.photo ? <img src={profile.photo} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand"><User size={22} /></span>}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Profile</p>
          <h3 className="text-[18px] font-bold text-ink">{profile.fullName || <span className="text-muted">No name yet</span>}</h3>
          {!editing && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted">
              {profile.email && <span className="flex items-center gap-1"><Mail size={12} /> {profile.email}</span>}
              {profile.phone && <span className="flex items-center gap-1"><Phone size={12} /> {profile.phone}</span>}
              {profile.location && <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>}
              {links.map(l => <span key={l.value} className="flex items-center gap-1"><Link2 size={12} /> {l.value}</span>)}
            </p>
          )}
        </div>
        {!editing && <button onClick={start} className="flex items-center gap-1.5 rounded-lg bg-field px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-slate-200"><Pencil size={13} /> Edit</button>}
      </div>

      {empty && !editing && <p className="text-[13px] text-muted">Fills in from your resumes when the vault syncs.</p>}

      {editing && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field('fullName', 'Full name', User)}
            {field('email', 'Email', Mail)}
            {field('phone', 'Phone', Phone)}
            {field('location', 'Location', MapPin)}
          </div>
          <div>
            <span className="label flex items-center gap-1.5"><Link2 size={13} /> Links</span>
            <div className="space-y-1.5">
              {(draft.links ?? []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field py-2 text-[14px]" value={l.value} onChange={e => setDraft(d => ({ ...d, links: d.links.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                  <button onClick={() => setDraft(d => ({ ...d, links: d.links.filter((_, j) => j !== i) }))} className="grid w-9 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove"><X size={15} /></button>
                </div>
              ))}
              <button onClick={() => setDraft(d => ({ ...d, links: [...(d.links ?? []), { type: 'website', value: '' }] }))} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Plus size={13} /> Add link</button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-muted hover:bg-field">Cancel</button>
            <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-[14px] font-semibold text-white hover:brightness-110">Save</button>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[13px] font-semibold text-ink">Headlines <span className="font-normal text-muted">· the title line under your name; a resume built from a job uses the best fit</span></p>
        <div className="flex flex-wrap gap-1.5">
          {headlines.map(h => (
            <span key={h} className="flex items-center gap-1 rounded-full bg-field py-1 pl-3 pr-1.5 text-[13px] text-ink">
              {h}
              <button onClick={() => removeVaultHeadline(h)} className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-red-600" title="Remove (won’t be re-added)"><X size={12} /></button>
            </span>
          ))}
          <input value={newHeadline} onChange={e => setNewHeadline(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHeadline()} placeholder="Add a headline…" className="min-w-[180px] flex-1 rounded-full bg-white px-3 py-1 text-[13px] outline-none ring-1 ring-slate-200 focus:ring-brand" />
        </div>
      </div>
    </div>
  )
}

function ScorePill({ score, onClick, open, title }) {
  if (score == null) return null
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag onClick={onClick} title={title} className={clsx('inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', scoreBg(score))}>
      {score}{onClick && <ChevronDown size={11} className={clsx('transition', open && 'rotate-180')} />}
    </Tag>
  )
}

function Bar({ label, value, blurb }) {
  return (
    <div title={blurb}>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-field">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#dc2626' }} />
      </div>
    </div>
  )
}

// Same basis as the resume's Optimize score, limited to what a bullet can show on its own.
function ScoreCard({ scores, active, onNeedsWork }) {
  return (
    <div className="card flex flex-wrap items-center gap-6 p-5">
      <Ring value={scores.overall} size={96} label="bullet score" />
      <div className="min-w-[220px] flex-1 space-y-2.5">
        <Bar label="Impact" value={scores.impact} blurb="Measurable results, strong opening verbs and readable length (50/30/20)." />
        <Bar label="Clarity" value={scores.clarity} blurb="Share of bullets with no tense, first-person or cliché issues." />
        <p className="text-[12px] text-muted">
          Scored with the same checks as Optimize, across {scores.count} achievement bullets. ATS and Completeness depend on a whole resume, so they’re scored in each resume’s Optimize tab.
        </p>
      </div>
      <button onClick={onNeedsWork} disabled={!scores.needsWork && !active}
        className={clsx('rounded-lg px-4 py-2 text-[14px] font-semibold ring-1 transition disabled:opacity-40', active ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-rose-700 ring-rose-200 hover:ring-rose-400')}>
        {scores.needsWork ? `${scores.needsWork} need work` : 'All bullets 70+'}
      </button>
    </div>
  )
}

function NavRow({ active, onClick, label, count, score, bold, indent }) {
  return (
    <button onClick={onClick} className={clsx('flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-[14px] transition', indent ? 'pl-6' : 'pl-3', active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-soft', bold && 'font-semibold')}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ScorePill score={score} title="Average bullet score" />
      {count != null && <span className="shrink-0 text-[12px] font-normal text-muted">{count}</span>}
    </button>
  )
}

function ItemCard({ item, bullets, scores, server }) {
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
              <ScorePill score={scores.byItem[item.id]} title="Average bullet score" />
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
          <ul className="space-y-1.5">{g.list.map(b => <BulletRow key={b.id} item={item} b={b} result={scores.byBullet[b.id]} server={server} />)}</ul>
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

function BulletRow({ item, b, result, server }) {
  const { tags: TAGS, byId: TAG_BY_ID } = useVaultTags()
  const { updateVaultBullet, deleteVaultBullet } = useStore()
  const [open, setOpen] = useState(false)
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
            <ScorePill score={result?.score} open={open} onClick={result ? () => setOpen(v => !v) : null}
              title={result ? (result.issues.length ? `${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}: click for details` : 'No issues found') : undefined} />
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
          {open && result && <BulletIssues item={item} b={b} result={result} server={server} />}
        </div>
        <button onClick={() => deleteVaultBullet(item.id, b.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover/b:opacity-100" title="Remove from vault">
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

const CHECK_TITLES = { metric: 'No measurable result', 'weak-verb': 'Weak opening', long: 'Long bullet', short: 'Very short bullet', tense: 'Present tense in a past role', 'first-person': 'First person', cliche: 'Cliché', spacing: 'Extra spaces' }
const same = (a, b) => (a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === (b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// The Optimize issue list for one vault bullet: Fix / Suggest rewrite / Ignore. Changes apply to the vault only.
function BulletIssues({ item, b, result, server }) {
  const { updateVaultBullet, ignoreVaultIssue } = useStore()
  const [rw, setRw] = useState({}) // check -> { status, after, reason, error }

  const suggest = async issue => {
    setRw(r => ({ ...r, [issue.check]: { status: 'loading' } }))
    try {
      const data = await post('/api/improve', { context: { title: b.role || item.title, targetRole: '' }, bullets: [{ ref: b.id, text: b.text, issue: issue.title }] })
      const w = data.rewrites[0]
      const fine = !w || w.verdict === 'already_fine' || same(w.after, b.text)
      setRw(r => ({ ...r, [issue.check]: { status: fine ? 'fine' : 'ready', after: w?.after, reason: w?.reason, mock: data.mock } }))
    } catch (e) {
      setRw(r => ({ ...r, [issue.check]: { status: 'error', error: e.message } }))
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      {result.issues.length === 0 && <p className="text-[13px] text-emerald-700">No issues found. This bullet passes every check.</p>}
      {result.issues.map(i => {
        const r = rw[i.check]
        return (
          <div key={i.check} className="text-[13px]">
            <div className="flex flex-wrap items-start gap-2">
              <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', i.severity === 'medium' ? 'bg-amber-500' : i.severity === 'info' ? 'bg-slate-300' : 'bg-sky-500')} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{i.title} <span className="font-normal text-muted">· {i.group === 'impact' ? 'Impact' : 'Clarity'}</span></p>
                <p className="text-muted">{i.detail}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {i.fix && <MiniBtn icon={Check} primary onClick={() => updateVaultBullet(item.id, b.id, { text: autoFixText(i.fix, b.text) })}>Fix</MiniBtn>}
                {i.ai && <MiniBtn icon={r?.status === 'loading' ? Loader2 : Wand2} spin={r?.status === 'loading'} disabled={server === false || r?.status === 'loading'}
                  title={server === false ? 'AI isn’t connected: open Integrations' : 'Ask AI for an honest rewrite'} onClick={() => suggest(i)}>Suggest rewrite</MiniBtn>}
                <MiniBtn icon={EyeOff} onClick={() => ignoreVaultIssue(item.id, b.id, i.check)} title="Don’t count this against the bullet">Ignore</MiniBtn>
              </div>
            </div>
            {r?.status === 'error' && <p className="ml-4 mt-1.5 text-red-600">{r.error}</p>}
            {r?.status === 'fine' && (
              <div className="ml-4 mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 p-2 text-emerald-800">
                <span className="flex-1">AI review: this bullet is already fine{r.reason ? ` (${r.reason})` : '.'}</span>
                <MiniBtn icon={EyeOff} onClick={() => ignoreVaultIssue(item.id, b.id, i.check)}>Ignore issue</MiniBtn>
              </div>
            )}
            {r?.status === 'ready' && (
              <div className="ml-4 mt-1.5 rounded-md bg-brand-soft/60 p-2">
                <p className="text-ink">{r.after}</p>
                {r.reason && <p className="mt-1 text-[12px] text-muted">{r.reason}{r.mock ? ' (demo mode)' : ''}</p>}
                {/\[[A-Z]\]/.test(r.after) && <p className="mt-1 text-[12px] text-amber-700">Replace {r.after.match(/\[[A-Z]\]/)[0]} with your real number after using it.</p>}
                <div className="mt-2 flex gap-1.5">
                  <MiniBtn icon={Check} primary onClick={() => { updateVaultBullet(item.id, b.id, { text: r.after }); setRw(x => ({ ...x, [i.check]: undefined })) }}>Use this</MiniBtn>
                  <MiniBtn icon={X} onClick={() => setRw(x => ({ ...x, [i.check]: undefined }))}>Dismiss</MiniBtn>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {(b.ignored?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[12px] text-muted">
          Ignored:
          {b.ignored.map(c => (
            <button key={c} onClick={() => ignoreVaultIssue(item.id, b.id, c, false)} className="flex items-center gap-1 rounded-full bg-field px-2 py-0.5 hover:text-ink" title="Count this check again">
              {CHECK_TITLES[c] ?? c} <RotateCcw size={10} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniBtn({ children, onClick, primary, disabled, title, icon: Icon, spin }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={clsx('flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', primary ? 'bg-brand text-white hover:brightness-110' : 'bg-field text-ink hover:bg-slate-200')}>
      {Icon && <Icon size={12} className={spin ? 'animate-spin' : undefined} />} {children}
    </button>
  )
}

// Vertical × horizontal: bullet counts per entry and tag.
function Matrix({ items, onPick }) {
  const { tags: TAGS } = useVaultTags()
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
