import { SECTION_TYPES } from '../sections'
import { isBlankHtml } from '../format'
import { getItems } from './bullets'
import { refKey } from './serialize'

// Rule-based quality checks: instant, local, explainable. Every issue points at a place in the
// resume and says why it matters. Scores come from these issues, never from a black box.

export const GROUPS = {
  ats: { label: 'ATS readiness', weight: 0.25, blurb: 'Can applicant tracking systems read it?' },
  impact: { label: 'Impact', weight: 0.35, blurb: 'Do bullets show results, with strong verbs?' },
  clarity: { label: 'Clarity', weight: 0.2, blurb: 'Is it concise, consistent and cliché-free?' },
  completeness: { label: 'Completeness', weight: 0.2, blurb: 'Are the sections recruiters expect there?' },
}

const PENALTY = { high: 18, medium: 9, low: 4, info: 0 }

const WEAK_OPENERS = /^(responsible for|responsibilities included|duties included|helped( to)?|assisted( with| in)?|worked on|worked with|involved in|participated in|tasked with|in charge of|handled|was part of|contributed to)\b/i
const FIRST_PERSON = /\b(I|me|my|mine|myself)\b/
const CLICHES = ['team player', 'hard worker', 'hard-working', 'go-getter', 'detail-oriented', 'results-driven', 'self-starter', 'think outside the box', 'synergy', 'dynamic', 'passionate about', 'proven track record', 'best of breed', 'go-to person', 'value add', 'rockstar', 'ninja']
const PRESENT_VERBS = new Set('lead manage build develop drive own design create deliver launch run oversee maintain support implement coordinate write analyze analyse improve grow partner define ship scale mentor'.split(' '))
const NUMBER = /(\d|%|\$|€|£|₹|\bx\d|\btwice\b|\bdoubled\b|\btripled\b|\bhalved\b)/i
const ACTION_SECTIONS = new Set(['experience', 'projects', 'organisations'])
const STANDARD_HEADING = {
  profile: /profile|summary|about|objective/i, experience: /experience|employment|work|career/i, education: /education|academic/i,
  skills: /skill|competenc|expertise|technolog/i, languages: /language/i, projects: /project/i, certificates: /certif|licen/i,
  courses: /course|training/i, awards: /award|honou?r|achievement/i, organisations: /volunteer|organi|leadership|activit/i,
  publications: /publication|research/i, interests: /interest|hobb/i, references: /reference/i, declaration: /declaration/i,
}

const words = t => (t.match(/\S+/g) ?? []).length
const monthIndex = v => {
  if (!v) return null
  const [y, m] = v.split('-').map(Number)
  return y * 12 + ((m || 1) - 1)
}

