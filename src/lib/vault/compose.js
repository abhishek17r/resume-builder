import { uid, blankEntry, DEFAULT_SETTINGS } from '../defaults'
import { SECTION_TYPES } from '../sections'
import { entityOf, itemKey, norm, fingerprint, SPOKEN_LANGUAGES } from './sync'
import { scoreVault } from './score'

// "New resume from a job description": the AI picks vault content by ref (see /api/resume/compose);
// this file sends the vault and turns the picks back into a resume. Wording always comes from the vault.

const monthYear = v => (v ? v.split('-').reverse().join('/') : '')
const range = (a, b) => [monthYear(a), b ? monthYear(b) : a ? 'Present' : ''].filter(Boolean).join(' – ')
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Vault kind → resume section type. 'other' (custom sections) is left out: their headings vary too much to rebuild.
const SECTION_OF = { experience: 'experience', education: 'education', projects: 'projects', certificates: 'certificates', awards: 'awards', organisations: 'organisations', publications: 'publications', courses: 'courses' }
const DATED = new Set(['experience', 'education', 'organisations'])

const isSpoken = item => item.kind === 'skills' && item.title === SPOKEN_LANGUAGES

export function composePayload(vault) {
  const { byBullet } = scoreVault(vault)
  const headlines = (vault.profile?.headlines ?? []).slice(0, 20).map(h => h.slice(0, 300))
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
  return { items, headlines }
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

// Which vault content goes in: the AI's picks plus every company/role it left out (strongest bullets).
export function planFromVault({ vault, composition }) {
  const items = new Map(vault.items.map(i => [i.id, i]))
  const bullets = new Map(vault.items.flatMap(i => i.bullets.map(b => [b.id, b])))
  const { byBullet } = scoreVault(vault)

  const picks = [...composition.entries]
  let backfilled = 0
  for (const item of vault.items.filter(i => i.kind === 'experience')) {
    const roles = item.roles.length ? item.roles.map(r => r.title) : ['']
    for (const role of roles) {
      const covered = picks.some(p => p.itemRef === item.id && (norm(p.roleTitle) === norm(role) || (!p.roleTitle && roles.length === 1) || !role))
      if (covered) continue
      const best = item.bullets
        .filter(b => !role || !b.role || norm(b.role) === norm(role))
        .sort((a, b) => (byBullet[b.id]?.score ?? 0) - (byBullet[a.id]?.score ?? 0))
        .slice(0, 2)
      picks.push({ itemRef: item.id, roleTitle: role, bulletRefs: best.map(b => b.id) })
      backfilled++
    }
  }

  const entries = []
  for (const pick of picks) {
    const item = items.get(pick.itemRef)
    const type = item && SECTION_OF[item.kind]
    if (!type || type === 'education') continue
    entries.push({ type, item, role: item.roles.find(r => r.title === pick.roleTitle) ?? null, bullets: pick.bulletRefs.map(ref => bullets.get(ref)).filter(Boolean) })
  }

  // Skills: grouped as in the vault, in the order the AI ranked them.
  const groups = new Map()
  for (const ref of composition.skillRefs) {
    const item = vault.items.find(i => i.kind === 'skills' && i.bullets.some(b => b.id === ref))
    if (!item || isSpoken(item)) continue
    if (!groups.has(item.id)) groups.set(item.id, { group: item.title, items: [] })
    groups.get(item.id).items.push(bullets.get(ref).text)
  }

  const summaries = vault.items.filter(i => i.kind === 'summaries').flatMap(i => i.bullets.map(b => b.text))
  const chosenSummary = bullets.get(composition.summaryRef)?.text
  return {
    entries,
    skills: [...groups.values()],
    summaries: chosenSummary ? [chosenSummary, ...summaries.filter(t => t !== chosenSummary)] : summaries,
    headline: composition.headline || vault.profile?.headlines?.[0] || '',
    backfilled,
  }
}

// What the tailoring step sees: the chosen content plus the candidate's own headlines and summaries.
export function tailorPayload(plan, vault) {
  const context = e => [e.role?.title, e.item.title].filter(Boolean).join(' · ').slice(0, 300)
  return {
    headlines: [plan.headline, ...(vault.profile?.headlines ?? []).filter(h => h !== plan.headline)].filter(Boolean).slice(0, 20),
    summaries: plan.summaries.slice(0, 10).map(t => t.slice(0, 3000)),
    roles: [...new Set(vault.items.filter(i => i.kind === 'experience').flatMap(i => i.roles.map(r => `${r.title}, ${i.title}`)))].slice(0, 40),
    bullets: plan.entries.flatMap(e => e.bullets.map(b => ({ ref: b.id, text: b.text.slice(0, 3000), context: context(e) }))).slice(0, 80),
    skills: plan.skills.slice(0, 20).map(g => ({ group: g.group.slice(0, 100), items: g.items.slice(0, 60).map(i => i.slice(0, 100)) })),
  }
}

// Default order and placement for a resume built from the vault (the template decides columns or not).
const ORDER = ['profile', 'experience', 'projects', 'education', 'skills', 'certificates', 'awards', 'publications', 'organisations', 'courses', 'languages']
const HEADING = { profile: 'Profile Summary', experience: 'Professional Experience', certificates: 'Certifications', organisations: 'Volunteering' }
const LEFT = new Set(['profile', 'education', 'skills', 'languages', 'awards', 'courses'])

/**
 * Build the resume: tailored text where the tailoring step changed it, vault text otherwise; contact
 * details only from the vault profile; design from the chosen template. Returns { resume, changes }.
 */
export function buildFromVault({ vault, resumes, plan, tailored, template, name, label }) {
  const sources = [...resumes].sort((a, b) => b.updatedAt - a.updatedAt)
  const textOf = new Map((tailored?.bullets ?? []).map(b => [b.ref, b.text]))
  const composed = {}
  const push = (type, e) => (composed[type] ??= []).push(e)
  const links = {} // fingerprint of each resume bullet → vault bullet it came from (null: don't add to the vault)
  const changes = []

  for (const { type, item, role, bullets } of plan.entries) {
    const entry = findSourceEntry(item, role?.title, sources) ?? entryFromFields(type, item, role)
    const list = bullets.map(b => {
      const text = textOf.get(b.id) ?? b.text
      if (text !== b.text) changes.push({ kind: 'bullet', where: [role?.title, item.title].filter(Boolean).join(', '), before: b.text, after: text })
      links[fingerprint(text)] = b.id
      return text === b.text ? b : { text, html: '' }
    })
    const key = richKey(type)
    if (key) entry[key] = listHtml(list)
    push(type, { ...entry, id: uid(), hidden: false })
  }

  for (const item of vault.items.filter(i => i.kind === 'education')) {
    const roles = item.roles.length ? item.roles : [null]
    for (const role of roles) push('education', { ...(findSourceEntry(item, role?.title, sources) ?? entryFromFields('education', item, role)), id: uid(), hidden: false })
  }
  for (const type of DATED) composed[type]?.sort(byRecency)

  const skills = tailored?.skills?.length ? tailored.skills : plan.skills
  if (skills.length) {
    composed.skills = skills.map(g => ({ ...blankEntry('skills'), id: uid(), skill: g.group === 'Skills' && skills.length === 1 ? '' : g.group, info: g.items.join(', '), level: -1 }))
    const before = plan.skills.map(g => `${g.group}: ${g.items.join(', ')}`).join('\n')
    const after = skills.map(g => `${g.group}: ${g.items.join(', ')}`).join('\n')
    if (before !== after) changes.push({ kind: 'skills', before, after })
  }

  const summary = tailored?.summary || plan.summaries[0] || ''
  if (summary) {
    composed.profile = [{ ...blankEntry('profile'), id: uid(), text: `<p>${esc(summary)}</p>` }]
    if (summary !== plan.summaries[0]) changes.push({ kind: 'summary', before: plan.summaries[0] ?? '', after: summary })
  }

  const spoken = vault.items.find(isSpoken)
  if (spoken?.bullets.length) {
    composed.languages = spoken.bullets.map(b => {
      const [language, info = ''] = b.text.split(/\s+[–—-]\s+/)
      return { ...blankEntry('languages'), id: uid(), language, info }
    })
  }

  const sections = ORDER.filter(t => composed[t]?.length).map(type => ({
    id: uid(), type, hidden: false, heading: HEADING[type] ?? SECTION_TYPES[type].label, column: LEFT.has(type) ? 'left' : 'right', entries: composed[type],
  }))

  // Contact details: the vault profile only; anything it doesn't have stays empty.
  const profile = vault.profile ?? {}
  const headline = tailored?.headline || plan.headline
  if (headline && headline !== plan.headline) changes.unshift({ kind: 'title', before: plan.headline, after: headline })
  const personal = {
    fullName: profile.fullName ?? '', jobTitle: headline ?? '', email: profile.email ?? '', phone: profile.phone ?? '',
    location: profile.location ?? '', photo: profile.photo ?? '',
    links: (profile.links ?? []).map(l => ({ id: uid(), type: l.type, value: l.value })),
  }

  const resume = {
    id: uid(), name, label, updatedAt: Date.now(), personal, sections, optimize: {},
    settings: { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(template.settings), templateId: template.id },
    // Tailored wording stays on this resume: sync links it back to the vault bullet it came from instead
    // of adding a near-duplicate, and skips the generated summary, headline and skills.
    vaultLinks: links,
    vaultSkip: ['summaries', 'skills', 'headline'],
  }
  return { resume, changes }
}
