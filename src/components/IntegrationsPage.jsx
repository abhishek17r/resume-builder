import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown, ExternalLink, KeyRound, Loader2, AlertCircle, ShieldCheck, Trash2, Zap, Circle } from 'lucide-react'
import { request } from '../lib/api'
import { refreshServerStatus } from '../lib/useServerStatus'
import { PageHeader, Button } from './Overview'

// Bring your own AI: every AI feature in Offerstack goes through the provider connected here (OpenAI,
// Anthropic or Gemini, with your own API key). Keys go to the local AI server on this computer and are
// never stored in the browser or shown again. More providers are listed as coming soon.
export default function IntegrationsPage() {
  const [data, setData] = useState(null) // { integrations, current } | { offline, error }
  const [open, setOpen] = useState(null)

  const load = async () => {
    try { setData(await request('GET', '/api/integrations')) } catch (e) { setData({ offline: true, error: e.message }) }
  }
  useEffect(() => { load() }, [])
  const apply = next => { setData(next); refreshServerStatus() }

  if (!data) return <div className="mx-auto max-w-4xl px-6 py-10 text-muted">Loading…</div>

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 pb-28">
      <PageHeader title="Integrations" sub="Bring your own AI. Every AI feature in Offerstack uses the provider you connect here." />

      {data.offline ? (
        <div className="card flex gap-3 p-5 text-[14px]">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-ink">The Offerstack AI server isn’t running</p>
            <p className="mt-1 text-muted">Integrations are saved by the local AI server. Start it with <code className="meta rounded bg-field px-1.5 py-0.5 text-ink">npm run dev</code> in the app folder, then reload this page.</p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="display mb-3 text-[26px] text-ink">AI API key</h2>
          <InUse current={data.current} onDisconnect={async () => apply(await request('POST', '/api/integrations/active', { id: null }))} />
          <div className="card mt-3 divide-y divide-rule">
            {data.integrations.filter(i => !i.soon).map(i => (
              <Provider key={i.id} it={i} open={open === i.id} onToggle={() => setOpen(o => (o === i.id ? null : i.id))} onChange={apply} />
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>Keys are saved by your local AI server in <code className="meta">api/.data/integrations.json</code> on this computer (readable only by your user account). They are never stored in the browser, shown again, or sent anywhere except to the provider you choose.</span>
          </p>

          <h2 className="display mb-3 mt-10 text-[26px] text-ink">Chat with Claude</h2>
          <ClaudeMcp />

          <h2 className="display mb-3 mt-10 text-[26px] text-ink">Coming soon</h2>
          <div className="card divide-y divide-rule text-[14px]">
            {[
              ...data.integrations.filter(i => i.soon).map(i => [i.label, i.blurb]),
              ['Job boards', 'Save job descriptions from LinkedIn and other boards in one click.'],
            ].map(([name, text]) => (
              <div key={name} className="flex items-center gap-3 px-5 py-4">
                <Circle size={8} className="shrink-0 fill-rule text-rule" />
                <span className="font-medium text-ink">{name}</span>
                <span className="text-muted">{text}</span>
                <span className="meta ml-auto shrink-0 text-muted">soon</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Claude through MCP: chat in Claude (Desktop or Code) and push bullets into Offerstack while it's open.
function ClaudeMcp() {
  const [info, setInfo] = useState(null)
  const [copied, setCopied] = useState(null)
  useEffect(() => {
    const load = () => request('GET', '/api/bridge/info').then(setInfo, () => setInfo(false))
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])
  if (!info) return null
  const code = `claude mcp add offerstack -- node "${info.mcpServerPath}"`
  const desktop = JSON.stringify({ mcpServers: { offerstack: { command: info.node, args: [info.mcpServerPath] } } }, null, 2)
  const copy = (what, text) => navigator.clipboard.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1500) })
  const Snippet = ({ id, text }) => (
    <div className="flex items-start gap-2">
      <pre className="meta min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-md bg-ink px-3 py-2.5 text-[12.5px] leading-relaxed text-white">{text}</pre>
      <button onClick={() => copy(id, text)} className="shrink-0 rounded-md border border-rule bg-white px-3 py-2 text-[13px] font-medium text-ink hover:border-ink/40">{copied === id ? 'Copied' : 'Copy'}</button>
    </div>
  )
  return (
    <div className="card space-y-4 p-5 text-[14px]">
      <div className="flex items-start gap-3">
        <span className={clsx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', info.appConnected ? 'bg-emerald-600' : 'bg-amber-500')} />
        <div>
          <p className="font-medium text-ink">{info.appConnected ? 'Ready: Claude can read and edit your resumes while Offerstack is open' : 'Open Offerstack in a browser tab so Claude can reach it'}</p>
          <p className="mt-1 text-muted">Ask Claude to read your resumes and vault, sharpen bullets with you, and push the ones you like straight into Offerstack. Changes show up here live, and you can undo them.</p>
        </div>
      </div>
      <div>
        <p className="label">Claude Code</p>
        <Snippet id="code" text={code} />
      </div>
      <div>
        <p className="label">Claude Desktop</p>
        <p className="mb-2 text-[13px] text-muted">Settings → Developer → Edit Config, add this to <code className="meta">claude_desktop_config.json</code>, then restart Claude.</p>
        <Snippet id="desktop" text={desktop} />
      </div>
      <div className="rounded-md bg-soft px-4 py-3 text-[13px] text-body">
        <p className="font-medium text-ink">Try asking</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>“Read my vault and help me write three stronger bullets about my pricing work at Acme. Add the ones I approve.”</li>
          <li>“Here's a JD. Which bullets from my vault fit it best? Put the top four into my PM resume.”</li>
          <li>“Rewrite the summary of my open resume for a platform PM role.”</li>
        </ul>
      </div>
      <p className="flex items-start gap-2 text-[13px] text-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand" />
        <span>Only Claude on this computer can connect. What it reads from Offerstack becomes part of your Claude conversation, like anything else you share there.</span>
      </p>
    </div>
  )
}

function InUse({ current, onDisconnect }) {
  const tone = current.connected ? 'bg-emerald-600' : current.mock ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <span className={clsx('h-2.5 w-2.5 rounded-full', tone)} />
      <div className="min-w-0 flex-1">
        <p className="meta uppercase tracking-[0.08em] text-muted">In use</p>
        {current.connected ? (
          <>
            <p className="text-[16px] font-medium text-ink">{current.label} <span className="meta font-normal text-muted">· {current.model}</span></p>
            <p className="text-[13px] text-muted">All AI features (tailoring, job match, rewrites, tags) use this provider.</p>
          </>
        ) : current.mock ? (
          <>
            <p className="text-[16px] font-medium text-ink">Demo mode</p>
            <p className="text-[13px] text-muted">The AI server was started in demo mode, so AI features use simple keyword rules.</p>
          </>
        ) : (
          <>
            <p className="text-[16px] font-medium text-ink">Not connected</p>
            <p className="text-[13px] text-muted">AI features are off. Add a key for OpenAI, Anthropic or Gemini below, test it, and choose it.</p>
          </>
        )}
      </div>
      {current.connected && <Button onClick={onDisconnect} title="Stop using this provider (its key stays saved)">Disconnect</Button>}
    </div>
  )
}

function Provider({ it, open, onToggle, onChange }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(it.model || it.models[0] || '')
  const [busy, setBusy] = useState(null) // 'save' | 'test' | 'active' | 'remove'
  const [result, setResult] = useState(null) // { ok, latencyMs, error, models }
  const [error, setError] = useState(null)
  const models = [...new Set([...(result?.models ?? []), ...it.models])]

  const act = async (kind, fn) => {
    setBusy(kind); setError(null)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(null) }
  }
  const save = () => request('PUT', `/api/integrations/${it.id}`, { ...(apiKey ? { apiKey } : {}), model }).then(d => { onChange(d); setApiKey('') })
  const test = async () => {
    setResult(null)
    await save()
    setResult(await request('POST', `/api/integrations/${it.id}/test`))
  }

  const status = it.active ? ['Active', 'bg-emerald-50 text-emerald-800 ring-emerald-200'] : it.configured ? ['Set up', 'bg-field text-body ring-rule'] : null

  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-soft">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-rule bg-white text-[13px] font-semibold text-ink">{it.label.slice(0, 2)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-ink">
            {it.label}
            {status && <span className={clsx('meta rounded-sm px-1.5 py-0.5 ring-1', status[1])}>{status[0]}</span>}
          </p>
          <p className="truncate text-[13px] text-muted">{it.configured ? [it.model, it.keyHint].filter(Boolean).join(' · ') || it.blurb : it.blurb}</p>
        </div>
        <span className="text-[13px] text-muted">{it.configured ? 'Edit' : 'Set up'}</span>
        <ChevronDown size={16} className={clsx('text-muted transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-rule bg-soft/60 px-5 py-5">
          {it.needsKey && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">API key
                {it.keyUrl && <a href={it.keyUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 normal-case tracking-normal text-brand hover:underline">Get a key <ExternalLink size={11} /></a>}
              </span>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder={it.hasKey ? `Saved (${it.keyHint}). Paste a new key to replace it` : 'Paste your API key'} className="field pl-9 font-mono text-[13px]" />
              </div>
            </label>
          )}
          <label className="block">
            <span className="label">Model</span>
            <input list={`models-${it.id}`} value={model} onChange={e => setModel(e.target.value)} placeholder={models.length ? 'Choose or type a model' : 'Model name, e.g. from the provider’s docs'} className="field font-mono text-[13px]" />
            <datalist id={`models-${it.id}`}>{models.map(m => <option key={m} value={m} />)}</datalist>
            {result?.models?.length > 0 && <span className="mt-1 block text-[12px] text-muted">{result.models.length} models available from this provider.</span>}
          </label>

          {result && (
            <p className={clsx('flex items-start gap-2 rounded-md px-3 py-2 text-[13px]', result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
              {result.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {result.ok ? `Connected: ${result.model} answered in ${(result.latencyMs / 1000).toFixed(1)}s.` : result.error}
            </p>
          )}
          {error && <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => act('test', test)} disabled={!!busy} icon={busy === 'test' ? Loader2 : Zap}>{busy === 'test' ? 'Testing…' : 'Save & test'}</Button>
            <Button onClick={() => act('save', save)} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
            {it.configured && !it.active && (
              <Button primary onClick={() => act('active', async () => onChange(await request('POST', '/api/integrations/active', { id: it.id })))} disabled={!!busy} icon={Check}>Use this provider</Button>
            )}
            {it.configured && (
              <button onClick={() => confirm(`Remove ${it.label} and its saved key?`) && act('remove', async () => { onChange(await request('DELETE', `/api/integrations/${it.id}`)); setResult(null) })}
                disabled={!!busy} className="ml-auto flex items-center gap-1.5 text-[13px] text-muted hover:text-red-600"><Trash2 size={14} /> Remove</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
