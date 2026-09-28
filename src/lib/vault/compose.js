import { uid, blankEntry } from '../defaults'
import { SECTION_TYPES } from '../sections'
import { entityOf, itemKey, norm, SPOKEN_LANGUAGES } from './sync'
import { scoreVault } from './score'

// "New resume from a job description": the AI picks vault content by ref (see /api/resume/compose);
// this file sends the vault and turns the picks back into a resume. Wording always comes from the vault.

const monthYear = v => (v ? v.split('-').reverse().join('/') : '')
const range = (a, b) => [monthYear(a), b ? monthYear(b) : a ? 'Present' : ''].filter(Boolean).join(' – ')
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Vault kind → resume section type. 'other' (custom sections) is left out: their headings vary too much to rebuild.
const SECTION_OF = { experience: 'experience', education: 'education', projects: 'projects', certificates: 'certificates', awards: 'awards', organisations: 'organisations', publications: 'publications', courses: 'courses' }
const MAIN_COLUMN = new Set(['experience', 'projects', 'organisations', 'publications', 'custom', 'references'])
const DATED = new Set(['experience', 'education', 'organisations'])

const isSpoken = item => item.kind === 'skills' && item.title === SPOKEN_LANGUAGES

export function composePayload(vault) {
  const { byBullet } = scoreVault(vault)
  const items = vault.items
    .filter(i => (SECTION_OF[i.kind] || ['skills', 'summaries'].includes(i.kind)) && !isSpoken(i))
    .filter(i => i.bullets.length || SECTION_OF[i.kind])
    .slice(0, 200)
    .map(i => ({
      ref: i.id, kind: i.kind, title: i.title.slice(0, 300), subtitle: (i.subtitle || '').slice(0, 300),
      roles: i.roles.slice(0, 20).map(r => ({ title: r.title.slice(0, 300), dates: range(r.start, r.end) })),
      dates: range(i.start, i.end),
      bullets: i.bullets.slice(0, 200).map(b => ({ ref: b.id, text: b.text.slice(0, 3000), role: (b.role || '').slice(0, 300), ...(byBullet[b.id] ? { score: byBullet[b.id].score } : {}) })),
    }))
  return { items }
}

// The resume entry this vault item (and role) came from, so links, locations and other fields survive.
function findSourceEntry(item, roleTitle, resumes) {
  for (const r of resumes) {
    for (const section of r.sections) {
      for (const entry of section.entries) {
        const ent = entityOf(section, entry)
        if (!ent || itemKey(ent.kind, ent.title, ent.subtitle) !== item.key) continue
        if (roleTitle && norm(ent.role?.title) !== norm(roleTitle)) continue
        return structuredClone(entry)
      }
    }
  }
  return null
}

function entryFromFields(type, item, role) {
  const e = blankEntry(type)
  const r = role ?? {}
  const set = fields => Object.assign(e, fields)
  if (type === 'experience') set({ jobTitle: r.title || '', employer: item.title, startDate: r.start || '', endDate: r.end || '', location: r.location || '' })
  else if (type === 'education') set({ degree: r.title || '', school: item.title, startDate: r.start || '', endDate: r.end || '', location: r.location || '' })
  else if (type === 'organisations') set({ position: r.title || '', organisation: item.title, startDate: r.start || '', endDate: r.end || '', location: r.location || '' })
  else if (type === 'projects') set({ title: item.title, subtitle: item.subtitle, startDate: item.start || '', endDate: item.end || '' })
  else if (type === 'certificates') set({ name: item.title, issuer: item.subtitle, endDate: item.end || '' })
  else if (type === 'awards') set({ award: item.title, issuer: item.subtitle, endDate: item.end || '' })
  else if (type === 'publications') set({ title: item.title, publisher: item.subtitle, endDate: item.end || '' })
  else if (type === 'courses') set({ course: item.title, institution: item.subtitle })
  return e
}

const richKey = type => SECTION_TYPES[type]?.fields.find(f => f.kind === 'rich')?.key
const listHtml = bullets => (bullets.length ? `<ul>${bullets.map(b => `<li>${b.html || esc(b.text)}</li>`).join('')}</ul>` : '')
// Newest first; no end date means current.
const byRecency = (a, b) => (b.endDate || '9999').localeCompare(a.endDate || '9999') || (b.startDate || '').localeCompare(a.startDate || '')

