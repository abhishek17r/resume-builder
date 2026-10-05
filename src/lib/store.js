import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { sampleResume, blankResume, uid, blankEntry, DEFAULT_SETTINGS } from './defaults'
import { idbStorage, onRemoteSave, merge } from './storage'
import { SECTION_TYPES } from './sections'
import { applyEditTo } from './optimize/apply'
import { emptyVault, syncVault, dismissKey, ruleTags, fingerprint, norm, vaultTags, tagKeywords } from './vault/sync'
import { TAG_COLORS } from '../config/taxonomy'
import { defaultDesign } from './templates'

const HISTORY_LIMIT = 100
const COALESCE_MS = 600

// Every edit goes through `mutate`, which snapshots the current resume for undo.
// Consecutive edits with the same `key` inside COALESCE_MS collapse into one step
// so typing a word doesn't create one undo step per character.
// What's saved (shared by every tab).
const persisted = s => ({ resumes: s.resumes, vault: s.vault, designDefaults: s.designDefaults })

export const useStore = create(
  persist(
    (set, get) => {
      const first = sampleResume()

      const mutate = (fn, key) => set(state => {
        const idx = state.resumes.findIndex(r => r.id === state.currentId)
        if (idx < 0) return state
        const before = state.resumes[idx]
        const draft = structuredClone(before)
        fn(draft)
        draft.updatedAt = Date.now()
        const resumes = state.resumes.slice()
        resumes[idx] = draft
        const now = Date.now()
        const coalesce = key && state._lastKey === key && now - state._lastAt < COALESCE_MS
        const past = coalesce ? state.past : [...state.past, before].slice(-HISTORY_LIMIT)
        return { resumes, past, future: [], _lastKey: key, _lastAt: now }
      })

      const section = (r, id) => r.sections.find(s => s.id === id)

      // The design for new resumes: whatever was last set in Customize, or Scholar until then.
      const newDesign = () => {
        const d = get().designDefaults ?? defaultDesign()
        return { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(d), applyAccent: { ...DEFAULT_SETTINGS.applyAccent, ...d.applyAccent } }
      }
      // A settings change also becomes the design for the next new resume.
      const mutateSettings = (fn, key) => {
        mutate(fn, key)
        const r = get().current()
        if (r) set({ designDefaults: structuredClone(r.settings) })
      }

      first.settings = { ...first.settings, ...defaultDesign() }

      return {
        resumes: [first],
        designDefaults: null,
        newDesign,
        currentId: first.id,
        past: [],
        future: [],
        _lastKey: null,
        _lastAt: 0,

        current: () => get().resumes.find(r => r.id === get().currentId) ?? get().resumes[0],

        // ----- history -----
        undo: () => set(state => {
          if (!state.past.length) return state
          const prev = state.past[state.past.length - 1]
          const cur = state.resumes.find(r => r.id === prev.id)
          return {
            past: state.past.slice(0, -1),
            future: [cur, ...state.future],
            resumes: state.resumes.map(r => (r.id === prev.id ? prev : r)),
            _lastKey: null,
          }
        }),
        redo: () => set(state => {
          if (!state.future.length) return state
          const next = state.future[0]
          const cur = state.resumes.find(r => r.id === next.id)
          return {
            future: state.future.slice(1),
            past: [...state.past, cur],
            resumes: state.resumes.map(r => (r.id === next.id ? next : r)),
            _lastKey: null,
          }
        }),

        // ----- resumes -----
        selectResume: id => set({ currentId: id, past: [], future: [] }),
        // from: 'blank' | 'sample' | 'current' (a new version copied from the open resume)
        // from: 'blank' | 'sample' | 'current' | 'copy' (with sourceId: copy any resume as a new version)
        createResume: ({ from = 'blank', name, label, sourceId } = {}) => {
          const state = get()
          let r
          const source = from === 'copy' ? state.resumes.find(x => x.id === sourceId) : from === 'current' ? state.current() : null
          if (source) {
            const src = source
            r = { ...structuredClone(src), id: uid(), name: name || nextVersionName(src.name, state.resumes), updatedAt: Date.now() }
          } else {
            r = from === 'sample' ? sampleResume() : blankResume()
            r.name = name || `Resume ${state.resumes.length + 1}`
            r.settings = newDesign()
          }
          if (label !== undefined) r.label = label
          set({ resumes: [...state.resumes, r], currentId: r.id, past: [], future: [] })
          return r.id
        },
        // Adds a fully formed resume (import) and opens it.
        addResume: resume => {
          const r = { ...resume, id: uid(), updatedAt: Date.now() }
          r.settings = { ...DEFAULT_SETTINGS, ...r.settings, applyAccent: { ...DEFAULT_SETTINGS.applyAccent, ...r.settings?.applyAccent } }
          set(state => ({ resumes: [...state.resumes, r], currentId: r.id, past: [], future: [] }))
          return r.id
        },
        duplicateResume: id => set(state => {
          const src = state.resumes.find(r => r.id === id)
          const copy = { ...structuredClone(src), id: uid(), name: nextVersionName(src.name, state.resumes), updatedAt: Date.now() }
          return { resumes: [...state.resumes, copy], currentId: copy.id, past: [], future: [] }
        }),
        // Deleting everything is allowed; the app then shows an empty Overview.
        deleteResume: id => get().deleteResumes([id]),
        deleteResumes: ids => set(state => {
          const drop = new Set(ids)
          const resumes = state.resumes.filter(r => !drop.has(r.id))
          const currentId = drop.has(state.currentId) ? (resumes[0]?.id ?? null) : state.currentId
          return { resumes, currentId, past: [], future: [] }
        }),
        renameResume: (id, name) => set(state => ({
          resumes: state.resumes.map(r => (r.id === id ? { ...r, name } : r)),
        })),
        // Optional free-text tag, e.g. "b2c - google", for telling versions apart.
        setLabel: (id, label) => set(state => ({
          resumes: state.resumes.map(r => (r.id === id ? { ...r, label: label.trim() } : r)),
        })),

        // ----- personal details -----
        setPersonal: (key, value) => mutate(r => { r.personal[key] = value }, `personal.${key}`),
        addLink: type => mutate(r => { r.personal.links.push({ id: uid(), type, value: '' }) }),
        setLink: (id, value) => mutate(r => { r.personal.links.find(l => l.id === id).value = value }, `link.${id}`),
        removeLink: id => mutate(r => { r.personal.links = r.personal.links.filter(l => l.id !== id) }),

        // ----- sections -----
        addSection: type => {
          const id = uid()
          const def = SECTION_TYPES[type]
          mutate(r => {
            const rightTypes = ['experience', 'projects', 'organisations', 'publications', 'custom']
            r.sections.push({
              id, type, heading: def.label, hidden: false,
              column: rightTypes.includes(type) ? 'right' : 'left',
              entries: def.single ? [blankEntry(type)] : [],
            })
          })
          return id
        },
        removeSection: id => mutate(r => { r.sections = r.sections.filter(s => s.id !== id) }),
        renameSection: (id, heading) => mutate(r => { section(r, id).heading = heading }, `heading.${id}`),
        toggleSectionHidden: id => mutate(r => { const s = section(r, id); s.hidden = !s.hidden }),
        setSectionColumn: (id, column) => mutate(r => { section(r, id).column = column }),
        moveSection: (from, to) => mutate(r => {
          const [s] = r.sections.splice(from, 1)
          r.sections.splice(to, 0, s)
        }),

        // ----- entries -----
        addEntry: sectionId => {
          let id
          mutate(r => {
            const s = section(r, sectionId)
            const e = blankEntry(s.type)
            id = e.id
            s.entries.push(e)
          })
          return id
        },
        setEntry: (sectionId, entryId, key, value) => mutate(r => {
          section(r, sectionId).entries.find(e => e.id === entryId)[key] = value
        }, `entry.${entryId}.${key}`),
        removeEntry: (sectionId, entryId) => mutate(r => {
          const s = section(r, sectionId)
          s.entries = s.entries.filter(e => e.id !== entryId)
        }),
        toggleEntryHidden: (sectionId, entryId) => mutate(r => {
          const e = section(r, sectionId).entries.find(x => x.id === entryId)
          e.hidden = !e.hidden
        }),
        moveEntry: (sectionId, from, to) => mutate(r => {
          const list = section(r, sectionId).entries
          const [e] = list.splice(from, 1)
          list.splice(to, 0, e)
        }),

        // ----- settings -----
        setSetting: (key, value) => mutateSettings(r => { r.settings[key] = value }, `setting.${key}`),
        setAccentTarget: (key, value) => mutateSettings(r => { r.settings.applyAccent[key] = value }),
        resetSettings: () => mutateSettings(r => { r.settings = { ...defaultDesign(), language: r.settings.language } }),
        applyPreset: preset => mutateSettings(r => { Object.assign(r.settings, structuredClone(preset)) }),
        // A template replaces the whole look: design settings go back to defaults, then the template applies.
        applyTemplate: (template, keepKeys) => mutateSettings(r => {
          const kept = Object.fromEntries(keepKeys.map(k => [k, r.settings[k]]))
          r.settings = { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(template.settings), ...kept, templateId: template.id }
        }),

        // ----- optimise -----
        // Per-resume optimiser state (ignored issues, job description, analysis, decisions). Not part of undo history.
        setOptimize: patch => set(state => ({
          resumes: state.resumes.map(r => (r.id === state.currentId ? { ...r, optimize: { ...(r.optimize ?? {}), ...patch } } : r)),
        })),
        ignoreIssue: (id, ignored = true) => set(state => ({
          resumes: state.resumes.map(r => {
            if (r.id !== state.currentId) return r
            const list = new Set(r.optimize?.ignored ?? [])
            if (ignored) list.add(id)
            else list.delete(id)
            return { ...r, optimize: { ...(r.optimize ?? {}), ignored: [...list] } }
          }),
        })),
        // Apply one edit (AI suggestion, rewrite or auto-fix) to the open resume. Undoable.
        applyEdit: edit => {
          let ok = false
          mutate(r => { ok = applyEditTo(r, edit) })
          return ok
        },
        // Copy a resume, apply edits to the copy, label it, and open it.
        createTailoredCopy: ({ sourceId, edits, name, label }) => {
          const state = get()
          const src = state.resumes.find(r => r.id === sourceId) ?? state.current()
          const copy = { ...structuredClone(src), id: uid(), name: name || nextVersionName(src.name, state.resumes), label: label ?? src.label, updatedAt: Date.now() }
          for (const e of edits) applyEditTo(copy, e)
          set({ resumes: [...state.resumes, copy], currentId: copy.id, past: [], future: [] })
          return copy.id
        },

        // ----- UI focus (not persisted): open a specific entry in the Content editor -----
        focus: null,
        optimizeTab: null, // which Optimize tab to open next (e.g. 'job' after building from a job)
        setOptimizeTab: optimizeTab => set({ optimizeTab }),
        setFocus: focus => set({ focus }),
        // ----- vault: master data across all resumes (not part of undo history) -----
        vault: emptyVault(),
        // No-op syncs (nothing new) leave state alone, so the periodic sync doesn't re-render or re-save.
        syncVault: () => set(state => {
          const next = syncVault(state.vault, state.resumes)
          const same = JSON.stringify({ ...next, syncedAt: 0 }) === JSON.stringify({ ...state.vault, syncedAt: 0 })
          return same ? state : { vault: next }
        }),
        updateVaultBullet: (itemId, bulletId, patch) => set(state => ({ vault: mapBullet(state.vault, itemId, bulletId, b => {
          const next = { ...b, ...patch, updatedAt: Date.now() }
          if (patch.text !== undefined && patch.text !== b.text) {
            next.html = '' // plain text after editing
            const fp = fingerprint(patch.text)
            if (fp && !next.origins.includes(fp)) next.origins = [...next.origins, fp]
          }
          if (patch.tags) next.tagSource = patch.tagSource ?? 'user'
          return next
        }) })),
        addVaultBullet: (itemId, text, role = '') => set(state => ({ vault: { ...state.vault, items: state.vault.items.map(it => it.id !== itemId ? it : {
          ...it, bullets: [...it.bullets, { id: uid(), text, html: '', role, tags: ruleTags(text, vaultTags(state.vault)), tagSource: 'rules', origins: [fingerprint(text)], sources: [], manual: true, createdAt: Date.now(), updatedAt: Date.now() }],
        }) } })),
        deleteVaultBullet: (itemId, bulletId) => set(state => {
          const item = state.vault.items.find(i => i.id === itemId)
          const bullet = item?.bullets.find(b => b.id === bulletId)
          if (!bullet) return state
          return { vault: { ...state.vault, dismissed: [...new Set([...state.vault.dismissed, ...dismissKey(item, bullet)])], items: state.vault.items.map(it => it.id !== itemId ? it : { ...it, bullets: it.bullets.filter(b => b.id !== bulletId) }) } }
        }),
        addVaultItem: ({ kind, title, subtitle = '' }) => {
          const id = uid()
          set(state => ({ vault: { ...state.vault, items: [...state.vault.items, { id, key: `${kind}:manual:${id}`, kind, title, subtitle, roles: [], start: '', end: '', location: '', bullets: [], manual: true, createdAt: Date.now() }] } }))
          return id
        },
        // Vault profile edits. Removing a headline remembers it so sync doesn't add it back.
        updateVaultProfile: patch => set(state => ({ vault: { ...state.vault, profile: { ...state.vault.profile, ...patch } } })),
        removeVaultHeadline: headline => set(state => {
          const p = state.vault.profile
          const key = norm(headline)
          return { vault: { ...state.vault, profile: { ...p, headlines: p.headlines.filter(h => h !== headline), dismissedHeadlines: [...new Set([...(p.dismissedHeadlines ?? []), key])] } } }
        }),
        // ----- vault tags (each person's own list) -----
        // Add a tag by name (yours, or suggested by AI with a description and keywords). Returns its id.
        addVaultTag: ({ label, description = '', keywords, source = 'user' }) => {
          const name = label.trim()
          if (!name) return null
          const state = get()
          const existing = vaultTags(state.vault).find(t => norm(t.label) === norm(name))
          if (existing) return existing.id
          const id = `u-${norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${uid().slice(0, 4)}`
          const tag = { id, source, label: name, description, color: TAG_COLORS[(state.vault.tags ?? []).length % TAG_COLORS.length], keywords: tagKeywords(keywords?.length ? keywords : [name]) }
          set({ vault: { ...state.vault, tags: [...(state.vault.tags ?? []), tag] } })
          get().syncVault()
          return id
        },
        renameVaultTag: (id, label) => set(state => ({ vault: { ...state.vault, tags: (state.vault.tags ?? []).map(t => (t.id === id ? { ...t, label: label.trim() || t.label } : t)) } })),
        // Removing a tag takes it off every bullet and stops it being inferred again.
        removeVaultTag: id => {
          set(state => ({ vault: {
            ...state.vault,
            tags: (state.vault.tags ?? []).filter(t => t.id !== id),
            dismissedTags: [...new Set([...(state.vault.dismissedTags ?? []), id])],
            items: state.vault.items.map(it => ({ ...it, bullets: it.bullets.map(b => (b.tags.includes(id) ? { ...b, tags: b.tags.filter(x => x !== id) } : b)) })),
          } }))
          get().syncVault()
        },
        // Per-bullet ignored checks (same idea as Optimize's "Ignore issue"), stored on the vault bullet.
        ignoreVaultIssue: (itemId, bulletId, check, ignored = true) => set(state => ({ vault: mapBullet(state.vault, itemId, bulletId, b => {
          const list = new Set(b.ignored ?? [])
          if (ignored) list.add(check)
          else list.delete(check)
          return { ...b, ignored: [...list] }
        }) })),
        updateVaultItem: (itemId, patch) => set(state => ({ vault: { ...state.vault, items: state.vault.items.map(it => (it.id === itemId ? { ...it, ...patch } : it)) } })),
        deleteVaultItem: itemId => set(state => {
          const item = state.vault.items.find(i => i.id === itemId)
          if (!item) return state
          return { vault: { ...state.vault, dismissed: [...new Set([...state.vault.dismissed, item.key])], items: state.vault.items.filter(i => i.id !== itemId) } }
        }),
        // Apply AI tags: [{ itemId, bulletId, tags }]. Tags a user set by hand are left alone.
        setVaultTags: updates => set(state => {
          const byBullet = new Map(updates.map(u => [u.bulletId, u.tags]))
          const ids = new Set(vaultTags(state.vault).map(t => t.id))
          return { vault: { ...state.vault, items: state.vault.items.map(it => ({ ...it, bullets: it.bullets.map(b => (byBullet.has(b.id) && b.tagSource !== 'user' ? { ...b, tags: byBullet.get(b.id).filter(id => ids.has(id)), tagSource: 'ai' } : b)) })) } }
        }),

        pageCount: 1,
        setPageCount: pageCount => set(state => (state.pageCount === pageCount ? state : { pageCount })),
      }
    },
    {
      name: 'resume-builder',
      // Saves are ignored until this store has loaded what's saved, so a starting (or hot-reloaded) copy
      // of the store can never write its placeholder state over your resumes.
      storage: createJSONStorage(() => ({ ...idbStorage, setItem: (name, value) => (useStore?.persist?.hasHydrated() ? idbStorage.setItem(name, value) : undefined) })),
      // Shared by every tab. Which resume is open is per tab (see OPEN_KEY), so tabs don't switch each other.
      partialize: s => persisted(s),
      // Fill in any settings added after a resume was first saved.
      merge: (persisted, current) => {
        const merged = { ...current, ...persisted }
        const open = readOpen() ?? persisted?.currentId
        merged.currentId = (merged.resumes ?? []).some(r => r.id === open) ? open : merged.resumes?.[0]?.id ?? current.currentId
        merged.vault = persisted?.vault ?? emptyVault()
        merged.resumes = (merged.resumes ?? current.resumes).map(r => ({
          ...r,
          settings: { ...DEFAULT_SETTINGS, ...r.settings, applyAccent: { ...DEFAULT_SETTINGS.applyAccent, ...r.settings?.applyAccent } },
        }))
        return merged
      },
    },
  ),
)

