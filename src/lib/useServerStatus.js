import { useEffect, useState } from 'react'
import { health } from './api'

// The local AI server: null while checking, false when offline, else { mock, connected, provider, model, label, pdf }.
// Shared across components; re-checked when a component mounts or the tab comes back into view
// (at most every 30 seconds), and right away after a change on the Integrations page.
let cached = null
let checkedAt = 0
let inflight = null
const listeners = new Set()

async function check() {
  if (inflight) return inflight
  inflight = health().then(h => {
    cached = h ?? false
    checkedAt = Date.now()
    inflight = null
    listeners.forEach(fn => fn(cached))
    return cached
  })
  return inflight
}

// Re-check now (e.g. after switching AI provider on the Integrations page).
export const refreshServerStatus = () => { checkedAt = 0; inflight = null; return check() }

export function useServerStatus() {
  const [status, setStatus] = useState(cached)
  useEffect(() => {
    listeners.add(setStatus)
    const stale = () => cached === null || Date.now() - checkedAt > 30000
    if (stale()) check()
    const onVisible = () => { if (document.visibilityState === 'visible' && stale()) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { listeners.delete(setStatus); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return status
}
