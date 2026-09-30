import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Archive, Plus, Replace, Eye, X, Sparkles, Loader2, AlertCircle, Undo2 } from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { VAULT_KINDS } from '../config/taxonomy'
import { useVaultTags } from '../lib/vault/useVaultTags'
import { vaultCandidates, rankForQuality, rankForJob } from '../lib/vault/suggest'
import { scoreBg } from '../lib/vault/score'
import { post } from '../lib/api'

const KIND_LABEL = Object.fromEntries(VAULT_KINDS.map(k => [k.id, k.label]))

// "From your vault": bullets you've written elsewhere (other resumes, or added in the Vault) for entries
// already on this resume. Without a job they're ranked by score and new strengths; with a job, by the requirements they evidence.
export default function VaultSuggestions({ mode, onShow, serverDown }) {
  const { byId: TAG_BY_ID } = useVaultTags()
  const resume = useResume()
  const vault = useStore(s => s.vault)
  const pages = useStore(s => s.pageCount)
  const { applyEdit, setOptimize, syncVault, undo } = useStore()
  const job = resume.optimize?.job ?? {}
  const [limit, setLimit] = useState(5)
  const [ai, setAi] = useState({ status: 'idle' })
  const [added, setAdded] = useState(null)

  useEffect(() => { syncVault() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dismissed = useMemo(() => new Set(resume.optimize?.vaultDismissed ?? []), [resume.optimize?.vaultDismissed])
  const cands = useMemo(() => vaultCandidates(resume, vault).filter(c => !dismissed.has(c.id)), [resume, vault, dismissed])

  // Saved AI picks (job mode) are only used while they still refer to available candidates.
  const aiPicks = mode === 'job' && job.vaultPicks?.analyzedAt === job.matchedAt ? job.vaultPicks.picks : null
  const ranked = useMemo(() => {
    if (mode === 'quality') return rankForQuality(cands, vault, resume.id)
    const byId = new Map(cands.map(c => [c.id, c]))
    if (aiPicks) return aiPicks.map(p => byId.get(p.ref) && { ...byId.get(p.ref), requirementIds: p.requirementIds, reason: p.reason }).filter(Boolean)
    return rankForJob(cands, job.analysis, job.match)
  }, [mode, cands, vault, resume.id, aiPicks, job.analysis, job.match])

  const reqById = Object.fromEntries((job.analysis?.requirements ?? []).map(r => [r.id, r]))

  const dismiss = c => setOptimize({ vaultDismissed: [...dismissed, c.id] })
  const add = c => { if (applyEdit({ kind: 'add_bullet', target: c.target, after: c.bullet.text, html: c.bullet.html })) setAdded({ label: c.entryLabel, how: 'Added to' }) }
  const replace = c => { if (applyEdit({ kind: 'rewrite_bullet', target: { ...c.target, bullet: c.weakest.i }, after: c.bullet.text })) setAdded({ label: c.entryLabel, how: 'Replaced a bullet in' }) }

  const askAi = async () => {
    setAi({ status: 'loading' })
    try {
      // Send the keyword matches first, then everything else, up to the endpoint's limit.
      const local = rankForJob(cands, job.analysis, job.match)
      const rest = cands.filter(c => !local.some(l => l.id === c.id)).sort((a, b) => b.score - a.score)
      const send = [...local, ...rest].slice(0, 80)
      const data = await post('/api/vault/match', {
        analysis: job.analysis,
        coverage: job.match.requirements.map(r => ({ id: r.id, status: r.status })),
        candidates: send.map(c => ({ ref: c.id, text: c.bullet.text, context: [KIND_LABEL[c.item.kind], c.entryLabel].join(' · ') })),
      })
      setOptimize({ job: { ...job, vaultPicks: { picks: data.picks, mock: data.mock, analyzedAt: job.matchedAt } } })
      setAi({ status: 'idle' })
    } catch (e) {
      setAi({ status: 'error', error: e.message })
    }
  }

  const empty = !cands.length
  const shown = ranked.slice(0, limit)

  return (
    <div className="card p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Archive size={18} className="text-brand" />
        <h3 className="text-[18px] font-bold text-ink">From your vault <span className="font-normal text-muted">({ranked.length})</span></h3>
        {mode === 'job' && cands.length > 0 && (
          <button onClick={askAi} disabled={ai.status === 'loading' || serverDown}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-field px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-slate-200 disabled:opacity-40"
            title={serverDown ? 'AI isn’t connected: open Integrations' : 'Let AI pick the bullets that best evidence this job’s requirements'}>
            {ai.status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {ai.status === 'loading' ? 'Picking…' : aiPicks ? 'Pick again with AI' : 'Pick with AI'}
          </button>
        )}
      </div>
      <p className="mb-4 text-[13px] text-muted">
        {mode === 'quality'
          ? 'Strong bullets you’ve written for these same roles in other resumes or in the Vault. Ranked by score, favouring strengths this resume doesn’t show yet.'
          : aiPicks
            ? `Picked by AI${job.vaultPicks.mock ? ' (demo mode: keyword matching)' : ''} from your own bullets, for this job’s requirements. Wording is unchanged.`
            : 'Your own bullets that mention this job’s requirement keywords, gaps first. “Pick with AI” reads them for meaning, not just keywords.'}
        {pages > 1 && ' Your resume is already over one page, so Replace keeps the length the same.'}
      </p>
      {ai.status === 'error' && <div className="mb-3 flex gap-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {ai.error}</div>}
      {added && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800">
          <span className="flex-1">{added.how} {added.label}.</span>
          <button onClick={() => { undo(); setAdded(null) }} className="flex items-center gap-1 font-semibold hover:underline"><Undo2 size={13} /> Undo</button>
          <button onClick={() => setAdded(null)} className="text-emerald-700/70 hover:text-emerald-900"><X size={14} /></button>
        </div>
      )}

      {empty ? (
        <p className="text-[14px] text-muted">Nothing to add: every vault bullet for these entries is already on this resume. Add more in the Vault, or on other resume versions.</p>
      ) : ranked.length === 0 ? (
        <p className="text-[14px] text-muted">
          {mode === 'quality' ? `None of the ${cands.length} other vault bullets for these entries score 70+. Improve them in the Vault first.` : `No vault bullets mention this job’s keywords. Try “Pick with AI” to match on meaning.`}
        </p>
      ) : (
        <div className="space-y-2.5">
          {shown.map(c => (
            <div key={c.id} className="rounded-lg bg-soft p-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] text-muted">
                <span className="min-w-0 flex-1 truncate font-medium">{c.entryLabel} <span className="font-normal">· {c.bulletCount} bullet{c.bulletCount === 1 ? '' : 's'} now</span></span>
                <span className={clsx('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', scoreBg(c.score))} title="Vault bullet score">{c.score}</span>
              </div>
              <p className="text-[14px] text-ink">{c.bullet.html ? <span dangerouslySetInnerHTML={{ __html: c.bullet.html }} /> : c.bullet.text}</p>
              {c.reason && <p className="mt-1 text-[12px] text-muted">{c.reason}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {mode === 'job'
                  ? (c.requirementIds ?? []).map(id => reqById[id] && (
                    <span key={id} className="max-w-[260px] truncate rounded-full bg-white px-2 py-0.5 text-[11px] text-muted ring-1 ring-slate-200" title={reqById[id].text}>
                      <b className="font-semibold">{job.match?.requirements.find(r => r.id === id)?.status ?? 'missing'}</b> · {reqById[id].text}
                    </span>
                  ))
                  : c.newTags.map(id => TAG_BY_ID[id] && (
                    <span key={id} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: TAG_BY_ID[id].color }} title="Not shown elsewhere on this resume">+ {TAG_BY_ID[id].label}</span>
                  ))}
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Action icon={Plus} primary onClick={() => add(c)} title="Add as the last bullet of this entry (⌘Z to undo)">Add</Action>
                  {c.weakest && <Action icon={Replace} onClick={() => replace(c)} title={`Replace: “${c.weakest.text}”`}>Replace weakest ({c.weakest.score})</Action>}
                  <Action icon={Eye} onClick={() => onShow({ ...c.target, bullet: -1 })}>Show entry</Action>
                  <Action icon={X} onClick={() => dismiss(c)} title="Don’t suggest this for this resume">Dismiss</Action>
                </div>
              </div>
            </div>
          ))}
          {ranked.length > limit && (
            <button onClick={() => setLimit(l => l + 10)} className="text-[13px] font-medium text-muted hover:text-ink">Show {Math.min(10, ranked.length - limit)} more</button>
          )}
        </div>
      )}
      {dismissed.size > 0 && (
        <button onClick={() => setOptimize({ vaultDismissed: [] })} className="mt-3 block text-[12px] text-muted hover:text-ink">Restore {dismissed.size} dismissed</button>
      )}
    </div>
  )
}

function Action({ children, onClick, primary, title, icon: Icon }) {
  return (
    <button onClick={onClick} title={title}
      className={clsx('flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition', primary ? 'bg-brand text-white hover:brightness-110' : 'bg-white text-ink ring-1 ring-slate-200 hover:ring-slate-400')}>
      {Icon && <Icon size={12} />} {children}
    </button>
  )
}