export function analyzeQuality(resume, { pages = 1 } = {}) {
  const issues = []
  const add = (group, severity, check, title, detail, target = null, extra = {}) =>
    issues.push({ id: `${check}:${target ? refKey(target.sectionId, target.entryId, target.bullet) : 'doc'}`, group, severity, check, title, detail, target, ...extra })

  const p = resume.personal
  const s = resume.settings
  const sections = resume.sections.filter(x => !x.hidden)
  const byType = type => sections.filter(x => x.type === type)

  /* ---------- ATS readiness ---------- */
  if (!p.fullName?.trim()) add('ats', 'high', 'name', 'Name is missing', 'Every ATS and recruiter needs your name at the top.')
  if (!p.email?.trim()) add('ats', 'high', 'email', 'No email address', 'Without an email address, recruiters can’t reply.')
  if (!p.phone?.trim()) add('ats', 'low', 'phone', 'No phone number', 'Many recruiters call first. Add a phone number.')
  if (!p.location?.trim()) add('ats', 'low', 'location', 'No location', 'ATS filters often use location. City and country is enough.')
  if (pages > 2) add('ats', 'medium', 'length', `${pages} pages long`, 'Keep it to one page (early career) or two pages at most.')
  if (s.columns === 'two' || s.columns === 'mix') add('ats', 'info', 'columns', 'Multi-column layout', 'Most modern ATS handle columns, but some older ones read them out of order. Keep a one-column version for online applications.')
  if (p.photo && s.showPhoto !== false) add('ats', 'low', 'photo', 'Photo included', 'In the US, UK and Canada photos are usually left off to avoid bias filters.')
  for (const sec of sections) {
    const rx = STANDARD_HEADING[sec.type]
    if (sec.type === 'custom' || (rx && !rx.test(sec.heading))) {
      add('ats', 'low', 'heading', `Uncommon heading “${sec.heading}”`, 'ATS look for standard headings like “Experience”, “Education”, “Skills”. Rename it if it covers one of those.', { sectionId: sec.id, entryId: null, bullet: -1 })
    }
  }
  for (const sec of byType('experience')) {
    for (const e of sec.entries.filter(x => !x.hidden)) {
      const t = { sectionId: sec.id, entryId: e.id, bullet: -1 }
      if (!e.startDate) add('ats', 'medium', 'dates', `No start date: ${e.jobTitle || 'role'}`, 'ATS calculate years of experience from dates.', t)
      else if (e.endDate && monthIndex(e.endDate) < monthIndex(e.startDate)) add('ats', 'high', 'dates-order', `End date before start date: ${e.jobTitle || 'role'}`, 'Check the dates on this role.', t)
    }
  }

  /* ---------- Impact (per bullet in experience-like sections) ---------- */
  let bulletCount = 0
  let quantified = 0
  let strong = 0
  let goodLength = 0
  const openers = {}
  const expEntries = []
  for (const sec of sections.filter(x => ACTION_SECTIONS.has(x.type))) {
    for (const e of sec.entries.filter(x => !x.hidden)) {
      const items = getItems(e.description)
      if (sec.type === 'experience') expEntries.push({ sec, e, items })
      const past = !!e.endDate
      for (const it of items) {
        bulletCount++
        const target = { sectionId: sec.id, entryId: e.id, bullet: it.i }
        const n = words(it.text)
        const first = it.text.split(/\s+/)[0]?.replace(/[^A-Za-z]/g, '').toLowerCase()
        if (first) openers[first] = (openers[first] ?? 0) + 1

        if (NUMBER.test(it.text)) quantified++
        else add('impact', 'low', 'metric', 'No measurable result', 'Add a number: %, $, time saved, users, team size. Recruiters scan for results.', target, { text: it.text, ai: true })

        if (WEAK_OPENERS.test(it.text)) add('impact', 'medium', 'weak-verb', `Weak opening: “${it.text.match(WEAK_OPENERS)[0]}”`, 'Start with a strong action verb that says what you did (Led, Built, Cut, Launched…).', target, { text: it.text, ai: true })
        else strong++

        if (n > 38) add('impact', 'low', 'long', `Long bullet (${n} words)`, 'Aim for 1–2 lines (about 15–30 words) so it can be skimmed.', target, { text: it.text, ai: true })
        else if (n < 5) add('impact', 'low', 'short', 'Very short bullet', 'Say what you did and what changed as a result.', target, { text: it.text, ai: true })
        else goodLength++

        if (past && first && PRESENT_VERBS.has(first)) add('clarity', 'low', 'tense', 'Present tense in a past role', `Use past tense for roles you’ve left (“${first}” → “${pastOf(first)}”).`, target, { text: it.text, fix: 'tense' })
        if (FIRST_PERSON.test(it.text)) add('clarity', 'low', 'first-person', 'First person (“I”, “my”)', 'Resumes are written without pronouns: start with the verb.', target, { text: it.text, fix: 'first-person' })
        const cliche = CLICHES.find(c => it.text.toLowerCase().includes(c))
        if (cliche) add('clarity', 'low', 'cliche', `Cliché: “${cliche}”`, 'Replace with a specific example that shows it.', target, { text: it.text, ai: true })
        if (/ {2,}|\s+[,.;]/.test(it.text)) add('clarity', 'info', 'spacing', 'Extra spaces', 'Tidy up double spaces.', target, { fix: 'spacing' })
      }
    }
  }
  expEntries.forEach(({ sec, e, items }, idx) => {
    const t = { sectionId: sec.id, entryId: e.id, bullet: -1 }
    if (!items.length) add('completeness', 'medium', 'no-bullets', `No description: ${e.jobTitle || 'role'}`, 'Add 3–5 bullets on what you achieved.', t)
    else if (idx < 2 && items.length < 3) add('impact', 'low', 'few-bullets', `Only ${items.length} bullet${items.length === 1 ? '' : 's'}: ${e.jobTitle || 'role'}`, 'Recent roles deserve 3–6 bullets.', t)
    else if (items.length > 7) add('clarity', 'low', 'many-bullets', `${items.length} bullets: ${e.jobTitle || 'role'}`, 'Keep the 5–6 strongest; long lists hide your best work.', t)
  })
  for (const [verb, count] of Object.entries(openers)) {
    if (count >= 3 && verb.length > 2) add('clarity', 'low', `repeat-${verb}`, `“${cap(verb)}” starts ${count} bullets`, 'Vary your verbs: Built, Launched, Scaled, Reduced, Designed…')
  }

  /* ---------- Clarity: summary ---------- */
  const profile = byType('profile')[0]
  const summaryText = profile ? profile.entries.map(e => e.text || '').join(' ').replace(/<[^>]+>/g, ' ') : ''
  if (profile && words(summaryText) > 90) add('clarity', 'low', 'summary-long', `Summary is ${words(summaryText)} words`, 'Keep it to 2–4 lines (about 40–80 words).', { sectionId: profile.id, entryId: profile.entries[0]?.id ?? null, bullet: -1 })
  if (profile && FIRST_PERSON.test(summaryText)) add('clarity', 'info', 'summary-first-person', 'Summary uses “I”', 'Optional in a summary, but dropping pronouns reads tighter.', { sectionId: profile.id, entryId: profile.entries[0]?.id ?? null, bullet: -1 })
  const summaryCliche = CLICHES.find(c => summaryText.toLowerCase().includes(c))
  if (summaryCliche) add('clarity', 'low', 'summary-cliche', `Cliché in summary: “${summaryCliche}”`, 'Replace it with something only you can say.', { sectionId: profile.id, entryId: profile.entries[0]?.id ?? null, bullet: -1 })

  /* ---------- Completeness ---------- */
  if (!profile || isBlankHtml(summaryText)) add('completeness', 'medium', 'summary', 'No profile summary', 'Two or three lines on who you are and what you’re great at help recruiters place you fast.')
  if (!expEntries.length) add('completeness', 'high', 'experience', 'No work experience', 'Add an Experience section, including internships or projects if you’re early in your career.')
  if (!byType('education').some(x => x.entries.length)) add('completeness', 'medium', 'education', 'No education', 'Most roles expect an Education section.')
  if (!byType('skills').some(x => x.entries.length)) add('completeness', 'medium', 'skills', 'No skills section', 'A skills section is where ATS keyword matching starts.')
  if (!p.links?.some(l => l.value)) add('completeness', 'low', 'links', 'No LinkedIn or portfolio link', 'Recruiters usually check LinkedIn; add it, or a portfolio or GitHub.')
  // gaps > 6 months between consecutive roles (sorted by start)
  const roles = expEntries.map(x => x.e).filter(e => e.startDate).sort((a, b) => monthIndex(b.startDate) - monthIndex(a.startDate))
  for (let i = 0; i < roles.length - 1; i++) {
    const newer = roles[i]
    const older = roles[i + 1]
    if (!older.endDate) continue
    const gap = monthIndex(newer.startDate) - monthIndex(older.endDate)
    if (gap > 6) add('completeness', 'info', `gap-${older.id}`, `${gap}-month gap before ${newer.jobTitle || 'a role'}`, 'Gaps are fine; consider a line explaining it (study, caregiving, travel, freelance).')
  }

  return score(issues, { bulletCount, quantified, strong, goodLength })
}

