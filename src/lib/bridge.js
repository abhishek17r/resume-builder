import { API_URL } from './api'
import { useStore } from './store'
import { SECTION_TYPES } from './sections'
import { getItems, appendBullet, moveItemUp, setItem } from './optimize/bullets'
import { norm, vaultTags } from './vault/sync'

// The app's side of the Claude bridge (the server side is the AI server's src/bridge.js).
// While the app is open it keeps the local server up to date with a compact copy of the resumes and
// vault, so Claude can read them through the MCP server, and applies the commands Claude sends
// (add bullets to the vault or a resume, rewrite a bullet, set a summary) through the store, so they
// save, sync across tabs and undo like any other edit. A toast says what Claude changed.

const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const richKey = type => SECTION_TYPES[type]?.fields.find(f => f.kind === 'rich')?.key
const plain = html => getItems(html).map(i => i.text).join(' ')

// ---------- what Claude reads ----------
function compactResume(r) {
  return {
    id: r.id,
    name: r.name,
    label: r.label || '',
    updatedAt: r.updatedAt,
    headline: r.personal?.jobTitle || '',
    sections: r.sections.map(s => {
      const rich = richKey(s.type)
      return {
        sectionId: s.id,
        type: s.type,
        heading: s.heading,
        hidden: s.hidden || undefined,
        entries: s.entries.map(e => ({
          entryId: e.id,
          title: (SECTION_TYPES[s.type]?.title?.(e) ?? []).filter(Boolean).join(' · ') || undefined,
          dates: e.startDate || e.endDate ? `${e.startDate || ''}–${e.endDate || 'present'}` : undefined,
          hidden: e.hidden || undefined,
          ...(s.type === 'profile' ? { summary: plain(e.text) } : {}),
          ...(rich && s.type !== 'profile' ? { bullets: getItems(e[rich]).map(({ i, text }) => ({ index: i, text })) } : {}),
          ...(s.type === 'skills' ? { skills: e.info || '' } : {}),
        })),
      }
    }),
  }
}

function compactVault(v) {
  const tags = vaultTags(v)
  const label = Object.fromEntries(tags.map(t => [t.id, t.label]))
  return {
    tags: tags.map(t => t.label),
    items: v.items.map(it => ({
      itemId: it.id,
      kind: it.kind,
      title: it.title,
      subtitle: it.subtitle || undefined,
      roles: it.roles?.length ? it.roles.map(r => r.title).filter(Boolean) : undefined,
      bullets: it.bullets.map(b => ({ bulletId: b.id, text: b.text, role: b.role || undefined, tags: b.tags.map(id => label[id]).filter(Boolean) })),
    })),
  }
}

const snapshotOf = s => ({ resumes: s.resumes.map(compactResume), vault: compactVault(s.vault), currentId: s.currentId })

// ---------- what Claude can do ----------
const say = message => window.dispatchEvent(new CustomEvent('offerstack:claude', { detail: { message } }))

function findEntry(resumeId, entryId) {
  const s = useStore.getState()
  const id = resumeId || s.currentId
  const resume = s.resumes.find(r => r.id === id)
  if (!resume) throw new Error(`No resume with id ${id}.`)
  const section = resume.sections.find(sec => sec.entries.some(e => e.id === entryId))
  if (!section) throw new Error(`No entry ${entryId} in "${resume.name}". Call get_resume for the ids.`)
  const key = richKey(section.type)
  if (!key || section.type === 'profile') throw new Error(`"${section.heading}" entries don't have bullets.`)
  return { resume, section, key }
}