// The resume open in this tab, remembered across reloads (localStorage is per browser, like IndexedDB).
const OPEN_KEY = 'rw.openResume'
function readOpen() { try { return localStorage.getItem(OPEN_KEY) } catch { return null } }
useStore.subscribe((state, prev) => {
  if (state.currentId !== prev.currentId && state.currentId) try { localStorage.setItem(OPEN_KEY, state.currentId) } catch { /* private mode */ }
})

// Another tab saved (or a backup was restored): merge its copy with this tab's current state, resume by
// resume, so edits on either side survive; keep this tab's open resume. Undo history is cleared when the
// resumes changed, so undo can't bring back (and save) an older copy.
onRemoteSave((theirs, base) => {
  const s = useStore.getState()
  let saved
  try {
    const ours = JSON.stringify({ state: persisted(s), version: 0 })
    saved = JSON.parse(base ? merge(base, ours, theirs) : theirs).state
  } catch { return }
  if (!saved?.resumes) return
  const resumesChanged = JSON.stringify(saved.resumes) !== JSON.stringify(s.resumes)
  useStore.setState({
    resumes: saved.resumes,
    vault: saved.vault ?? s.vault,
    designDefaults: saved.designDefaults,
    currentId: saved.resumes.some(r => r.id === s.currentId) ? s.currentId : saved.resumes[0]?.id ?? null,
    ...(resumesChanged ? { past: [], future: [] } : {}),
  })
})

// Editing store.js in development: reload the page instead of running a second copy of the store.
if (import.meta.hot) import.meta.hot.accept(() => location.reload())

const mapBullet = (vault, itemId, bulletId, fn) => ({
  ...vault,
  items: vault.items.map(it => (it.id !== itemId ? it : { ...it, bullets: it.bullets.map(b => (b.id === bulletId ? fn(b) : b)) })),
})

// "Product Designer" → "Product Designer (v2)"; "Product Designer (v2)" → "Product Designer (v3)"
function nextVersionName(name, resumes) {
  const base = name.replace(/\s*\(v\d+\)$/, '')
  const taken = new Set(resumes.map(r => r.name))
  let n = 2
  while (taken.has(`${base} (v${n})`)) n++
  return `${base} (v${n})`
}

export const useHydrated = () => {
  const [done, setDone] = useState(useStore.persist.hasHydrated())
  useEffect(() => {
    if (useStore.persist.hasHydrated()) setDone(true)
    return useStore.persist.onFinishHydration(() => setDone(true))
  }, [])
  return done
}

// The open resume, or undefined when there are none.
export const useResume = () => useStore(s => s.resumes.find(r => r.id === s.currentId) ?? s.resumes[0])

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) window.__store = useStore
