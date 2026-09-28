import { uid } from '../defaults'
import { SECTION_TYPES } from '../sections'
import { sanitize } from '../format'
import { TAGS, KIND_OF_SECTION } from '../../config/taxonomy'

// The Vault: every piece of CV content across all resumes, deduplicated and tagged.
//
// vault = { items: Item[], dismissed: string[], syncedAt }
// Item   = { id, key, kind, title, subtitle, roles: Role[], start, end, location, bullets: Bullet[], manual?, createdAt }
// Bullet = { id, text, html, role, tags: string[], tagSource: 'rules'|'ai'|'user', origins: string[], sources: Source[], manual?, createdAt, updatedAt }
//
// Sync only ever adds: new items and new bullets, plus refreshed `sources` (which resumes use them).
// User edits are never overwritten; a bullet remembers every fingerprint it has had (`origins`) so an
// edited bullet isn't re-added from the resume it came from, and `dismissed` stops deleted ones returning.

export const emptyVault = () => ({ items: [], dismissed: [], syncedAt: 0 })

export const norm = t => (t || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9%$€£₹+#.]+/g, ' ').replace(/\s+/g, ' ').trim()
export const fingerprint = text => norm(text).replace(/[.\s]+$/, '')

const words = t => new Set(norm(t).split(' ').filter(w => w.length > 2))
export function similar(a, b) {
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return false
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter) >= 0.85
}

// ---------- local rule-based tagging (instant, free) ----------
// Whole-word keyword matches, scored by how many distinct keywords hit; keep the top 3.
const TAG_RX = TAGS.map(t => ({ id: t.id, rx: t.keywords.map(k => new RegExp(`(^|[^a-z0-9])(${k})(?=$|[^a-z0-9])`, 'i')) }))
export function ruleTags(text) {
  return TAG_RX
    .map((t, order) => ({ id: t.id, order, hits: t.rx.filter(rx => rx.test(text)).length }))
    .filter(t => t.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .slice(0, 3)
    .map(t => t.id)
}

// ---------- reading resumes ----------
function itemsOf(html) {
  if (!html) return []
  const doc = new DOMParser().parseFromString(`<div>${sanitize(html)}</div>`, 'text/html')
  const out = []
  for (const node of doc.body.firstChild.childNodes) {
    if (node.nodeType !== 1) continue
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      for (const li of node.children) if (li.textContent.trim()) out.push({ text: li.textContent.replace(/\s+/g, ' ').trim(), html: li.innerHTML.trim() })
    } else if (node.textContent.trim()) out.push({ text: node.textContent.replace(/\s+/g, ' ').trim(), html: node.innerHTML.trim() })
  }
  return out
}

// Resume entry → vault entity description + its bullets.
export function entityOf(section, entry) {
  const kind = KIND_OF_SECTION[section.type]
  if (!kind) return null
  const e = entry
  const rich = SECTION_TYPES[section.type]?.fields.find(f => f.kind === 'rich')?.key
  const bullets = rich ? itemsOf(e[rich]) : []
  switch (section.type) {
    case 'experience':
      return { kind, title: e.employer || e.jobTitle || '', subtitle: '', role: { title: e.jobTitle || '', start: e.startDate || '', end: e.endDate || '', location: e.location || '' }, bullets }
    case 'education':
      return { kind, title: e.school || e.degree || '', subtitle: '', role: { title: e.degree || '', start: e.startDate || '', end: e.endDate || '', location: e.location || '' }, bullets }
    case 'organisations':
      return { kind, title: e.organisation || '', subtitle: '', role: { title: e.position || '', start: e.startDate || '', end: e.endDate || '', location: e.location || '' }, bullets }
    case 'projects':
      return { kind, title: e.title || '', subtitle: e.subtitle || '', start: e.startDate || '', end: e.endDate || '', bullets }
    case 'certificates':
      return { kind, title: e.name || '', subtitle: e.issuer || '', end: e.endDate || '', bullets }
    case 'awards':
      return { kind, title: e.award || '', subtitle: e.issuer || '', end: e.endDate || '', bullets }
    case 'publications':
      return { kind, title: e.title || '', subtitle: e.publisher || '', end: e.endDate || '', bullets }
    case 'courses':
      return { kind, title: e.course || '', subtitle: e.institution || '', bullets }
    case 'skills':
    case 'languages': {
      const group = section.type === 'languages' ? 'Languages' : e.skill || 'Skills'
      const list = section.type === 'languages'
        ? [[e.language, e.info].filter(Boolean).join(' – ')]
        : (e.info || '').split(/\s*[,;|]\s*/)
      return { kind, title: group, subtitle: '', bullets: list.map(s => s.trim()).filter(Boolean).map(s => ({ text: s, html: s })) }
    }
    case 'profile':
      return { kind, title: 'Profile summaries', subtitle: '', bullets: [{ text: itemsOf(e.text).map(b => b.text).join(' '), html: '' }].filter(b => b.text) }
    case 'custom':
      return { kind, title: e.title || section.heading, subtitle: e.subtitle || '', bullets }
    default:
      return null
  }
}

export const itemKey = (kind, title, subtitle) => `${kind}:${norm(title)}${kind === 'experience' || kind === 'skills' ? '' : `|${norm(subtitle)}`}`

/** Merge every resume's content into the vault. Pure: returns a new vault. */
export function syncVault(vault, resumes) {
  const v = structuredClone(vault ?? emptyVault())
  const dismissed = new Set(v.dismissed)
  const byKey = new Map(v.items.map(it => [it.key, it]))
  for (const it of v.items) for (const b of it.bullets) b.sources = []
  const now = Date.now()

  for (const r of resumes) {
    for (const section of r.sections) {
      for (const entry of section.entries) {
        const ent = entityOf(section, entry)
        if (!ent || !ent.title.trim()) continue
        const key = itemKey(ent.kind, ent.title, ent.subtitle)
        if (dismissed.has(key)) continue
        let item = byKey.get(key)
        if (!item) {
          item = { id: uid(), key, kind: ent.kind, title: ent.title.trim(), subtitle: ent.subtitle?.trim() || '', roles: [], start: ent.start || '', end: ent.end || '', location: '', bullets: [], createdAt: now }
          v.items.push(item)
          byKey.set(key, item)
        }
        if (ent.role?.title && !item.roles.some(x => norm(x.title) === norm(ent.role.title) && x.start === ent.role.start)) item.roles.push(ent.role)
        const source = { resumeId: r.id, sectionId: section.id, entryId: entry.id }

        for (const b of ent.bullets) {
          const fp = fingerprint(b.text)
          if (!fp || dismissed.has(`b:${key}:${fp}`)) continue
          let existing = item.bullets.find(x => x.origins.includes(fp)) || item.bullets.find(x => similar(x.text, b.text))
          if (existing) {
            if (!existing.origins.includes(fp)) existing.origins.push(fp)
            if (!existing.sources.some(s => s.resumeId === r.id && s.entryId === entry.id)) existing.sources.push(source)
            continue
          }
          item.bullets.push({
            id: uid(), text: b.text, html: b.html || '', role: ent.role?.title || '',
            tags: ruleTags(b.text), tagSource: 'rules', origins: [fp], sources: [source], createdAt: now, updatedAt: now,
          })
        }
      }
    }
  }
  v.syncedAt = now
  return v
}

// Fingerprint used to remember a deleted bullet so sync doesn't bring it back.
export const dismissKey = (item, bullet) => bullet.origins.map(fp => `b:${item.key}:${fp}`)
