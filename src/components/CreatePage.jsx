import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowLeft, FilePlus2, Upload, FileText, Loader2, AlertCircle, CheckCircle2,
  Type, Palette, FileArchive, ChevronRight, Target, Circle, Archive,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { SECTION_TYPES } from '../lib/sections'
import { importResumeFile, importLinkedIn, ACCEPT, LINKEDIN_ACCEPT } from '../lib/import'
import { useLabels } from './ResumeLabel'
import { LinkedInIcon } from './BrandIcons'
import { post, health } from '../lib/api'
import { composePayload, planFromVault, tailorPayload, buildFromVault, wholeVaultComposition, vaultHasContent } from '../lib/vault/compose'
import { TEMPLATES, KEEP_ON_TEMPLATE, DEFAULT_TEMPLATE_ID } from '../lib/templates'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { TemplateCard } from './TemplateGallery'
import { jobScore } from '../lib/optimize/jobScore'
import { resumeToPayload } from '../lib/optimize/serialize'

// Page nav: groups, each item a page of its own.
const NAV = [
  { group: 'Start', items: [
    { id: 'vault', icon: Archive, label: 'From your vault' },
    { id: 'blank', icon: FilePlus2, label: 'Blank resume' },
  ] },
  { group: 'Tailor', items: [
    { id: 'job', icon: Target, label: 'From a job description' },
  ] },
  { group: 'Import', items: [
    { id: 'file', icon: Upload, label: 'From a CV' },
    { id: 'linkedin', icon: LinkedInIcon, label: 'From LinkedIn' },
  ] },
]
const TABS = NAV.flatMap(g => g.items.map(i => i.id))
const tabOf = t => (TABS.includes(t) ? t : 'blank')

// A template's design for a new resume, keeping the document settings (language, dates, page size) of the usual design.
function designFor(templateId, usual) {
  if (templateId === usual.templateId) return usual
  const t = TEMPLATES.find(x => x.id === templateId) ?? TEMPLATES.find(x => x.id === DEFAULT_TEMPLATE_ID)
  const kept = Object.fromEntries(KEEP_ON_TEMPLATE.map(k => [k, usual[k]]))
  return { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(t.settings), ...kept, templateId: t.id }
}

