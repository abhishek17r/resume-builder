import { get, set, del } from 'idb-keyval'

// zustand `persist` storage backed by IndexedDB, which allows far more data than
// localStorage (~5 MB), so there's no practical cap on the number of resumes.
// Data saved by earlier builds in localStorage is moved over on first load.
export const LEGACY_KEY = 'resume-builder:v1'

export const idbStorage = {
  getItem: async name => {
    const value = await get(name)
    if (value != null) return value
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return null
    await set(name, legacy)
    localStorage.removeItem(LEGACY_KEY)
    return legacy
  },
  setItem: async (name, value) => {
    try {
      await set(name, value)
      saveListeners.forEach(fn => fn(null))
    } catch (err) {
      saveListeners.forEach(fn => fn(err))
    }
  },
  removeItem: name => del(name),
}

const saveListeners = new Set()
export const onSaveResult = fn => { saveListeners.add(fn); return () => saveListeners.delete(fn) }
