import { useServerStatus } from './useServerStatus'

// Is AI usable right now? One answer for every AI feature.
//   checking      — asking the local AI server
//   offline       — the AI server isn't running
//   disconnected  — the server runs, but no provider is connected on the Integrations page
//   demo          — the server was started in demo mode (MOCK=1; keyword heuristics)
//   ready         — a provider is connected
export function useAi() {
  const s = useServerStatus()
  if (s === null) return { state: 'checking', ready: false }
  if (s === false) return { state: 'offline', ready: false }
  if (s.mock) return { state: 'demo', ready: true }
  if (!s.connected) return { state: 'disconnected', ready: false }
  return { state: 'ready', ready: true, label: s.label, model: s.model }
}
