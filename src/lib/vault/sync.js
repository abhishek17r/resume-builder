import { uid } from '../defaults'
import { SECTION_TYPES } from '../sections'
import { sanitize } from '../format'
import { TAGS, KIND_OF_SECTION } from '../../config/taxonomy'

// The Vault: every piece of CV content across all resumes, deduplicated and tagged.
//
// vault = { profile: Profile, items: Item[], dismissed: string[], syncedAt }
// Profile = { fullName, email, phone, location, photo, links: {type,value}[], headlines: string[] }
// Item   = { id, key, kind, title, subtitle, roles: Role[], start, end, location, bullets: Bullet[], manual?, createdAt }
// Bullet = { id, text, html, role, tags: string[], tagSource: 'rules'|'ai'|'user', origins: string[], sources: Source[], manual?, createdAt, updatedAt }
//
// Sync only ever adds: new items and new bullets, plus refreshed `sources` (which resumes use them).
// User edits are never overwritten; a bullet remembers every fingerprint it has had (`origins`) so an
// edited bullet isn't re-added from the resume it came from, and `dismissed` stops deleted ones returning.

export const emptyProfile = () => ({ fullName: '', email: '', phone: '', location: '', photo: '', links: [], headlines: [] })
export const emptyVault = () => ({ profile: emptyProfile(), items: [], dismissed: [], syncedAt: 0 })

const PROFILE_FIELDS = ['fullName', 'email', 'phone', 'location', 'photo']

// Profile details from resumes, newest first. Only fills what's empty, so edits made in the Vault stay;
// every headline (job title line) and link seen is kept, since resumes are often tailored.
function syncProfile(profile, resumes) {
  const p = { ...emptyProfile(), ...structuredClone(profile ?? {}) }
  for (const r of [...resumes].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))) {
    const me = r.personal ?? {}
    for (const f of PROFILE_FIELDS) if (!p[f] && me[f]?.trim?.()) p[f] = me[f].trim()
    const headline = r.vaultSkip?.includes('headline') ? '' : me.jobTitle?.trim()
    if (headline && !p.headlines.some(h => norm(h) === norm(headline)) && !(p.dismissedHeadlines ?? []).includes(norm(headline))) p.headlines.push(headline)
    for (const l of me.links ?? []) {
      const value = l.value?.trim()
      if (value && !p.links.some(x => norm(x.value) === norm(value))) p.links.push({ type: l.type, value })
    }
  }
  return p
}

export const norm = t => (t || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9%$€£₹+#.]+/g, ' ').replace(/\s+/g, ' ').trim()
export const fingerprint = text => norm(text).replace(/[.\s]+$/, '')

const words = t => new Set(norm(t).split(' ').filter(w => w.length > 2))

// The numbers a bullet states ("30%", "$1.2M", "8 engineers" → 8), normalised: a changed metric is a different bullet.
const METRIC = /[$€£₹]?\d[\d,.]*\s*(?:%|[kmbt]\b|x\b|\+)?/gi
export const metricsOf = t => [...new Set(((t || '').match(METRIC) ?? []).map(n => n.toLowerCase().replace(/[,\s]/g, '').replace(/\.$/, '')))].sort().join('|')

// One bullet or two? The same only when every number matches and the wording is nearly the same
// (about 80% of the words shared). A new metric or a real rewrite keeps its own copy.
export function similar(a, b) {
  if (metricsOf(a) !== metricsOf(b)) return false
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return false
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter) >= 0.8
}

