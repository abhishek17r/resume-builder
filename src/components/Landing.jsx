import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowRight, Upload, Archive, Target, Gauge, LayoutTemplate, ShieldCheck, FileSearch, Check, Copy, Circle } from 'lucide-react'
import { Thumbnail } from './Preview'
import { Mark } from './TopBar'
import { sampleResume } from '../lib/defaults'
import { TEMPLATES } from '../lib/templates'
import { useServerStatus } from '../lib/useServerStatus'
import { APP_NAME, APP_TAGLINE, INSTALL_CMD } from '../config/app'

// The front door: what this is, how it works, and how to run it locally. No pricing, no accounts.
export default function Landing({ onOpen, onImport, onJob }) {
  const samples = useMemo(() => ['scholar', 'current', 'margin'].map(id => {
    const r = sampleResume()
    r.settings = { ...r.settings, ...TEMPLATES.find(t => t.id === id).settings }
    return r
  }), [])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-6">
        <Mark />
        <span className="display text-[22px] text-ink">{APP_NAME}</span>
        <a href="#local" className="ml-auto hidden text-[14px] text-body hover:text-ink sm:block">Run it locally</a>
        <button onClick={onOpen} className="ml-4 flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-white hover:bg-ink/85">
          Open workspace <ArrowRight size={15} />
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="meta mb-5 inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1 uppercase tracking-[0.08em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Local-first · open source
          </p>
          <h1 className="display text-[52px] leading-[1.02] text-ink sm:text-[64px]">
            One history.<br />A resume for <em className="text-brand">every</em> job.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-body">
            {APP_TAGLINE} Keep every bullet you’ve ever written in one vault, build a version tailored to each job in under a minute, and see exactly how well it matches, all on your own machine.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onOpen} className="flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-[15px] font-medium text-white hover:bg-ink/85">
              Open workspace <ArrowRight size={16} />
            </button>
            <button onClick={onImport} className="flex items-center gap-2 rounded-md border border-rule bg-white px-5 py-3 text-[15px] font-medium text-ink hover:border-ink/40">
              <Upload size={16} /> Import your resume
            </button>
          </div>
          <p className="mt-5 text-[13px] text-muted">No sign-up. Nothing leaves your computer except AI requests you make, through your own key.</p>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-[460px]">
          {samples.map((r, i) => (
            <div key={i} className="absolute overflow-hidden rounded-[3px] bg-white shadow-[0_24px_48px_-24px_rgba(23,23,27,.35)] ring-1 ring-rule"
              style={{ left: `${i * 22}%`, top: `${[34, 0, 58][i]}px`, transform: `rotate(${[-4, 1.5, 5][i]}deg)`, zIndex: [1, 3, 2][i] }}>
              <Thumbnail resume={r} width={230} />
            </div>
          ))}
        </div>
      </section>

      {/* See it work */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <h2 className="display text-[36px] leading-none text-ink">From job post to tailored resume</h2>
          <p className="meta ml-auto text-muted">paste · build · check the match · pick a design</p>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-rule bg-white shadow-[0_30px_60px_-30px_rgba(23,23,27,.35)]">
          <div className="flex items-center gap-2 border-b border-rule bg-paper px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e0dbcf]" /><span className="h-2.5 w-2.5 rounded-full bg-[#e0dbcf]" /><span className="h-2.5 w-2.5 rounded-full bg-[#e0dbcf]" />
            <span className="meta mx-auto rounded-sm bg-white px-3 py-0.5 text-muted ring-1 ring-rule">localhost:5190</span>
          </div>
          <img src="/demo/tailor-journey.gif" alt="Pasting a job description, building a tailored resume from the vault, reviewing the match score and switching templates" width="960" height="600" loading="lazy" className="block h-auto w-full" />
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-rule bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="display text-[36px] text-ink">How it works</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              ['01', 'Bring your history', 'Import a PDF or Word resume, or your LinkedIn profile. Text, layout and design are read separately, so nothing gets scrambled.', onImport, 'Import a resume'],
              ['02', 'Keep one vault', 'Every bullet from every version lands in the Vault, deduplicated, tagged by what it shows (leadership, revenue, technical…) and scored.', onOpen, 'Open the workspace'],
              ['03', 'Tailor to each job', 'Paste a job description. You get a resume built from your own experience, lightly reworded in the job’s terms, with a match score you can trust.', onJob, 'Tailor to a job'],
            ].map(([n, title, text, action, cta]) => (
              <div key={n}>
                <p className="meta text-brand">{n}</p>
                <h3 className="mt-2 text-[19px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 leading-relaxed text-body">{text}</p>
                <button onClick={action} className="mt-3 flex items-center gap-1 text-[14px] font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">{cta} <ArrowRight size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="display text-[36px] text-ink">What’s inside</h2>
        <div className="mt-8 grid border-t border-rule md:grid-cols-2">
          {[
            [Archive, 'Vault', 'Master data for your career: companies, projects, skills and your profile, across every resume. Edit once, reuse everywhere.'],
            [Target, 'Tailor to a job', 'Every company included, the most relevant bullets chosen, title, summary and skills fitted to the role. Facts and numbers are never changed.'],
            [Gauge, 'Match score', 'Requirements covered, job keywords found, title fit, weighted and shown piece by piece, so you know what to fix.'],
            [FileSearch, 'Quality checks', 'Measurable results, strong verbs, length, tense and clichés, checked per bullet with one-click fixes and honest AI rewrites.'],
            [LayoutTemplate, 'Ten designs', 'Distinct layouts, not colour swaps, with full control of fonts, spacing and colour. Your last design becomes the default for new resumes.'],
            [ShieldCheck, 'Honest AI', 'AI suggests; it doesn’t invent. Rewrites keep your numbers, missing metrics become [X] placeholders, and every change is shown.'],
          ].map(([Icon, title, text], i) => (
            <div key={title} className={clsx('flex gap-4 border-b border-rule py-6', i % 2 === 0 ? 'md:pr-10' : 'md:border-l md:pl-10')}>
              <Icon size={20} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 leading-relaxed text-body">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <LocalSetup />

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-10 text-[13px] text-muted">
        <Mark size={20} /> <span className="display text-[17px] text-ink">{APP_NAME}</span>
        <span className="ml-auto">No accounts · no pricing · your files stay yours</span>
      </footer>
    </div>
  )
}

const STEPS = [
  ['Install and start', `${INSTALL_CMD}\n# gets the app and the AI server, installs both, starts them`],
  ['Open it', '# http://localhost:5190\n# editing, designs and the vault work straight away'],
  ['Connect your AI', '# Integrations page in the app: paste an OpenAI,\n# Anthropic or Gemini API key, test it, done'],
  ['Start again later', 'cd offerstack/app && npm run dev'],
]

function LocalSetup() {
  const server = useServerStatus()
  const [copied, setCopied] = useState(null)
  const copy = (i, text) => { navigator.clipboard?.writeText(text.split('\n').filter(l => !l.trim().startsWith('#')).map(l => l.replace(/\s+#.*$/, '')).join('\n')); setCopied(i); setTimeout(() => setCopied(null), 1500) }
  const ai = server === null ? ['Checking…', 'text-muted'] : server === false ? ['Not running: start it with npm run dev', 'text-red-600'] : server.mock ? ['Running in demo mode', 'text-amber-700'] : !server.connected ? ['Running · connect your AI on the Integrations page', 'text-amber-700'] : [`Running · ${server.label ?? server.provider} · ${server.model}`, 'text-emerald-700']

  return (
    <section id="local" className="bg-ink text-canvas">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="display text-[40px] leading-tight">Runs on your machine</h2>
          <p className="mt-4 leading-relaxed text-canvas/75">
            Two small parts: the app, which keeps your resumes in this browser’s storage, and a local AI server that holds your API key and talks to OpenAI, Anthropic or Gemini only when you ask it to.
          </p>
          <ul className="mt-6 space-y-2.5 text-[14px] text-canvas/85">
            {['No account, no cloud database, no tracking', 'Your API key stays on your computer', 'Export any resume as JSON or PDF, any time'].map(t => (
              <li key={t} className="flex items-center gap-2.5"><Check size={15} className="text-[#8fd1b0]" /> {t}</li>
            ))}
          </ul>
          <div className="mt-8 rounded-lg border border-white/10 p-4 text-[14px]">
            <p className="meta mb-2.5 uppercase tracking-[0.08em] text-canvas/50">This machine</p>
            <p className="flex items-center gap-2"><Circle size={9} className="fill-emerald-500 text-emerald-500" /> App: running</p>
            <p className="mt-1.5 flex items-center gap-2">
              <Circle size={9} className={server ? (server.mock || !server.connected ? 'fill-amber-500 text-amber-500' : 'fill-emerald-500 text-emerald-500') : server === false ? 'fill-red-500 text-red-500' : 'fill-slate-500 text-slate-500'} />
              AI server: <span className={clsx('text-canvas/85', server === false && 'text-[#f5a3a3]')}>{ai[0]}</span>
            </p>
          </div>
        </div>

        <ol className="space-y-4">
          {STEPS.map(([title, code], i) => (
            <li key={title} className="rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
                <span className="meta text-[#8fd1b0]">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[14px] font-medium">{title}</span>
                <button onClick={() => copy(i, code)} className="ml-auto flex items-center gap-1 text-[12px] text-canvas/60 hover:text-canvas">
                  {copied === i ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <pre className="meta overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed text-canvas/85">{code.split('\n').map((l, j) => <div key={j} className={l.trim().startsWith('#') ? 'text-canvas/40' : ''}>{l}</div>)}</pre>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
