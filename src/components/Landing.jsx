import { useState } from 'react'
import { ArrowRight, Upload, Check, Copy, Circle } from 'lucide-react'
import { Mark } from './TopBar'
import { useServerStatus } from '../lib/useServerStatus'
import { APP_NAME, REPOS, INSTALL_CMD } from '../config/app'

// The front page: a plain readme. What it is, what it does, how to run it.
export default function Landing({ onOpen, onImport }) {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="flex items-center gap-2.5">
          <Mark size={24} />
          <span className="display text-[22px] text-ink">{APP_NAME}</span>
          <a href={REPOS.app} target="_blank" rel="noreferrer" className="ml-auto text-[14px] text-muted hover:text-ink">GitHub</a>
        </header>

        <p className="mt-12 text-[21px] leading-relaxed text-ink">
          A small app I built to stop rewriting my resume for every job. It keeps every bullet I’ve written in one place, and when I paste a job description it puts together a resume for that job from them.
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-body">It’s free, open source, and runs on your laptop. Your resumes stay in your browser.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onOpen} className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-[15px] font-medium text-white hover:bg-brand-deep">
            Open my resumes <ArrowRight size={16} />
          </button>
          <button onClick={onImport} className="flex items-center gap-2 rounded-md border border-rule bg-white px-4 py-2.5 text-[15px] font-medium text-ink hover:border-ink/40">
            <Upload size={16} /> Import a resume
          </button>
        </div>

        <img src="/demo/tailor-journey.gif" alt="Pasting a job description, building a tailored resume from the vault, checking the match and picking a design" width="960" height="600" loading="lazy" className="mt-10 block h-auto w-full rounded-md border border-rule" />

        <h2 className="display mt-14 text-[24px] text-ink">What it does</h2>
        <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {FEATURES.map(([title, text]) => (
            <div key={title}>
              <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
              <p className="mt-1 leading-relaxed text-body">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="display mt-14 text-[24px] text-ink">Why it works this way</h2>
        <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {WHY.map(([title, text]) => (
            <div key={title}>
              <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
              <p className="mt-1 leading-relaxed text-body">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="display mt-14 text-[24px] text-ink">A look around</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {SCREENS.map(([file, caption]) => (
            <figure key={file}>
              <img src={`/screens/${file}`} alt={caption} loading="lazy" width="1920" height="1200" className="block h-auto w-full rounded-md border border-rule" />
              <figcaption className="mt-2 text-[14px] text-muted">{caption}</figcaption>
            </figure>
          ))}
        </div>

        <LocalSetup />

        <h2 className="display mt-14 text-[24px] text-ink">Questions</h2>
        <dl className="mt-4 space-y-5">
          {QUESTIONS.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold text-ink">{q}</dt>
              <dd className="mt-1 leading-relaxed text-body">{a}</dd>
            </div>
          ))}
        </dl>

        <footer className="mt-14 border-t border-rule pt-5 text-[13px] text-muted">
          Code on <a href={REPOS.app} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">GitHub</a>.
        </footer>
      </main>
    </div>
  )
}

const FEATURES = [
  ['One vault for all your bullets', 'Every bullet from every resume you make or import lands in one place, without duplicates. If you change a number in one version, that version is kept too. You can tag bullets, like leadership or cross-functional.'],
  ['Tailor to a job', 'Paste a job description and it builds a resume from your own bullets: the relevant roles and points, lightly reworded for the job, plus a title, summary and skills that fit. It isn’t allowed to make things up.'],
  ['A match score you can check', 'It shows which requirements your resume covers, which it only partly covers, and which are missing. The score is calculated from that, so the same resume and job always get the same score.'],
  ['Checks for weak bullets', 'Flags bullets with no numbers, weak verbs, first person or too many words, with quick fixes, and AI rewrites that keep your facts.'],
  ['Templates and PDFs', 'A handful of templates with fonts, colours and spacing you can change. Fit to one page, and a PDF in one click that looks exactly like the preview.'],
  ['Import what you have', 'Bring in a PDF or Word resume, or your LinkedIn profile, and it fills the vault from it.'],
]

const WHY = [
  ['Bring your own AI', 'Connect OpenAI, Anthropic or Gemini with your own key on the Integrations page, and pay them directly for what you use. AI is set up as an integration, so more providers and tools can plug in later without changing the app.'],
  ['Your resume stays with you', 'Everything is saved in your browser, on your laptop. No account, and nothing stored on anyone else’s server.'],
  ['One tool instead of three', 'No separate subscriptions for writing, designing and checking ATS scores, and no copying your resume between them.'],
  ['No chat, on purpose', 'There’s nothing to prompt. The AI works from the bullets you’ve already written and you accept or skip its suggestions, so it doesn’t make things up.'],
  ['No ChatGPT-to-editor shuffle', 'No polishing bullets in ChatGPT and then fixing the layout in another tool. Tailoring, rewriting and formatting happen in one place, which saves the hours I used to spend prompting.'],
  ['Designs that look like a resume', 'Proper resume templates you can tweak, instead of AI-generated layouts that don’t look like a CV.'],
]

const SCREENS = [
  ['vault.jpg', 'The vault: every bullet, scored and tagged'],
  ['tailor.jpg', 'Paste a job description to build a resume for it'],
  ['checks.jpg', 'Quality checks, with the issues to fix'],
  ['designs.jpg', 'Templates, fonts and spacing'],
]

const QUESTIONS = [
  ['Is it free?', 'Yes. It’s open source (AGPL). The only cost is the AI provider you choose, and only when you use the AI features.'],
  ['Where does my data go?', 'Your resumes stay in your browser’s storage on your laptop. When you use an AI feature, the text it needs goes to the AI provider you picked, with your own key. There’s no account and no server of mine involved.'],
  ['Do I need an AI key?', 'No. Editing, designs, the vault, quality checks and PDFs all work without one. You need a key (OpenAI, Anthropic or Gemini) only for tailoring to a job and AI rewrites.'],
  ['Will it make things up?', 'It’s built not to. It can only pick and lightly reword your own bullets, and every AI edit is checked: numbers must match, and most of your words must stay. If an edit fails, you get your original back.'],
]

const STEPS = [
  ['Install and start it', INSTALL_CMD],
  ['Open it', 'http://localhost:5190'],
  ['Turn on the AI bits', 'Integrations → paste an OpenAI, Anthropic or Gemini key'],
  ['Next time', 'cd refit/app && npm run dev'],
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
