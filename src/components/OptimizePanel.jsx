import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  Gauge, Target, Wand2, Eye, EyeOff, Check, X, Pencil, Loader2, AlertCircle, CheckCircle2, CircleDashed, CircleX,
  Sparkles, CopyPlus, RefreshCw, ChevronDown, Info,
} from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { analyzeQuality, GROUPS } from '../lib/optimize/rules'
import { resumeToPayload, refKey } from '../lib/optimize/serialize'
import { post, health } from '../lib/api'
import VaultSuggestions from './VaultSuggestions'

const SEVERITY = {
  high: { label: 'High', dot: 'bg-red-500', order: 0 },
  medium: { label: 'Medium', dot: 'bg-amber-500', order: 1 },
  low: { label: 'Low', dot: 'bg-sky-500', order: 2 },
  info: { label: 'Tip', dot: 'bg-slate-400', order: 3 },
}

export default function OptimizePanel({ onShow }) {
  const [tab, setTab] = useState(() => useStore.getState().optimizeTab ?? 'quality')
  useEffect(() => { useStore.getState().setOptimizeTab(null) }, [])
  return (
    <div className="space-y-5 pb-24">
      <div className="card flex gap-1 p-1.5">
        {[['quality', Gauge, 'Quality score'], ['job', Target, 'Tailor to a job']].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-medium transition',
              tab === id ? 'bg-brand-soft text-brand' : 'text-body hover:bg-soft')}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
      {tab === 'quality' ? <QualityTab onShow={onShow} /> : <JobTab onShow={onShow} />}
    </div>
  )
}

/* ============================== shared ============================== */

export function Ring({ value, size = 96, label }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceef2" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-[26px] font-extrabold leading-none text-ink">{value}</div>
        {label && <div className="mt-0.5 text-[11px] text-muted">{label}</div>}
      </div>
    </div>
  )
}

function whereLabel(resume, target) {
  if (!target) return null
  const sec = resume.sections.find(s => s.id === target.sectionId)
  if (!sec) return null
  const e = sec.entries.find(x => x.id === target.entryId)
  const name = e ? [e.jobTitle ?? e.degree ?? e.title ?? e.skill ?? e.name, e.employer ?? e.school ?? e.subtitle].filter(Boolean).join(' · ') : ''
  return [sec.heading, name, target.bullet >= 0 ? `bullet ${target.bullet + 1}` : null].filter(Boolean).join(' › ')
}

function Btn({ children, onClick, primary, disabled, title, icon: Icon }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={clsx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
        primary ? 'bg-brand text-white hover:brightness-110' : 'bg-field text-ink hover:bg-slate-200')}>
      {Icon && <Icon size={14} />} {children}
    </button>
  )
}

function ErrorNote({ error }) {
  if (!error) return null
  return <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>
}

function useServer() {
  const [status, setStatus] = useState(null) // null = checking, false = offline, {mock}
  useEffect(() => { health().then(h => setStatus(h ?? false)) }, [])
  return status
}

function ServerBadge({ status }) {
  if (status === null) return null
  if (status === false) return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-700">AI server offline</span>
  if (status.mock) return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700" title="The server has no Claude API key; results are keyword heuristics.">Demo mode</span>
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">AI connected</span>
}

