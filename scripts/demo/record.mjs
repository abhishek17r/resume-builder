// Records the "Tailor to a job" journey for the landing page GIF, in headless Chrome via the
// DevTools protocol (no extra packages). Needs the app on :5190 and the AI server on :8787.
// Uses a fresh browser profile, so it shows the built-in John Doe sample, never your data.
// Writes <work dir>/frames/NNN.png and frames.json; then make_gif.py builds the GIF.
// Usage: npm run demo:gif
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const OUT = process.env.DEMO_WORK ?? join(tmpdir(), 'resume-demo')
mkdirSync(OUT, { recursive: true })
const FRAMES = join(OUT, 'frames')
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const PROFILE = join(OUT, 'profile')
rmSync(PROFILE, { recursive: true, force: true })

const PORT = 9333
const APP = 'http://localhost:5190'
const W = 1280
const H = 800

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))

let ws, id = 0
const pending = new Map()
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find(t => t.type === 'page')
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
    } catch { /* not up yet */ }
    await sleep(200)
  }
  await new Promise(r => ws.addEventListener('open', r))
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
}
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}

const frames = []
let caption = ''
async function shot(ms) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const file = `${String(frames.length).padStart(3, '0')}.png`
  writeFileSync(join(FRAMES, file), Buffer.from(r.result.data, 'base64'))
  frames.push({ file, ms, caption })
}

const JD = `Senior Software Engineer, Payments Infrastructure — Example Fintech
You will design and scale the event pipelines that move money for millions of merchants.
Requirements:
- 6+ years building distributed backend systems in Go or Java
- Hands-on experience with Kafka or other event streaming platforms
- Deep PostgreSQL knowledge, including performance tuning
- Track record of reducing infrastructure cost on AWS
- Experience mentoring engineers
Nice to have: payments or ledger domain experience, technical writing.`

const helpers = `
  const $ = s => document.querySelector(s)
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find(el => re.test(el.textContent.trim()))
  const setText = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const pane = () => document.getElementById('editor-pane');
`

try {
  await connect()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })

  // Start on Resumes with the sidebar visible.
  await send('Page.navigate', { url: `${APP}/#overview` })
  await sleep(3500)
  caption = 'Start from your resumes'
  await shot(1400)

  // 1. Tailor to a job
  await js(`${helpers} byText('aside button', /^Tailor to a job$/).click()`)
  await sleep(900)
  caption = '1 · Paste a job description'
  await shot(1100)
  const chunks = 5
  for (let i = 1; i <= chunks; i++) {
    const part = JD.slice(0, Math.round((JD.length * i) / chunks))
    await js(`${helpers} setText($('form textarea'), ${JSON.stringify(part)})`)
    await sleep(120)
    await shot(i === chunks ? 1300 : 260)
  }

  // 2. Build: vault sync, job analysis, picking, tailoring, scoring
  // Demo mode answers instantly; pace AI calls in this recording so each build step is visible.
  await js(`const f = window.fetch; window.fetch = async (u, o) => { if (String(u).includes('/api/')) await new Promise(r => setTimeout(r, 1100)); return f(u, o) }`)
  await js(`${helpers} byText('button', /^Build for this job$/).click()`)
  caption = '2 · Built from your vault, tailored to the job'
  let last = ''
  const t0 = Date.now()
  while (Date.now() - t0 < 120000) {
    await sleep(400)
    const state = await js(`return location.hash + '|' + (document.querySelector('form ol')?.innerText ?? '') + '|' + (document.querySelector('form .bg-red-50')?.innerText ?? '')`)
    if (state.startsWith('#optimize')) break
    if (/\|[^|]+$/.test(state) && !state.endsWith('|')) { console.log('build error'); break }
    if (state !== last) {
      last = state
      await js(`document.querySelector('form ol')?.scrollIntoView({ block: 'center' })`)
      await sleep(150)
      await shot(900)
    }
  }
  await sleep(2500)

  // 3. Optimize: match score and what changed
  caption = '3 · See the match, piece by piece'
  await js(`${helpers} pane().scrollTo(0, 0)`)
  await sleep(600)
  await shot(1800)
  await js(`${helpers} const c = [...document.querySelectorAll('.card')].find(c => /Requirements/.test(c.innerText) && /Keywords/.test(c.innerText)); pane().scrollTo({ top: c.offsetTop - 24 })`)
  await sleep(700)
  await shot(2600)
  caption = '3 · Every tailored line, before and after'
  // Only when something was tailored (demo mode, with no API key, rewords nothing).
  const tailored = await js(`${helpers} pane().scrollTo(0, 0); const b = byText('button', /Show what was tailored/); b?.click(); return !!b`)
  if (tailored) {
    await sleep(700)
    await shot(2600)
  }

  // 4. Design: switch template
  caption = '4 · Pick a design'
  await js(`${helpers} byText('header nav button', /^Design$/).click()`)
  await sleep(1200)
  await sleep(1800) // templates are in the Style strip at the top of the Design tab
  await shot(1300)
  for (const name of ['Current', 'Harbor']) {
    await js(`${helpers} [...document.querySelectorAll('#editor-pane button')].find(b => b.innerText.split('\\n').map(x => x.trim()).includes(${JSON.stringify(name)}))?.click()`)
    await sleep(1400)
    await shot(1500)
  }

  // 5. Done: the finished resume
  caption = '5 · Download the PDF'
  await js(`${helpers} byText('header nav button', /^Content$/).click()`)
  await sleep(1200)
  await shot(2400)

  writeFileSync(join(OUT, 'frames.json'), JSON.stringify(frames, null, 1))
  console.log(`${frames.length} frames`)
} catch (e) {
  console.error('Recording failed:', e.message)
  process.exitCode = 1 // so the GIF isn't rebuilt from a partial recording
} finally {
  ws?.close()
  chrome.kill()
}
