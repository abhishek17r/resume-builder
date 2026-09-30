import { get, set, del } from 'idb-keyval'

// zustand `persist` storage backed by IndexedDB, which allows far more data than
// localStorage (~5 MB), so there's no practical cap on the number of resumes.
// Data saved by earlier builds in localStorage is moved over on first load.
//
// Several tabs can be open at once. Each save is announced to the other tabs (BroadcastChannel),
// which load it straight away, so no tab keeps an old copy that could later be saved over newer
// edits. Writes that wouldn't change anything are skipped.
export const LEGACY_KEY = 'resume-builder:v1'

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('offerstack-store') : null
const TAB = Math.random().toString(36).slice(2)
let lastSaved = null // JSON of what this tab last read or wrote

export const idbStorage = {
  getItem: async name => {
    let value = await get(name)
    if (value == null) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (!legacy) return null
      await set(name, legacy)
      localStorage.removeItem(LEGACY_KEY)
      value = legacy
    }
    lastSaved = JSON.stringify(value)
    return value
  },
  setItem: async (name, value) => {
    const json = JSON.stringify(value)
    if (json === lastSaved) return // nothing new to save
    lastSaved = json
    try {
      await set(name, value)
      saveListeners.forEach(fn => fn(null, Date.now()))
      channel?.postMessage({ from: TAB, name })
    } catch (err) {
      saveListeners.forEach(fn => fn(err))
    }
  },
  removeItem: name => del(name),
}

// Another tab saved: read what it saved. Marked as already-saved here, so applying it doesn't write it back.
export function onRemoteSave(fn) {
  if (!channel) return () => {}
  const handler = async e => {
    if (e.data?.from === TAB) return
    const value = await get(e.data.name)
    if (value == null) return
    lastSaved = JSON.stringify(value)
    // zustand's JSON storage keeps the saved state as a string.
    fn(typeof value === 'string' ? JSON.parse(value) : value)
  }
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}

const saveListeners = new Set()
// fn(error, savedAt): error is null on success.
export const onSaveResult = fn => { saveListeners.add(fn); return () => saveListeners.delete(fn) }