// Before/after card with Accept / Edit / Dismiss. `after` text may contain [X] placeholders.
function SuggestionCard({ kindLabel, before, after, reason, where, chips, onAccept, onDismiss, decided }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(after)
  useEffect(() => setText(after), [after])
  const placeholder = /\[[^\]]*\]/.test(text)
  return (
    <div className={clsx('rounded-xl border p-4 transition', decided === 'accepted' ? 'border-emerald-200 bg-emerald-50/50' : decided === 'dismissed' ? 'border-slate-200 opacity-50' : 'border-slate-200 bg-white')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">{kindLabel}</span>
        {chips}
        {where && <span className="text-muted">{where}</span>}
      </div>
      {before && <p className="mb-1.5 text-[14px] text-slate-500 line-through decoration-slate-300">{before}</p>}
      {editing
        ? <textarea className="field min-h-[80px] text-[14px]" value={text} onChange={e => setText(e.target.value)} autoFocus />
        : <p className="text-[14px] text-ink">{highlightPlaceholders(text)}</p>}
      {reason && <p className="mt-2 text-[12px] text-muted">{reason}</p>}
      {placeholder && !decided && <p className="mt-1 text-[12px] font-medium text-amber-700">Replace the [bracketed] placeholders with your real numbers.</p>}
      {!decided ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn primary icon={Check} onClick={() => { onAccept(text); setEditing(false) }}>Accept</Btn>
          <Btn icon={Pencil} onClick={() => setEditing(v => !v)}>{editing ? 'Preview' : 'Edit'}</Btn>
          <Btn icon={X} onClick={onDismiss}>Dismiss</Btn>
        </div>
      ) : (
        <p className="mt-2 text-[12px] font-medium text-muted">{decided === 'accepted' ? '✓ Applied to this resume' : 'Dismissed'}</p>
      )}
    </div>
  )
}

