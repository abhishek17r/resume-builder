import { useState } from 'react'
import { ArrowRight, Upload, Check, Copy, Circle } from 'lucide-react'
import { Mark } from './TopBar'
import { useServerStatus } from '../lib/useServerStatus'
import { APP_NAME, REPOS, INSTALL_CMD } from '../config/app'

// The front page: a plain readme. What it is, what it does, how to run it.
export default function Landing({ onOpen, onImport }) {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <header className="flex items-center gap-2.5">
          <Mark size={24} />
          <span className="display text-[20px] text-ink">{APP_NAME}</span>
          <a href={REPOS.app} target="_blank" rel="noreferrer" className="ml-auto text-[14px] text-muted hover:text-ink">GitHub</a>
        </header>

        <p className="mt-10 text-[18px] leading-relaxed text-ink">
          A small app I built to stop rewriting my resume for every job. It keeps every bullet I’ve written in one place, and when I paste a job description it puts together a resume for that job from them.
        </p>
        <p className="mt-3 leading-relaxed text-body">It’s free, open source, and runs on your laptop. Your resumes stay in your browser.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onOpen} className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-[15px] font-medium text-white hover:bg-brand-deep">
            Open my resumes <ArrowRight size={16} />
          </button>
          <button onClick={onImport} className="flex items-center gap-2 rounded-md border border-rule bg-white px-4 py-2.5 text-[15px] font-medium text-ink hover:border-ink/40">
            <Upload size={16} /> Import a resume
          </button>
        </div>

        <img src="/demo/tailor-journey.gif" alt="Pasting a job description, building a tailored resume from the vault, checking the match and picking a design" width="960" height="600" loading="lazy" className="mt-10 block h-auto w-full rounded-md border border-rule" />

        <h2 className="display mt-12 text-[22px] text-ink">What it does</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-body">
          <li>Keeps all your bullets from all your resumes in one vault, without duplicates. You can tag them too.</li>
          <li>Paste a job description and it builds a resume from your own bullets, picking the relevant ones and rewording them a little for the job. It won’t make things up.</li>
          <li>Shows how well a resume matches the job, and which requirements are missing.</li>
          <li>Points out weak bullets, like ones with no numbers, and suggests fixes.</li>
          <li>Has a handful of templates, and downloads a PDF in one click.</li>
        </ul>

        <LocalSetup />

        <footer className="mt-14 border-t border-rule pt-5 text-[13px] text-muted">
          A weekend project by Abhishek. Code on <a href={REPOS.app} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">GitHub</a>.
        </footer>
      </main>
    </div>
  )
}

const STEPS = [
  ['Install and start it', INSTALL_CMD],
  ['Open it', 'http://localhost:5190'],
  ['Turn on the AI bits', 'Integrations → paste an OpenAI, Anthropic or Gemini key'],
  ['Next time', 'cd resume-tool/app && npm run dev'],
]

function LocalSetup() {
  const server = useServerStatus()
  const [copied, setCopied] = useState(null)
  const copy = (i, text) => { navigator.clipboard?.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1500) }
  const ai = server === null ? 'checking…' : server === false ? 'not running (start it with npm run dev)' : server.mock ? 'running in demo mode' : !server.connected ? 'running, no AI key connected yet' : `running, using ${server.label ?? server.provider}`

  return (
    <section id="local">
      <h2 className="display mt-12 text-[22px] text-ink">Running it</h2>
      <p className="mt-3 leading-relaxed text-body">You need Node.js 22+, git, and Chrome (or Edge or Brave) for PDFs.</p>
      <ol className="mt-4 space-y-3">
        {STEPS.map(([title, code], i) => (
          <li key={title}>
            <p className="text-[14px] font-medium text-ink">{i + 1}. {title}</p>
            <div className="mt-1.5 flex items-start gap-2">
              <pre className="meta min-w-0 flex-1 overflow-x-auto rounded-md bg-ink px-3 py-2 text-[12.5px] text-white">{code}</pre>
              {i !== 2 && (
                <button onClick={() => copy(i, code)} className="flex shrink-0 items-center gap-1 rounded-md border border-rule bg-white px-2.5 py-1.5 text-[12.5px] text-ink hover:border-ink/40">
                  {copied === i ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
        <Circle size={8} className={server && server.connected ? 'fill-emerald-500 text-emerald-500' : server === false ? 'fill-red-500 text-red-500' : 'fill-amber-500 text-amber-500'} />
        Local server: {ai}
      </p>
    </section>
  )
}
