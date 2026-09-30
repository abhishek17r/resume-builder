import { get, set, del, update } from 'idb-keyval'

// zustand `persist` storage backed by IndexedDB, which allows far more data than
// localStorage (~5 MB), so there's no practical cap on the number of resumes.
// Data saved by earlier builds in localStorage is moved over on first load.
//
// Guarding against lost edits:
// - Nothing is written until the saved data has been read, so a fresh (sample) state can never be
//   saved over your resumes while the app is starting.
// - Saves happen one at a time, and only the newest pending state is written.
// - Each write is an atomic check-and-write: if another tab changed the stored copy since this tab last
//   read it, nothing is overwritten. This tab loads the other tab's copy merged with its own edits,
//   resume by resume (each side keeps what it changed), and saves that instead.
// - Each save is announced to the other tabs (BroadcastChannel), which load it straight away.
// - A rolling set of backups is kept (see listBackups / restoreBackup).
export const LEGACY_KEY = 'resume-builder:v1'
const BACKUP_SUFFIX = ':backups'
const BACKUP_EVERY = 10 * 60_000
const BACKUP_MAX = 20

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('offerstack-store') : null
const TAB = Math.random().toString(36).slice(2)
const loaded = new Set() // names read at least once in this tab
const lastSaved = new Map() // name → the stored string this tab last read or wrote
const pending = new Map() // name → newest string waiting to be written
const writing = new Set()

export const idbStorage = {
  getItem: async name => {
    let value = await get(name)
    if (value == null) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        await set(name, legacy)
        localStorage.removeItem(LEGACY_KEY)
        value = legacy
      }
    }
    lastSaved.set(name, value ?? null)
    loaded.add(name)
    return value ?? null
  },
  setItem: (name, value) => {
    if (!loaded.has(name)) return // still starting: never save over data we haven't read
    pending.set(name, value)
    if (!writing.has(name)) flush(name)
  },
  removeItem: name => del(name),
}

async function flush(name) {
  writing.add(name)
  try {
    while (pending.has(name)) {
      let conflict = null
      let wrote = null
      try {
        await update(name, stored => {
          stored ??= null
          const base = lastSaved.get(name)
          if (stored !== base && stored != null) { conflict = { theirs: stored, base }; return stored } // someone else saved: don't overwrite
          const value = pending.get(name) // the newest state, taken inside the transaction
          pending.delete(name)
          if (value === stored) return stored
          wrote = value
          return value
        })
      } catch (err) {
        saveListeners.forEach(fn => fn(err))
        break
      }
      if (conflict) {
        lastSaved.set(name, conflict.theirs)
        // The store merges their copy with its current state and saves the result (next time round).
        remoteListeners.forEach(fn => fn(conflict.theirs, conflict.base))
        continue
      }
      if (wrote != null) {
        lastSaved.set(name, wrote)
        saveListeners.forEach(fn => fn(null, Date.now()))
        channel?.postMessage({ from: TAB, name })
        backup(name, wrote)
      }
    }
  } finally {
    writing.delete(name)
  }
}

// Three-way merge of the saved app state ({ state: { resumes, vault, designDefaults }, version }).
// Resumes: each side keeps the resumes it changed, added or deleted; the rest come from the stored copy.
// Vault and design defaults: ours if we changed them, otherwise theirs.
export function merge(baseStr, oursStr, theirsStr) {
  const [base, ours, theirs] = [baseStr, oursStr, theirsStr].map(s => JSON.parse(s))
  const b = base.state ?? {}, o = ours.state ?? {}, t = theirs.state ?? {}
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
  const byId = list => new Map((list ?? []).map(r => [r.id, r]))
  const [bR, oR, tR] = [byId(b.resumes), byId(o.resumes), byId(t.resumes)]
  const out = new Map(tR)
  for (const [id, r] of oR) if (!same(r, bR.get(id))) out.set(id, r) // changed or added by us
  for (const [id, r] of bR) if (!oR.has(id) && same(tR.get(id), r)) out.delete(id) // deleted by us, untouched by them
  // Keep our order, then anything only they have.
  const order = [...oR.keys(), ...tR.keys()].filter((id, i, a) => a.indexOf(id) === i && out.has(id))
  const pick = key => (same(o[key], b[key]) ? t[key] : o[key])
  return JSON.stringify({ ...ours, state: { ...o, resumes: order.map(id => out.get(id)), vault: pick('vault'), designDefaults: pick('designDefaults') } })
}

// ----- other tabs -----
const remoteListeners = new Set()
// fn(theirs, base) whenever what's stored changed under this tab: `theirs` is the stored JSON string,
// `base` the one this tab last knew (null when there's nothing to merge with, e.g. a restored backup).
// The listener merges theirs with its current state (see merge) so no local edit is lost.
export function onRemoteSave(fn) {
  remoteListeners.add(fn)
  return () => remoteListeners.delete(fn)
}
channel?.addEventListener('message', async e => {
  if (e.data?.from === TAB) return
  const { name } = e.data
  const value = await get(name)
  const base = lastSaved.get(name)
  if (value == null || value === base) return
  lastSaved.set(name, value)
  remoteListeners.forEach(fn => fn(value, base))
})

// ----- save status -----
const saveListeners = new Set()
// fn(error, savedAt): error is null on success.
export const onSaveResult = fn => { saveListeners.add(fn); return () => saveListeners.delete(fn) }

// ----- backups: a copy every 10 minutes of editing, the last 20 kept -----
let lastBackupAt = 0
async function backup(name, value) {
  if (Date.now() - lastBackupAt < BACKUP_EVERY) return
  lastBackupAt = Date.now()
  try {
    const list = (await get(name + BACKUP_SUFFIX)) ?? []
    if (list[0]?.value === value) return
    await set(name + BACKUP_SUFFIX, [{ at: Date.now(), value }, ...list].slice(0, BACKUP_MAX))
  } catch { /* backups are best effort */ }
}

/** → [{ at, resumes: [{ id, name }], value }] newest first. */
export async function listBackups(name) {
  const list = (await get(name + BACKUP_SUFFIX)) ?? []
  return list.map(b => {
    let resumes = []
    try { resumes = (JSON.parse(b.value).state?.resumes ?? []).map(r => ({ id: r.id, name: r.name })) } catch { /* unreadable */ }
    return { ...b, resumes }
  })
}

/** Put a backup back (the current state is backed up first, so this can be undone). */
export async function restoreBackup(name, at) {
  const list = (await get(name + BACKUP_SUFFIX)) ?? []
  const pick = list.find(b => b.at === at)
  if (!pick) throw new Error('That backup no longer exists.')
  const now = await get(name)
  if (now != null) await set(name + BACKUP_SUFFIX, [{ at: Date.now(), value: now }, ...list].slice(0, BACKUP_MAX))
  await set(name, pick.value)
  lastSaved.set(name, pick.value)
  channel?.postMessage({ from: TAB, name })
  remoteListeners.forEach(fn => fn(pick.value, null))
}