const highlightPlaceholders = t => t.split(/(\[[^\]]*\])/).map((part, i) => (/^\[.*\]$/.test(part) ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">{part}</mark> : part))

/* ============================== Quality ============================== */

function QualityTab({ onShow }) {
  const resume = useResume()
  const pages = useStore(s => s.pageCount)
  const { ignoreIssue, applyEdit } = useStore()
  const ignored = new Set(resume.optimize?.ignored ?? [])
  const result = useMemo(() => analyzeQuality(resume, { pages }), [resume, pages])
  const [group, setGroup] = useState('all')
  const [showIgnored, setShowIgnored] = useState(false)
  const [rewrites, setRewrites] = useState({}) // issueId → { status, after, reason, error }
  const [batch, setBatch] = useState({ status: 'idle' })
  const server = useServer()

  // Score without ignored issues.
  const active = result.issues.filter(i => !ignored.has(i.id))
  const scored = useMemo(() => {
    const again = analyzeQuality(resume, { pages })
    const keep = again.issues.filter(i => !ignored.has(i.id))
    return rescore(again, keep)
  }, [resume, pages, ignored.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = (showIgnored ? result.issues.filter(i => ignored.has(i.id)) : active)
    .filter(i => group === 'all' || i.group === group)
    .sort((a, b) => SEVERITY[a.severity].order - SEVERITY[b.severity].order)

  const aiTargets = active.filter(i => i.ai && i.target?.bullet >= 0 && i.text)

  const requestRewrites = async issues => {
    const bullets = issues.slice(0, 20).map(i => ({ ref: i.id, text: i.text, issue: i.title }))
    setRewrites(r => ({ ...r, ...Object.fromEntries(issues.map(i => [i.id, { status: 'loading' }])) }))
    try {
      const data = await post('/api/improve', { context: { title: resume.personal.jobTitle || '', targetRole: '' }, bullets })
      const original = Object.fromEntries(issues.map(i => [i.id, i.text]))
      const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      setRewrites(r => ({ ...r, ...Object.fromEntries(data.rewrites.map(w => {
        // The AI may judge that the rule was wrong; an unchanged "rewrite" means the same thing.
        const fine = w.verdict === 'already_fine' || norm(w.after) === norm(original[w.ref])
        return [w.ref, { status: fine ? 'fine' : 'ready', after: w.after, reason: w.reason, mock: data.mock }]
      })) }))
    } catch (e) {
      setRewrites(r => ({ ...r, ...Object.fromEntries(issues.map(i => [i.id, { status: 'error', error: e.message }])) }))
      throw e
    }
  }

  const improveAll = async () => {
    setBatch({ status: 'loading' })
    try {
      await requestRewrites(aiTargets.filter(i => !rewrites[i.id]))
      setBatch({ status: 'done' })
    } catch (e) {
      setBatch({ status: 'error', error: e.message })
    }
  }

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center gap-6">
          <Ring value={scored.overall} size={112} label="out of 100" />
          <div className="min-w-0 flex-1 space-y-2.5">
            {Object.entries(GROUPS).map(([key, g]) => (
              <button key={key} onClick={() => setGroup(group === key ? 'all' : key)} className="block w-full text-left" title={g.blurb}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className={clsx('font-semibold', group === key ? 'text-brand' : 'text-ink')}>{g.label}</span>
                  <span className="tabular-nums text-muted">{scored.groups[key]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-field">
                  <div className="h-full rounded-full transition-all" style={{ width: `${scored.groups[key]}%`, background: scored.groups[key] >= 80 ? '#16a34a' : scored.groups[key] >= 60 ? '#d97706' : '#dc2626' }} />
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-[12px] text-muted">
          <Info size={13} className="mt-0.5 shrink-0" />
          Scored on widely used resume guidelines: ATS parsing, measurable impact, clarity and completeness. Every point links to an issue below.
        </p>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-bold text-ink">{showIgnored ? 'Ignored' : 'Issues'} <span className="font-normal text-muted">({list.length})</span></h3>
          <div className="ml-auto flex items-center gap-2">
            <ServerBadge status={server} />
            {aiTargets.length > 0 && !showIgnored && (
              <Btn primary icon={batch.status === 'loading' ? Loader2 : Sparkles} disabled={batch.status === 'loading' || server === false} onClick={improveAll}
                title="Ask AI to rewrite every flagged bullet (up to 20)">
                {batch.status === 'loading' ? 'Rewriting…' : `Rewrite ${Math.min(aiTargets.length, 20)} bullets`}
              </Btn>
            )}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {['all', ...Object.keys(GROUPS)].map(k => (
            <button key={k} onClick={() => setGroup(k)}
              className={clsx('rounded-full px-3 py-1 text-[13px]', group === k ? 'bg-ink text-white' : 'bg-field text-ink hover:bg-slate-200')}>
              {k === 'all' ? 'All' : GROUPS[k].label}
            </button>
          ))}
        </div>
        <ErrorNote error={batch.status === 'error' && batch.error} />

        {list.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-[14px] text-emerald-800"><CheckCircle2 size={18} /> {showIgnored ? 'Nothing ignored.' : 'No issues here. Nice work.'}</div>
        ) : (
          <div className="space-y-2.5">
            {list.map(issue => (
              <IssueRow key={issue.id} issue={issue} resume={resume} ignored={ignored.has(issue.id)} rewrite={rewrites[issue.id]} serverDown={server === false}
                onFix={() => applyEdit({ kind: 'autofix', fix: issue.fix, target: issue.target })}
                onRewrite={() => requestRewrites([issue]).catch(() => {})}
                onAcceptRewrite={text => { applyEdit({ kind: 'rewrite_bullet', target: issue.target, after: text }); setRewrites(r => ({ ...r, [issue.id]: { ...r[issue.id], status: 'accepted' } })) }}
                onDismissRewrite={() => setRewrites(r => { const n = { ...r }; delete n[issue.id]; return n })}
                onShow={() => onShow(issue.target)}
                onIgnore={() => ignoreIssue(issue.id, !ignored.has(issue.id))} />
            ))}
          </div>
        )}
        {ignored.size > 0 && (
          <button onClick={() => setShowIgnored(v => !v)} className="mt-4 text-[13px] font-medium text-muted hover:text-ink">
            {showIgnored ? '← Back to issues' : `Show ${ignored.size} ignored`}
          </button>
        )}
      </div>
      <VaultSuggestions mode="quality" onShow={onShow} serverDown={server === false} />
    </>
  )
}

function rescore(result, issues) {
  const PENALTY = { high: 18, medium: 9, low: 4, info: 0 }
  const groups = { ...result.groups }
  for (const key of Object.keys(GROUPS)) {
    if (key === 'impact') continue // ratio-based; ignoring a bullet issue adjusts below
    groups[key] = Math.max(0, 100 - issues.filter(i => i.group === key).reduce((n, i) => n + PENALTY[i.severity], 0))
  }
  const ignoredImpact = result.issues.filter(i => i.group === 'impact' && !issues.includes(i)).length
  if (result.stats.bulletCount) groups.impact = Math.min(100, result.groups.impact + Math.round((ignoredImpact / result.stats.bulletCount) * 40))
  const overall = Math.round(Object.entries(GROUPS).reduce((n, [k, g]) => n + groups[k] * g.weight, 0))
  return { ...result, groups, overall }
}

function IssueRow({ issue, resume, ignored, rewrite, serverDown, onFix, onRewrite, onAcceptRewrite, onDismissRewrite, onShow, onIgnore }) {
  const where = whereLabel(resume, issue.target)
  const sev = SEVERITY[issue.severity]
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-2.5">
        <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', sev.dot)} title={sev.label} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{issue.title}</p>
          <p className="text-[13px] text-muted">{issue.detail}</p>
          {where && <p className="mt-1 text-[12px] text-slate-400">{where}</p>}
          {issue.text && <p className="mt-2 rounded-lg bg-soft px-3 py-2 text-[13px] text-body">“{issue.text}”</p>}
        </div>
      </div>

      {rewrite?.status === 'ready' && (
        <div className="mt-3">
          <SuggestionCard kindLabel={rewrite.mock ? 'Rewrite (demo)' : 'AI rewrite'} before="" after={rewrite.after} reason={rewrite.reason}
            onAccept={onAcceptRewrite} onDismiss={onDismissRewrite} />
        </div>
      )}
      {rewrite?.status === 'accepted' && <p className="mt-2 text-[12px] font-medium text-emerald-700">✓ Rewrite applied</p>}
      {rewrite?.status === 'fine' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-900">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold">AI review: this bullet is already fine</p>
            <p className="text-emerald-800">{rewrite.reason}</p>
          </div>
          {!ignored && <button onClick={onIgnore} className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100">Ignore issue</button>}
        </div>
      )}
      {rewrite?.status === 'error' && <div className="mt-2"><ErrorNote error={rewrite.error} /></div>}

      <div className="mt-3 flex flex-wrap gap-2 pl-4">
        {issue.fix && !ignored && <Btn primary icon={Wand2} onClick={onFix}>Fix</Btn>}
        {issue.ai && issue.target?.bullet >= 0 && !ignored && !['ready', 'accepted', 'fine'].includes(rewrite?.status) && (
          <Btn icon={rewrite?.status === 'loading' ? Loader2 : Sparkles} disabled={rewrite?.status === 'loading' || serverDown} onClick={onRewrite}>
            {rewrite?.status === 'loading' ? 'Rewriting…' : 'Suggest rewrite'}
          </Btn>
        )}
        {issue.target && <Btn icon={Eye} onClick={onShow}>Show</Btn>}
        <Btn icon={ignored ? Eye : EyeOff} onClick={onIgnore}>{ignored ? 'Restore' : 'Ignore'}</Btn>
      </div>
    </div>
  )
}

/* ============================== Job match ============================== */

const STATUS = {
  covered: { icon: CheckCircle2, cls: 'text-emerald-600', label: 'Covered' },
  partial: { icon: CircleDashed, cls: 'text-amber-600', label: 'Partly' },
  missing: { icon: CircleX, cls: 'text-red-600', label: 'Missing' },
}
const KIND_LABEL = { rewrite_bullet: 'Rewrite bullet', rewrite_summary: 'Rewrite summary', add_skill: 'Add skill', move_bullet_up: 'Move bullet up' }

function JobTab({ onShow }) {
  const resume = useResume()
  const { setOptimize, applyEdit, createTailoredCopy } = useStore()
  const job = resume.optimize?.job ?? {}
  const [text, setText] = useState(job.text ?? '')
  const [busy, setBusy] = useState(null) // 'analyze' | 'suggest'
  const [error, setError] = useState(null)
  const server = useServer()

  useEffect(() => { setText(resume.optimize?.job?.text ?? '') }, [resume.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveJob = patch => setOptimize({ job: { ...(resume.optimize?.job ?? {}), ...patch } })
  const stale = job.match && resume.updatedAt > (job.matchedAt ?? 0) + 1000

  const analyze = async () => {
    setError(null)
    setBusy('analyze')
    try {
      const { analysis, mock } = await post('/api/jd/analyze', { jobDescription: text })
      const { match } = await post('/api/jd/match', { resume: resumeToPayload(resume), analysis })
      saveJob({ text, analysis, match, mock, matchedAt: Date.now(), suggestions: null, decisions: {} })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const recheck = async () => {
    setError(null)
    setBusy('analyze')
    try {
      const { match } = await post('/api/jd/match', { resume: resumeToPayload(resume), analysis: job.analysis })
      saveJob({ match, matchedAt: Date.now() })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const suggest = async () => {
    setError(null)
    setBusy('suggest')
    try {
      const { suggestions } = await post('/api/jd/suggest', { resume: resumeToPayload(resume), analysis: job.analysis, match: job.match })
      saveJob({ suggestions, decisions: {} })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const decide = (id, decision) => saveJob({ decisions: { ...(job.decisions ?? {}), [id]: decision } })
  const pending = (job.suggestions ?? []).filter(s => !job.decisions?.[s.id])

  const tailoredCopy = () => {
    const company = job.analysis?.company?.trim()
    const name = prompt('Name for the tailored copy', `${resume.name} – ${company || job.analysis?.title || 'tailored'}`)
    if (name === null) return
    const label = prompt('Label (optional)', company ? company.toLowerCase() : resume.label ?? '')
    createTailoredCopy({ sourceId: resume.id, name, label: label ?? '', edits: pending.map(s => ({ kind: s.kind, target: s.target, after: s.after })) })
  }

  const reqById = Object.fromEntries((job.analysis?.requirements ?? []).map(r => [r.id, r]))

  return (
    <>
      <div className="card p-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-[18px] font-bold text-ink">Job description</h3>
          <span className="ml-auto"><ServerBadge status={server} /></span>
        </div>
        <textarea className="field min-h-[180px] text-[14px] leading-relaxed" placeholder="Paste the full job description: title, responsibilities and requirements."
          value={text} onChange={e => setText(e.target.value)} />
        <p className="mt-2 text-[12px] text-muted">Your resume and this job description are sent to the AI server only when you click Analyze.</p>
        <div className="mt-3 flex items-center gap-2">
          <Btn primary icon={busy === 'analyze' ? Loader2 : Target} disabled={busy || text.trim().length < 80 || server === false} onClick={analyze}>
            {busy === 'analyze' ? 'Analyzing…' : job.analysis ? 'Analyze again' : 'Analyze match'}
          </Btn>
          {text.trim().length > 0 && text.trim().length < 80 && <span className="text-[12px] text-muted">Paste the full description (a few sentences at least).</span>}
        </div>
        <div className="mt-3"><ErrorNote error={error} /></div>
      </div>

      {job.built && (
        <div className="card flex gap-3 p-5 text-[14px]">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-ink">Built from your vault for this job: {job.built.bullets} of your own bullets, word for word. Review it in Content, then use the suggestions below to fine-tune.</p>
            {job.built.gaps?.length > 0 && <p className="mt-1 text-muted">Nothing in your vault shows: {job.built.gaps.join('; ')}. Add it to the Vault if you have that experience.</p>}
          </div>
        </div>
      )}
      {job.analysis && job.match && (
        <div className="card p-6">
          <div className="flex items-center gap-5">
            <Ring value={job.match.matchScore} size={104} label="match" />
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-ink">{job.analysis.title}</p>
              <p className="text-[14px] text-muted">{[job.analysis.company, job.analysis.seniority !== 'unknown' && job.analysis.seniority].filter(Boolean).join(' · ')}</p>
              <p className="mt-1 text-[13px] text-body">{job.analysis.summary}</p>
              {job.mock && <p className="mt-1 text-[12px] font-medium text-amber-700">Demo mode: keyword matching only. Add an API key on the server for real analysis.</p>}
            </div>
          </div>
          {stale && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-800">
              Your resume changed since this check.
              <button onClick={recheck} disabled={busy} className="ml-auto flex items-center gap-1 font-semibold hover:underline"><RefreshCw size={13} /> Re-check</button>
            </div>
          )}

          {['must', 'nice'].map(level => {
            const reqs = job.analysis.requirements.filter(r => r.importance === level)
            if (!reqs.length) return null
            return (
              <div key={level} className="mt-5">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{level === 'must' ? 'Must have' : 'Nice to have'}</p>
                <div className="space-y-1.5">
                  {reqs.map(r => {
                    const m = job.match.requirements.find(x => x.id === r.id) ?? { status: 'missing', evidence: [], note: '' }
                    const S = STATUS[m.status]
                    return (
                      <details key={r.id} className="group rounded-lg bg-soft px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-start gap-2">
                          <S.icon size={17} className={clsx('mt-0.5 shrink-0', S.cls)} />
                          <span className="flex-1 text-[14px] text-ink">{r.text}</span>
                          <span className={clsx('text-[12px] font-medium', S.cls)}>{S.label}</span>
                          <ChevronDown size={15} className="mt-0.5 text-muted transition group-open:rotate-180" />
                        </summary>
                        <div className="mt-2 space-y-1.5 pl-7 text-[13px]">
                          {m.note && <p className="text-muted">{m.note}</p>}
                          {r.keywords.length > 0 && <p className="text-muted">Keywords: {r.keywords.join(', ')}</p>}
                          {m.evidence.map((ev, i) => (
                            <button key={i} onClick={() => onShow(ev)} className="flex items-center gap-1 text-brand hover:underline">
                              <Eye size={13} /> {whereLabel(resume, ev) ?? 'Show'}
                            </button>
                          ))}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {(job.match.strengths.length > 0 || job.match.gaps.length > 0) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {job.match.strengths.length > 0 && (
                <div className="rounded-xl bg-emerald-50 p-3 text-[13px] text-emerald-900">
                  <p className="mb-1 font-semibold">Strengths</p>
                  <ul className="list-disc space-y-0.5 pl-4">{job.match.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {job.match.gaps.length > 0 && (
                <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-900">
                  <p className="mb-1 font-semibold">Gaps to address</p>
                  <ul className="list-disc space-y-0.5 pl-4">{job.match.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {job.analysis && job.match && (
        <div className="card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-bold text-ink">Tailoring suggestions</h3>
            <div className="ml-auto flex gap-2">
              <Btn primary={!job.suggestions} icon={busy === 'suggest' ? Loader2 : Sparkles} disabled={busy || server === false} onClick={suggest}>
                {busy === 'suggest' ? 'Thinking…' : job.suggestions ? 'Suggest again' : 'Suggest edits'}
              </Btn>
            </div>
          </div>
          <p className="mb-4 text-[13px] text-muted">
            Each edit is a tracked change: <b>Accept</b> applies it to this resume (undo with ⌘Z), or leave edits pending and put them all into a <b>tailored copy</b>. The AI only rephrases what your resume already shows; it never invents experience.
          </p>
          {job.suggestions && job.suggestions.length === 0 && <p className="text-[14px] text-muted">No safe edits found. The gaps above need new experience, not rewording.</p>}
          <div className="space-y-3">
            {(job.suggestions ?? []).map(s => (
              <SuggestionCard key={s.id} kindLabel={KIND_LABEL[s.kind]} before={s.before} after={s.after} reason={s.reason}
                where={whereLabel(resume, s.target)} decided={job.decisions?.[s.id]}
                chips={s.requirementIds.map(id => reqById[id] && <span key={id} className="rounded-full bg-field px-2 py-0.5 text-muted" title={reqById[id].text}>{reqById[id].keywords[0] ?? id}</span>)}
                onAccept={text => { if (applyEdit({ kind: s.kind, target: s.target, after: text })) decide(s.id, 'accepted') }}
                onDismiss={() => decide(s.id, 'dismissed')} />
            ))}
          </div>
          {pending.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft p-4">
              <CopyPlus size={20} className="text-brand" />
              <p className="flex-1 text-[14px] text-ink">Keep this resume as it is and create a <b>tailored copy</b> with the {pending.length} pending edit{pending.length === 1 ? '' : 's'}.</p>
              <Btn primary onClick={tailoredCopy}>Create tailored copy</Btn>
            </div>
          )}
        </div>
      )}
      {job.analysis && job.match && <VaultSuggestions mode="job" onShow={onShow} serverDown={server === false} />}
    </>
  )
}