function score(issues, stats) {
  const groups = {}
  for (const key of Object.keys(GROUPS)) {
    const penalty = issues.filter(i => i.group === key).reduce((n, i) => n + PENALTY[i.severity], 0)
    groups[key] = Math.max(0, 100 - penalty)
  }
  // Impact blends bullet ratios with its structural issues, so one long resume isn't punished per bullet.
  if (stats.bulletCount) {
    const ratio = 0.5 * (stats.quantified / stats.bulletCount) + 0.3 * (stats.strong / stats.bulletCount) + 0.2 * (stats.goodLength / stats.bulletCount)
    const structural = issues.filter(i => i.group === 'impact' && i.check === 'few-bullets').length * PENALTY.low
    groups.impact = Math.max(0, Math.round(ratio * 100) - structural)
  } else groups.impact = 0
  const overall = Math.round(Object.entries(GROUPS).reduce((n, [k, g]) => n + groups[k] * g.weight, 0))
  return { overall, groups, issues, stats }
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
const IRREGULAR = { lead: 'led', build: 'built', run: 'ran', write: 'wrote', drive: 'drove', grow: 'grew', own: 'owned', oversee: 'oversaw', ship: 'shipped', scale: 'scaled' }
export const pastOf = v => IRREGULAR[v] ?? (v.endsWith('e') ? `${v}d` : v.endsWith('y') ? `${v.slice(0, -1)}ied` : `${v}ed`)

// Deterministic fixes the app can apply without AI.
export function autoFixText(fix, text) {
  if (fix === 'spacing') return text.replace(/ {2,}/g, ' ').replace(/\s+([,.;])/g, '$1')
  if (fix === 'first-person') return text.replace(/^\s*(I|We)\s+/, '').replace(/\b(my|our)\s+/gi, '').replace(/^\w/, c => c.toUpperCase())
  if (fix === 'tense') {
    return text.replace(/^(\s*)([A-Za-z]+)/, (_, sp, w) => {
      const lower = w.toLowerCase()
      if (!PRESENT_VERBS.has(lower)) return sp + w
      const past = pastOf(lower)
      return sp + (w[0] === w[0].toUpperCase() ? cap(past) : past)
    })
  }
  return text
}