/**
 * Build a resume from a composition. `base` supplies contact details, design and non-vault sections
 * (languages, interests, references…). Returns { resume, stats }.
 */
export function buildFromVault({ vault, base, resumes, composition, name, label }) {
  const items = new Map(vault.items.map(i => [i.id, i]))
  const bullets = new Map(vault.items.flatMap(i => i.bullets.map(b => [b.id, b])))
  const sources = [base, ...resumes.filter(r => r.id !== base.id).sort((a, b) => b.updatedAt - a.updatedAt)]
  const composed = {} // section type → entries
  const push = (type, e) => (composed[type] ??= []).push(e)
  let bulletCount = 0

  for (const pick of composition.entries) {
    const item = items.get(pick.itemRef)
    const type = item && SECTION_OF[item.kind]
    if (!type || type === 'education') continue
    const role = item.roles.find(r => r.title === pick.roleTitle)
    const entry = findSourceEntry(item, role?.title, sources) ?? entryFromFields(type, item, role)
    const chosen = pick.bulletRefs.map(ref => bullets.get(ref)).filter(Boolean)
    const key = richKey(type)
    if (key) entry[key] = listHtml(chosen)
    bulletCount += chosen.length
    push(type, { ...entry, id: uid(), hidden: false })
  }

  // Education is always included, with its original details.
  for (const item of vault.items.filter(i => i.kind === 'education')) {
    const roles = item.roles.length ? item.roles : [null]
    for (const role of roles) push('education', { ...(findSourceEntry(item, role?.title, sources) ?? entryFromFields('education', item, role)), id: uid(), hidden: false })
  }
  for (const type of DATED) composed[type]?.sort(byRecency)

  // Skills: grouped as in the vault, in the order the AI ranked them.
  const groups = new Map()
  for (const ref of composition.skillRefs) {
    const item = vault.items.find(i => i.kind === 'skills' && i.bullets.some(b => b.id === ref))
    if (!item || isSpoken(item)) continue
    if (!groups.has(item.id)) groups.set(item.id, { item, list: [] })
    groups.get(item.id).list.push(bullets.get(ref).text)
  }
  const baseSkills = base.sections.find(s => s.type === 'skills')?.entries ?? []
  if (groups.size) {
    composed.skills = [...groups.values()].map(({ item, list }) => ({
      ...blankEntry('skills'), id: uid(), skill: item.title === 'Skills' && groups.size === 1 ? '' : item.title, info: list.join(', '),
      level: baseSkills.find(e => norm(e.skill) === norm(item.title))?.level ?? -1,
    }))
  }

  const summary = bullets.get(composition.summaryRef)
  if (summary) composed.profile = [{ ...blankEntry('profile'), id: uid(), text: `<p>${esc(summary.text)}</p>` }]

  // Keep the base resume's section order, headings and columns; replace what the vault now supplies.
  const done = new Set()
  const sections = []
  for (const s of base.sections) {
    if (composed[s.type]) {
      if (done.has(s.type)) continue
      done.add(s.type)
      if (composed[s.type].length) sections.push({ ...s, id: uid(), hidden: false, entries: composed[s.type] })
    } else if (!SECTION_OF[s.type] || s.type === 'custom') {
      sections.push({ ...structuredClone(s), id: uid(), entries: s.entries.map(e => ({ ...structuredClone(e), id: uid() })) })
    }
    // A base section of a vault kind that the AI left out (e.g. irrelevant awards) is dropped.
  }
  for (const [type, entries] of Object.entries(composed)) {
    if (done.has(type) || !entries.length) continue
    sections.push({ id: uid(), type, hidden: false, heading: SECTION_TYPES[type].label, column: MAIN_COLUMN.has(type) ? 'right' : 'left', entries })
  }

  const resume = {
    ...structuredClone(base),
    id: uid(), name, label, updatedAt: Date.now(),
    personal: { ...structuredClone(base.personal), links: (base.personal.links ?? []).map(l => ({ ...l, id: uid() })) },
    sections,
    optimize: {},
  }
  return { resume, stats: { bullets: bulletCount, entries: composition.entries.length } }
}