const HANDLERS = {
  add_vault_bullets({ bullets, item_id, title, role = '', kind = 'experience', tags = [] }) {
    const store = useStore.getState()
    const { vault } = store
    let item = item_id ? vault.items.find(i => i.id === item_id) : vault.items.find(i => i.kind === kind && norm(i.title) === norm(title))
    if (item_id && !item) throw new Error(`No vault item ${item_id}. Call search_vault for the ids.`)
    const created = !item
    const itemId = item?.id ?? store.addVaultItem({ kind, title: title.trim() })
    const known = vaultTags(useStore.getState().vault)
    const tagIds = tags.map(t => known.find(k => norm(k.label) === norm(t))?.id).filter(Boolean)
    const unknownTags = tags.filter(t => !known.some(k => norm(k.label) === norm(t)))
    const { added, skipped } = useStore.getState().addVaultBullets(itemId, bullets.map(text => ({ text: text.trim(), role })), tagIds)
    const name = item?.title ?? title
    if (added.length) say(`Claude added ${added.length} bullet${added.length > 1 ? 's' : ''} to your vault (${name})`)
    return { item_id: itemId, item: name, created_item: created || undefined, added: added.length, skipped_duplicates: skipped.length ? skipped : undefined, unknown_tags: unknownTags.length ? unknownTags : undefined }
  },

  update_vault_bullet({ item_id, bullet_id, text }) {
    const item = useStore.getState().vault.items.find(i => i.id === item_id)
    const bullet = item?.bullets.find(b => b.id === bullet_id)
    if (!bullet) throw new Error('No such vault bullet. Call search_vault for the ids.')
    useStore.getState().updateVaultBullet(item_id, bullet_id, { text: text.trim() })
    say(`Claude edited a bullet in your vault (${item.title})`)
    return { ok: true, before: bullet.text, after: text.trim() }
  },

  add_resume_bullets({ resume_id, entry_id, bullets, position = 'end' }) {
    const { resume, section, key } = findEntry(resume_id, entry_id)
    useStore.getState().editResume(resume.id, r => {
      const e = r.sections.find(s => s.id === section.id).entries.find(x => x.id === entry_id)
      let html = e[key] || ''
      const list = position === 'start' ? [...bullets].reverse() : bullets
      for (const b of list) {
        html = appendBullet(html, esc(b.trim()))
        if (position === 'start') html = moveItemUp(html, getItems(html).length - 1)
      }
      e[key] = html
    })
    say(`Claude added ${bullets.length} bullet${bullets.length > 1 ? 's' : ''} to "${resume.name}"`)
    return { ok: true, resume: resume.name, added: bullets.length }
  },

  replace_resume_bullet({ resume_id, entry_id, index, text }) {
    const { resume, section, key } = findEntry(resume_id, entry_id)
    const entry = section.entries.find(x => x.id === entry_id)
    const items = getItems(entry[key])
    if (!items[index]) throw new Error(`That entry has ${items.length} bullets (index 0–${items.length - 1}).`)
    useStore.getState().editResume(resume.id, r => {
      const e = r.sections.find(s => s.id === section.id).entries.find(x => x.id === entry_id)
      e[key] = setItem(e[key], index, text)
    })
    say(`Claude rewrote a bullet in "${resume.name}"`)
    return { ok: true, before: items[index].text, after: text.trim() }
  },

  set_resume_summary({ resume_id, text }) {
    const s = useStore.getState()
    const resume = s.resumes.find(r => r.id === (resume_id || s.currentId))
    if (!resume) throw new Error('No such resume.')
    const profile = resume.sections.find(sec => sec.type === 'profile')
    if (!profile?.entries.length) throw new Error(`"${resume.name}" has no summary section. Add one in the app first.`)
    const before = plain(profile.entries[0].text)
    s.editResume(resume.id, r => { r.sections.find(sec => sec.id === profile.id).entries[0].text = `<p>${esc(text.trim())}</p>` })
    say(`Claude updated the summary of "${resume.name}"`)
    return { ok: true, before, after: text.trim() }
  },

  open_resume({ resume_id }) {
    const s = useStore.getState()
    const resume = s.resumes.find(r => r.id === resume_id)
    if (!resume) throw new Error('No such resume.')
    s.selectResume(resume.id)
    location.hash = 'content'
    return { ok: true, opened: resume.name }
  },
}

// ---------- connection ----------
let started = false
export function startBridge() {
  if (started || typeof EventSource === 'undefined') return
  started = true
  let source = null
  let connected = false
  let retry = 5_000
  let pushTimer = null

  const push = () => {
    if (!connected) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      fetch(`${API_URL}/api/bridge/snapshot`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(snapshotOf(useStore.getState())) }).catch(() => {})
    }, 500)
  }

  const connect = () => {
    source = new EventSource(`${API_URL}/api/bridge/events`)
    source.onopen = () => { connected = true; retry = 5_000; push() }
    source.onmessage = async e => {
      let cmd
      try { cmd = JSON.parse(e.data) } catch { return }
      let body
      try {
        const handler = HANDLERS[cmd.type]
        if (!handler) throw new Error(`This version of Offerstack can't do "${cmd.type}" yet.`)
        body = { ok: true, result: handler(cmd.args ?? {}) }
      } catch (err) {
        body = { ok: false, error: err.message }
      }
      await fetch(`${API_URL}/api/bridge/results/${cmd.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
      push()
    }
    // Server not running: stop retrying every few seconds; try again later, more slowly each time.
    source.onerror = () => {
      connected = false
      source.close()
      setTimeout(connect, retry)
      retry = Math.min(retry * 2, 60_000)
    }
  }

  connect()
  useStore.subscribe((s, prev) => { if (s.resumes !== prev.resumes || s.vault !== prev.vault || s.currentId !== prev.currentId) push() })
}