export default function CreatePage({ initialTab = 'blank', onCancel, onCreated }) {
  const { createResume, addResume, resumes } = useStore()
  const vault = useStore(s => s.vault)
  const usual = useStore.getState().newDesign()
  const labels = useLabels()
  const [tab, setTab] = useState(tabOf(initialTab))
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [imp, setImp] = useState({ status: 'idle' }) // idle | reading | ready | error — per import tab
  const [templateId, setTemplateId] = useState(usual.templateId ?? DEFAULT_TEMPLATE_ID) // imports: a template id or 'original'
  const [jd, setJd] = useState({ text: '', pages: 1, status: 'idle', steps: [] }) // job tab
  const [pages, setPages] = useState(1) // vault tab
  const hasData = vaultHasContent(vault)

  useEffect(() => { setTab(tabOf(initialTab)) }, [initialTab])
  useEffect(() => { useStore.getState().syncVault() }, [])
  // Switching between import pages starts over.
  useEffect(() => { setImp({ status: 'idle' }) }, [tab])

  const importing = tab === 'file' || tab === 'linkedin'
  const needsData = (tab === 'job' || tab === 'vault') && !hasData

  const readFile = async file => {
    if (!file) return
    setImp({ status: 'reading', file })
    try {
      const result = tab === 'linkedin' ? await importLinkedIn(file) : await importResumeFile(file)
      setImp({ status: 'ready', file, ...result })
    } catch (err) {
      console.error(err)
      // The file readers load on demand; if the app was updated or its server restarted since the page
      // loaded, that load fails. A reload fixes it.
      const stale = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(err.message || '')
      setImp({ status: 'error', file, error: stale ? 'The app was updated or restarted since this page loaded. Reload the page and try again.' : err.message || 'Something went wrong reading that file.' })
    }
  }

  const placeholder = {
    blank: `Resume ${resumes.length + 1}`,
    vault: vault.profile?.fullName ? `${vault.profile.fullName} – full resume` : 'Full resume',
    file: imp.file ? imp.file.name.replace(/\.[^.]+$/, '') : 'Name of the imported resume',
    linkedin: imp.status === 'ready' ? imp.build().name : 'LinkedIn import',
    job: 'Job title – Company (from the job)',
  }[tab]

  const canCreate = needsData ? false : importing ? imp.status === 'ready' : tab === 'job' ? jd.text.trim().length >= 80 && jd.status !== 'running' : true

  // Sync the vault → read the job → pick vault content → tailor it → build → score against the job.
  const buildFromJob = async () => {
    const steps = []
    const step = (id, label) => { steps.push({ id, label, status: 'running' }); setJd(j => ({ ...j, status: 'running', steps: [...steps], error: null })) }
    const finish = detail => { const last = steps.at(-1); last.status = 'done'; if (detail) last.detail = detail; setJd(j => ({ ...j, steps: [...steps] })) }
    try {
      step('sync', 'Syncing your vault')
      useStore.getState().syncVault()
      const { vault, resumes: all } = useStore.getState()
      const payload = composePayload(vault)
      const bulletTotal = payload.items.reduce((n, i) => n + i.bullets.length, 0)
      if (!payload.items.some(i => i.kind === 'experience' || i.kind === 'projects')) throw new Error('Your vault has no experience or projects yet. Add content to a resume or the Vault first.')
      finish(`${payload.items.length} entries · ${bulletTotal} bullets`)

      step('analyze', 'Reading the job description')
      const { analysis, mock } = await post('/api/jd/analyze', { jobDescription: jd.text })
      finish([analysis.title, analysis.company].filter(Boolean).join(' · '))

      step('compose', 'Choosing your most relevant experience')
      const { composition } = await post('/api/resume/compose', { analysis, targetBullets: jd.pages === 1 ? 16 : 30, headlines: payload.headlines, items: payload.items })
      const plan = planFromVault({ vault, composition })
      const companies = new Set(plan.entries.filter(e => e.type === 'experience').map(e => e.item.id)).size
      finish(`${plan.entries.reduce((n, e) => n + e.bullets.length, 0)} bullets · all ${companies} compan${companies === 1 ? 'y' : 'ies'}`)

      step('tailor', 'Tailoring title, summary, bullets and skills')
      const { tailored } = await post('/api/resume/tailor', { analysis, ...tailorPayload(plan, vault) })
      const company = analysis.company?.trim()
      const finalName = name.trim() || [analysis.title, company].filter(Boolean).join(' – ') || 'Tailored resume'
      const { resume, changes } = buildFromVault({ vault, resumes: all, plan, tailored, settings: useStore.getState().newDesign(), name: finalName, label: label.trim() || (company ? company.toLowerCase() : '') })
      const reworded = changes.filter(c => c.kind === 'bullet').length
      finish(`${reworded} bullet${reworded === 1 ? '' : 's'} lightly reworded${changes.some(c => c.kind === 'summary') ? ' · new summary' : ''}${changes.some(c => c.kind === 'title') ? ' · new title' : ''}`)

      step('match', 'Scoring against the job')
      const { match } = await post('/api/jd/match', { resume: resumeToPayload(resume), analysis })
      const score = jobScore(resume, analysis, match)
      finish(`${score.overall}/100 match`)

      resume.optimize = { job: { text: jd.text, analysis, match, mock, matchedAt: Date.now(), suggestions: null, decisions: {}, built: { changes, gaps: composition.gaps, backfilled: plan.backfilled, at: Date.now() } } }
      const id = addResume(resume)
      useStore.getState().setOptimizeTab('job')
      onCreated?.(id, 'optimize')
    } catch (err) {
      const last = steps.at(-1)
      if (last) last.status = 'error'
      setJd(j => ({ ...j, status: 'error', steps: [...steps], error: err.message || 'Something went wrong.' }))
    }
  }

  const submit = e => {
    e.preventDefault()
    if (!canCreate) return
    if (tab === 'job') { buildFromJob(); return }
    const finalName = name.trim()
    let id
    if (tab === 'vault') {
      // Everything in the vault, no job and no AI: the usual design, contact details from the vault profile.
      useStore.getState().syncVault()
      const { vault: v, resumes: all } = useStore.getState()
      const plan = planFromVault({ vault: v, composition: wholeVaultComposition(v, { pages }) })
      const { resume } = buildFromVault({ vault: v, resumes: all, plan, tailored: null, settings: usual, name: finalName || placeholder, label: label.trim() })
      id = addResume(resume)
    } else if (importing) {
      // The chosen template, or the file's own layout and design ("original") on top of the usual design.
      const built = templateId === 'original'
        ? imp.build({ layout: true, design: true, base: usual })
        : { ...imp.build({ layout: false, design: false, base: usual }), settings: designFor(templateId, usual) }
      id = addResume({ ...built, name: finalName || placeholder, label: label.trim() })
    } else {
      id = createResume({ from: tab, name: finalName, label: label.trim() })
    }
    onCreated?.(id)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <button onClick={onCancel} className="mb-4 flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} /> Back
      </button>
      <h1 className="display mb-8 border-b border-rule pb-6 text-[40px] leading-none text-ink">New resume</h1>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* page nav */}
        <nav className="md:sticky md:top-8 md:h-fit md:w-56 md:shrink-0">
          <div className="flex gap-2 overflow-x-auto md:flex-col md:gap-6 md:overflow-visible">
            {NAV.map(g => (
              <div key={g.group} className="flex gap-1 md:flex-col">
                <p className="meta hidden px-3 pb-1.5 uppercase tracking-[0.08em] text-muted md:block">{g.group}</p>
                {g.items.map(it => (
                  <button key={it.id} onClick={() => setTab(it.id)}
                    className={clsx('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] transition',
                      tab === it.id ? 'bg-white font-medium text-ink ring-1 ring-rule' : 'text-body hover:bg-white/60 hover:text-ink')}>
                    <it.icon size={16} className={tab === it.id ? 'text-brand' : 'text-muted'} />
                    <span className="whitespace-nowrap">{it.label}</span>
                    <ChevronRight size={14} className={clsx('ml-auto hidden md:block', tab === it.id ? 'text-ink' : 'text-transparent')} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* page */}
        <form onSubmit={submit} className="card min-w-0 flex-1 p-7">
          {tab === 'blank' && (
            <Intro title="Blank resume" text="Start with empty Profile, Education, Skills and Experience sections and the default design. Add more sections any time from the editor." />
          )}
          {tab === 'vault' && (needsData ? <NeedsData onPick={setTab} /> : <FromVault vault={vault} pages={pages} setPages={setPages} />)}
          {tab === 'file' && (
            <>
              <Intro title="Import a CV" text="Bring in an existing resume (PDF, Word, text or a JSON backup), then choose its template." />
              <DropZone imp={imp} onFile={readFile} accept={ACCEPT} hint="PDF · Word (.docx) · TXT / Markdown · JSON backup" />
            </>
          )}
          {tab === 'linkedin' && (
            <>
              <Intro title="Import from LinkedIn" text="Use a file you download from LinkedIn — nothing is fetched from LinkedIn and the file never leaves your browser." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <HowTo icon={FileText} title="Profile PDF" badge="Instant">
                  <li>Open your LinkedIn profile.</li>
                  <li>Click <b>Resources</b> (or <b>More</b>) under your name.</li>
                  <li>Choose <b>Save to PDF</b> and drop the file below.</li>
                </HowTo>
                <HowTo icon={FileArchive} title="Data export ZIP" badge="Most complete">
                  <li><b>Settings → Data privacy → Get a copy of your data</b>.</li>
                  <li>Pick the larger archive or tick Profile, Positions, Education, Skills.</li>
                  <li>LinkedIn emails a link (minutes to a day). Drop the ZIP below.</li>
                </HowTo>
              </div>
              <DropZone imp={imp} onFile={readFile} accept={LINKEDIN_ACCEPT} hint="LinkedIn profile PDF or data export ZIP" />
            </>
          )}

          {tab === 'job' && (needsData ? <NeedsData onPick={setTab} job /> : <FromJob jd={jd} setJd={setJd} />)}

          {importing && imp.status === 'ready' && <ImportSummary imp={imp} templateId={templateId} setTemplateId={setTemplateId} />}

          {!needsData && <>
          <div className="mt-7 grid gap-4 border-t border-rule pt-6 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="field" value={name} placeholder={placeholder} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Label <span className="font-normal text-muted">(optional)</span></label>
              <input className="field" list="create-labels" value={label} maxLength={40} placeholder="e.g. b2c - google" onChange={e => setLabel(e.target.value)} />
              <datalist id="create-labels">{labels.map(l => <option key={l} value={l} />)}</datalist>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-md px-5 py-2.5 font-medium text-muted hover:bg-field hover:text-ink">Cancel</button>
            <button type="submit" disabled={!canCreate}
              className="rounded-md bg-ink px-7 py-2.5 text-[15px] font-medium text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40">
              {tab === 'job' ? (jd.status === 'running' ? 'Building…' : 'Build for this job') : tab === 'vault' ? 'Create from vault' : importing ? 'Create from import' : 'Create resume'}
            </button>
          </div>
          </>}
        </form>
      </div>
    </div>
  )
}

function FromJob({ jd, setJd }) {
  const vault = useStore(s => s.vault)
  const syncVault = useStore(s => s.syncVault)
  const [server, setServer] = useState(null)
  useEffect(() => { syncVault(); health().then(h => setServer(h ?? false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const bullets = vault.items.reduce((n, i) => n + i.bullets.length, 0)
  const running = jd.status === 'running'
  const p = vault.profile ?? {}
  return (
    <>
      <Intro title="From a job description" text="Paste a job. Your vault is synced, then AI builds a resume for this job from your own experience: every company, the most relevant bullets (lightly reworded in the job’s terms), a tailored title, summary and skills. Nothing is invented. You land on the match score." />
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-soft px-3 py-2 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><Archive size={15} className="text-brand" /> Vault: {vault.items.length} entries · {bullets} bullets</span>
        <span>Contact details: {p.fullName || p.email ? [p.fullName, p.email].filter(Boolean).join(' · ') : 'none in your vault profile yet'}</span>
        <span className="ml-auto">{server === false ? <span className="text-red-600">AI server offline</span> : server?.mock ? <span className="text-amber-700">Demo mode (no API key)</span> : server ? <span className="text-emerald-700">AI connected</span> : 'Checking AI server…'}</span>
      </div>
      <textarea className="field mt-4 min-h-[200px] text-[14px] leading-relaxed" disabled={running} placeholder="Paste the full job description: title, responsibilities and requirements."
        value={jd.text} onChange={e => setJd(j => ({ ...j, text: e.target.value }))} />
      <div className="mt-4 flex items-center gap-3">
        <label className="label mb-0">Length</label>
        <div className="flex gap-1 rounded-lg bg-field p-1">
          {[1, 2].map(n => (
            <button key={n} type="button" disabled={running} onClick={() => setJd(j => ({ ...j, pages: n }))}
              className={clsx('rounded-md px-4 py-1.5 text-[14px] font-medium', jd.pages === n ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}>
              {n} page{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>
      {jd.steps.length > 0 && (
        <ol className="mt-5 space-y-2 rounded-lg bg-soft p-4 text-[14px]">
          {jd.steps.map(s => (
            <li key={s.id} className="flex items-center gap-2">
              {s.status === 'running' ? <Loader2 size={16} className="animate-spin text-brand" /> : s.status === 'done' ? <CheckCircle2 size={16} className="text-emerald-600" /> : s.status === 'error' ? <AlertCircle size={16} className="text-red-600" /> : <Circle size={16} className="text-muted" />}
              <span className="text-ink">{s.label}</span>
              {s.detail && <span className="ml-auto text-right text-[13px] text-muted">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}
      {jd.status === 'error' && <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-[14px] text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /> {jd.error}</div>}
    </>
  )
}

function Intro({ title, text }) {
  return (
    <>
      <h2 className="display text-[30px] leading-tight text-ink">{title}</h2>
      <p className="mt-1.5 text-muted">{text}</p>
    </>
  )
}

function HowTo({ icon: Icon, title, badge, children }) {
  return (
    <div className="rounded-lg bg-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={17} className="text-ink" />
        <span className="font-semibold text-ink">{title}</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-slate-200">{badge}</span>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] text-body">{children}</ol>
    </div>
  )
}

function DropZone({ imp, onFile, accept, hint }) {
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  return (
    <div className="mt-5">
      <div
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]) }}
        className={clsx('flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition',
          over ? 'border-brand bg-brand-soft' : 'border-slate-300 hover:border-brand hover:bg-soft')}
      >
        {imp.status === 'reading' ? (
          <>
            <Loader2 size={26} className="animate-spin text-brand" />
            <span className="font-medium text-ink">Reading {imp.file.name}…</span>
          </>
        ) : imp.file ? (
          <>
            <FileText size={26} className="text-ink" />
            <span className="max-w-full truncate font-medium text-ink">{imp.file.name}</span>
            <span className="text-[13px] text-brand">Choose a different file</span>
          </>
        ) : (
          <>
            <Upload size={26} className="text-ink" />
            <span className="font-medium text-ink">Drop a file here or <span className="text-brand">browse</span></span>
            <span className="text-[13px] text-muted">{hint}</span>
          </>
        )}
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
      </div>
      {imp.status === 'error' && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-[14px] text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" /> {imp.error}
        </div>
      )}
    </div>
  )
}

function ImportSummary({ imp, templateId, setTemplateId }) {
  const { summary, source } = imp
  const entries = summary.sections.reduce((n, s) => n + s.count, 0)
  // Previews of the imported resume: as the file designed it, and in each template.
  const hasOriginal = !imp.linkedin && (!!imp.design || imp.source === 'json')
  const original = useMemo(() => (hasOriginal ? imp.build({ layout: true, design: true }) : null), [imp, hasOriginal])
  const plain = useMemo(() => (imp.linkedin ? imp.build() : imp.build({ layout: false, design: false })), [imp])
  return (
    <div className="mt-4 space-y-3 text-[14px]">
      <Layer icon={Type} title="Text" status={<><CheckCircle2 size={15} className="text-emerald-600" /> {summary.sections.length} sections · {entries} entries</>}>
        <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted">Name</dt><dd className="truncate text-ink">{summary.name || <i className="text-muted">not found</i>}</dd>
          <dt className="text-muted">Title</dt><dd className="truncate text-ink">{summary.title || <i className="text-muted">not found</i>}</dd>
          <dt className="text-muted">Contact</dt><dd className="truncate text-ink">{summary.contacts.join(' · ') || <i className="text-muted">not found</i>}</dd>
        </dl>
        {summary.sections.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.sections.map((s, i) => {
              const Icon = SECTION_TYPES[s.type].icon
              return (
                <span key={i} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-[12px] text-ink ring-1 ring-rule">
                  <Icon size={12} /> {s.heading} <span className="meta text-muted">{s.count}</span>
                </span>
              )
            })}
          </div>
        )}
      </Layer>

      <div className="rounded-lg border border-rule p-4">
        <div className="mb-3 flex items-center gap-2">
          <Palette size={16} className="text-ink" />
          <span className="font-semibold text-ink">Template</span>
          <span className="ml-auto text-[12px] text-muted">Change it any time in Design</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-x-3 gap-y-4">
          {hasOriginal && (
            <TemplateCard resume={original} template={{ id: 'original', name: 'Original', style: source === 'json' ? 'As saved in the backup' : 'Layout and design from the file', settings: original.settings }}
              active={templateId === 'original'} onApply={() => setTemplateId('original')} />
          )}
          {TEMPLATES.map(t => <TemplateCard key={t.id} resume={plain} template={t} active={templateId === t.id} onApply={() => setTemplateId(t.id)} />)}
        </div>
      </div>
      {source !== 'json' && (
        <p className="px-1 text-[12px] text-muted">Imports are read automatically. Give each section a quick check after creating.</p>
      )}
    </div>
  )
}

// Tailoring and building from the vault need something in it first.
function NeedsData({ onPick, job }) {
  return (
    <>
      <Intro title={job ? 'From a job description' : 'From your vault'} text={job
        ? 'To tailor a resume to a job, the app needs your experience first: your roles, projects and achievements. Add them once; every tailored resume is built from them.'
        : 'Your vault is empty. It fills up from your resumes, so bring in an existing CV or your LinkedIn profile first.'} />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['file', Upload, 'Import a CV', 'PDF or Word. Everything goes into your vault.'],
          ['linkedin', LinkedInIcon, 'Import from LinkedIn', 'Profile PDF or data export.'],
          ['blank', FilePlus2, 'Write it yourself', 'Start a blank resume and fill in your experience.'],
        ].map(([id, Icon, title, text]) => (
          <button key={id} type="button" onClick={() => onPick(id)} className="rounded-lg border border-rule bg-white p-4 text-left transition hover:border-ink/40">
            <Icon size={18} className="text-brand" />
            <p className="mt-2 font-medium text-ink">{title}</p>
            <p className="mt-1 text-[13px] text-muted">{text}</p>
          </button>
        ))}
      </div>
    </>
  )
}

// A complete resume from everything in the vault, no job and no AI.
function FromVault({ vault, pages, setPages }) {
  const count = kind => vault.items.filter(i => i.kind === kind).length
  const roles = vault.items.filter(i => i.kind === 'experience').reduce((n, i) => n + Math.max(1, i.roles.length), 0)
  const bullets = vault.items.reduce((n, i) => n + (i.kind === 'skills' ? 0 : i.bullets.length), 0)
  const p = vault.profile ?? {}
  return (
    <>
      <Intro title="From your vault" text="A complete resume from everything in your vault: every company and role with its strongest bullets, your projects, education, certifications and skills, and your profile. It uses your usual design. No AI and no job needed." />
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
        {[['Companies', count('experience')], ['Roles', roles], ['Bullets', bullets], ['Projects', count('projects')]].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <p className="meta uppercase tracking-[0.08em] text-muted">{k}</p>
            <p className="display text-[28px] leading-tight text-ink">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Contact details: {p.fullName || p.email ? [p.fullName, p.email, p.phone].filter(Boolean).join(' · ') : 'none in your vault profile yet (you can add them in the Vault)'}
        {p.headlines?.[0] && <> · Title: {p.headlines[0]}</>}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <span className="label mb-0">Length</span>
        <div className="flex overflow-hidden rounded-md border border-rule bg-white">
          {[1, 2].map((n, i) => (
            <button key={n} type="button" onClick={() => setPages(n)} className={clsx('px-4 py-1.5 text-[14px]', i > 0 && 'border-l border-rule', pages === n ? 'bg-ink text-white' : 'text-body hover:bg-field')}>
              {n === 1 ? 'Concise' : 'Detailed'}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-muted">{pages === 1 ? 'Up to 4 bullets for recent roles, 2 for older ones' : 'Up to 6 bullets for recent roles, 4 for older ones'}</span>
      </div>
    </>
  )
}

function Layer({ icon: Icon, title, status, children }) {
  return (
    <div className="rounded-lg bg-soft p-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon size={16} className="text-ink" />
        <span className="font-semibold text-ink">{title}</span>
        {status && <span className="ml-auto flex items-center gap-1 text-[13px] text-muted">{status}</span>}
      </div>
      {children}
    </div>
  )
}

