import { useEffect, useState } from 'react'
import { health } from './api'

// The local AI server: null while checking, false when offline, else { mock, provider, model }.
// Shared across components; re-checked at most every 30 seconds.
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

export function useServerStatus() {
  const [status, setStatus] = useState(cached)
  useEffect(() => {
    listeners.add(setStatus)
    if (cached === null || Date.now() - checkedAt > 30000) check()
    return () => listeners.delete(setStatus)
  }, [])
  return status
}