// Collapse duplicate bullets in an item into one copy that keeps every origin and source.
// The copy edited in the vault (text or tags) wins; otherwise the earlier one.
const edited = b => b.tagSource === 'user' || b.manual || (b.updatedAt ?? 0) > (b.createdAt ?? 0) + 1000
function dedupeBullets(item) {
  const kept = []
  for (const b of item.bullets) {
    const i = kept.findIndex(k => (k.role || '') === (b.role || '') && (k.origins.some(o => b.origins.includes(o)) || similar(k.text, b.text)))
    if (i < 0) { kept.push(b); continue }
    const twin = kept[i]
    const [keep, drop] = edited(b) && !edited(twin) ? [b, twin] : [twin, b]
    const merged = {
      ...keep,
      origins: [...new Set([...keep.origins, ...drop.origins])],
      sources: [...keep.sources, ...drop.sources.filter(s => !keep.sources.some(k => k.resumeId === s.resumeId && k.entryId === s.entryId))],
      ignored: [...new Set([...(keep.ignored ?? []), ...(drop.ignored ?? [])])],
      ...(keep.tagSource !== 'user' && drop.tagSource === 'user' ? { tags: drop.tags, tagSource: 'user' } : {}),
    }
    kept[i] = merged
  }
  item.bullets = kept
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
      // Spoken languages get their own group so they don't merge with a skills group called "Languages".
      const group = section.type === 'languages' ? SPOKEN_LANGUAGES : e.skill || 'Skills'
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

export const SPOKEN_LANGUAGES = 'Spoken languages'

// Two roles are the same role when their titles match (same start), or when their dates match: a resume
// imported twice may carry the title differently ("Software Engineer" vs "Software Engineer, Airbnb 07/2016 –").
export const sameRole = (a, b) =>
  (norm(a.title) === norm(b.title) && (a.start || '') === (b.start || '')) ||
  (!!a.start && a.start === b.start && (a.end || '') === (b.end || ''))

// For duplicates of one role: a clean title (no dates, "|" pieces or the company's name in it) beats a
// garbled one; between clean ones, the fuller title wins.
const titleQuality = (t, item) => {
  const garbled = /\d{1,2}\/\d{4}|\b(19|20)\d{2}\b|\s\|\s|[–—-]\s*$/.test(t) || (norm(item.title).length > 2 && norm(t).includes(norm(item.title)))
  return (garbled ? 0 : 1000) + Math.min(t.length, 80)
}

// Keep one role for `role` on the item; returns the role's kept title. Bullets follow a renamed role.
function mergeRole(item, role) {
  const same = item.roles.find(x => sameRole(x, role))
  if (!same) { item.roles.push({ ...role }); return role.title }
  if (!same.location && role.location) same.location = role.location
  if (titleQuality(role.title, item) > titleQuality(same.title, item)) {
    for (const b of item.bullets) if (b.role === same.title) b.role = role.title
    same.title = role.title
  }
  return same.title
}

// Collapse duplicate roles already in a vault (from earlier imports).
function dedupeRoles(item) {
  const roles = item.roles
  item.roles = []
  for (const r of roles) mergeRole(item, r)
  const kept = new Set(item.roles.map(r => r.title))
  for (const b of item.bullets) {
    if (!b.role || kept.has(b.role)) continue
    const old = roles.find(r => r.title === b.role)
    const into = old && item.roles.find(r => sameRole(r, old))
    if (into) b.role = into.title
  }
}

export const itemKey = (kind, title, subtitle) => `${kind}:${norm(title)}${kind === 'experience' || kind === 'skills' ? '' : `|${norm(subtitle)}`}`

/** Merge every resume's content into the vault. Pure: returns a new vault. */
export function syncVault(vault, resumes) {
  const v = structuredClone(vault ?? emptyVault())
  v.profile = syncProfile(v.profile, resumes)
  const dismissed = new Set(v.dismissed)
  const byKey = new Map(v.items.map(it => [it.key, it]))
  for (const it of v.items) for (const b of it.bullets) b.sources = []
  const now = Date.now()

  for (const r of resumes) {
    const skip = new Set(r.vaultSkip ?? [])
    for (const section of r.sections) {
      // Resumes built from the vault: generated summary/skills aren't new vault content.
      if ((skip.has('summaries') && section.type === 'profile') || (skip.has('skills') && section.type === 'skills')) continue
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
        const roleTitle = ent.role?.title ? mergeRole(item, ent.role) : ''
        const source = { resumeId: r.id, sectionId: section.id, entryId: entry.id }

        for (const b of ent.bullets) {
          const fp = fingerprint(b.text)
          if (!fp || dismissed.has(`b:${key}:${fp}`)) continue
          // Tailored wording on a built resume belongs to the vault bullet it came from.
          const linkedId = r.vaultLinks?.[fp]
          const linked = linkedId && v.items.flatMap(i => i.bullets).find(x => x.id === linkedId)
          if (linked) {
            if (!linked.sources.some(s => s.resumeId === r.id && s.entryId === entry.id)) linked.sources.push(source)
            continue
          }
          let existing = item.bullets.find(x => x.origins.includes(fp)) || item.bullets.find(x => similar(x.text, b.text))
          if (existing) {
            if (!existing.origins.includes(fp)) existing.origins.push(fp)
            if (!existing.sources.some(s => s.resumeId === r.id && s.entryId === entry.id)) existing.sources.push(source)
            continue
          }
          item.bullets.push({
            id: uid(), text: b.text, html: b.html || '', role: roleTitle,
            tags: ruleTags(b.text), tagSource: 'rules', origins: [fp], sources: [source], createdAt: now, updatedAt: now,
          })
        }
      }
    }
  }
  // Older vaults merged spoken languages into a skills group named "Languages": drop those copies.
  const spoken = new Set(v.items.filter(i => i.kind === 'skills' && i.title === SPOKEN_LANGUAGES).flatMap(i => i.bullets.flatMap(b => b.origins)))
  if (spoken.size) {
    for (const item of v.items) {
      if (item.kind !== 'skills' || item.title === SPOKEN_LANGUAGES) continue
      item.bullets = item.bullets.filter(b => b.manual || !b.origins.some(fp => spoken.has(fp)))
    }
  }
  for (const item of v.items) {
    if (item.roles?.length > 1) dedupeRoles(item)
    if (item.bullets.length > 1) dedupeBullets(item)
  }
  v.syncedAt = now
  return v
}

// Fingerprint used to remember a deleted bullet so sync doesn't bring it back.
export const dismissKey = (item, bullet) => bullet.origins.map(fp => `b:${item.key}:${fp}`)
