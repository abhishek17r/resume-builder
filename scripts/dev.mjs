// `npm run dev`: start the app, and the AI server too if it sits next to this folder and isn't already running.
// Output from each is prefixed; Ctrl+C stops both. Use `npm run dev:app` for the app alone.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const API_DIRS = ['../refit-api', '../api', '../resume-builder-api'].map(d => resolve(ROOT, d))
const API_PORT = Number(process.env.API_PORT || 8787)

const children = []
function run(name, color, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env, shell: process.platform === 'win32' })
  const tag = `\x1b[${color}m${name.padEnd(4)}\x1b[0m │ `
  const pipe = stream => {
    let rest = ''
    stream.on('data', chunk => {
      const lines = (rest + chunk).split('\n')
      rest = lines.pop()
      for (const line of lines) process.stdout.write(tag + line + '\n')
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', code => {
    process.stdout.write(`${tag}exited (${code ?? 'signal'})\n`)
    if (name === 'app') shutdown(code ?? 0)
  })
  children.push(child)
}

function shutdown(code = 0) {
  for (const c of children) if (!c.killed) c.kill('SIGTERM')
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function apiRunning() {
  try { return (await fetch(`http://localhost:${API_PORT}/health`, { signal: AbortSignal.timeout(800) })).ok } catch { return false }
}

const apiDir = API_DIRS.find(d => existsSync(join(d, 'package.json')))
if (await apiRunning()) {
  console.log(`AI server already running on :${API_PORT}`)
} else if (apiDir) {
  if (!existsSync(join(apiDir, 'node_modules'))) console.log(`Tip: run npm install in ${apiDir} first.`)
  run('api', '35', 'npm', ['run', 'dev'], apiDir)
} else {
  console.log('AI server not found next to this folder; AI features will be offline. See README → Install.')
}
run('app', '36', 'npx', ['vite', '--port', '5190', '--strictPort'], ROOT)
