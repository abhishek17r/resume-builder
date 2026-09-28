import { SECTION_TYPES } from '../sections'

// Job match score: transparent and repeatable. The AI only decides, per requirement, whether the resume
// covers it (covered / partial / missing, see /api/jd/match); the number is computed here:
//   60% requirements  — must-haves weigh 3×, nice-to-haves 1×; partial counts half
//   30% keywords      — the job's ATS keywords found in the resume text (must-have keywords weigh 2×)
//   10% title         — how much of the job title the resume headline (or latest role) shares
// Keywords and title update live as the resume is edited; requirements update on "Re-check".

export const JOB_WEIGHTS = { requirements: 0.6, keywords: 0.3, title: 0.1 }
const STATUS_VALUE = { covered: 1, partial: 0.5, missing: 0 }
const STOP = new Set(['and', 'or', 'the', 'of', 'for', 'in', 'to', 'a', 'an', 'with', 'at', 'on', 'remote', 'hybrid', 'i', 'ii', 'iii'])

const strip = h => (h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ')
const flat = t => ` ${t.toLowerCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ')} `

export function resumeTextFor(resume) {
  const parts = [resume.personal?.jobTitle]
  for (const s of resume.sections) {
    if (s.hidden) continue
    for (const e of s.entries) {
      if (e.hidden) continue
      for (const f of SECTION_TYPES[s.type]?.fields ?? []) if (typeof e[f.key] === 'string') parts.push(strip(e[f.key]))
    }
  }
  return flat(parts.filter(Boolean).join(' \n '))
}

const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Whole-word, case-insensitive; "event-streaming" = "event streaming"; simple plurals.
export function hasTerm(text, term) {
  const k = term.toLowerCase().trim()
  if (!k) return false
  const body = esc(k).replace(/[-\s]+/g, '[-\\s]?')
  return new RegExp(`(^|[^a-z0-9+#])${body}(s|es)?(?=$|[^a-z0-9+#])`, 'i').test(text)
}

// Word stems, so "mentoring engineers" matches "Mentored 8 engineers".
// Plural, then -ing/-ed, then a final e: engineers/engineering → engineer, tuning/tuned/tune → tun.
const stem = w => w.replace(/s$/, '').replace(/(ing|ed)$/, '').replace(/e$/, '').replace(/([^aeiou])\1$/, '$1')
const stemsOf = text => new Set((text.match(/[a-z0-9+#][a-z0-9+#.-]*/g) ?? []).flatMap(w => [w, ...w.split(/[-.]/)]).filter(w => w.length > 1).map(w => (w.length > 3 ? stem(w) : w)))

// A job keyword: found as a phrase, or all its words appear somewhere (found), or at least half (partly).
export function termMatch(text, stems, term) {
  if (hasTerm(text, term)) return 'found'
  const parts = words(term).filter(w => w.length > 1).map(w => (w.length > 3 ? stem(w) : w))
  if (parts.length < 2) return 'missing'
  const have = parts.filter(p => stems.has(p)).length
  return have === parts.length ? 'found' : have / parts.length >= 0.5 ? 'partial' : 'missing'
}

const words = t => (t || '').toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w))

export function jobScore(resume, analysis, match) {
  if (!analysis) return null
  const reqs = analysis.requirements ?? []
  const status = Object.fromEntries((match?.requirements ?? []).map(r => [r.id, r.status]))

  // Requirements
  let got = 0
  let total = 0
  const count = { must: { covered: 0, partial: 0, total: 0 }, nice: { covered: 0, partial: 0, total: 0 } }
  for (const r of reqs) {
    const w = r.importance === 'must' ? 3 : 1
    const st = status[r.id] ?? 'missing'
    total += w
    got += w * STATUS_VALUE[st]
    const c = count[r.importance === 'must' ? 'must' : 'nice']
    c.total++
    if (st !== 'missing') c[st]++
  }
  const requirements = total ? got / total : 0

  // Keywords
  const text = resumeTextFor(resume)
  const byTerm = new Map()
  for (const r of reqs) for (const k of r.keywords ?? []) {
    const key = k.toLowerCase().trim()
    if (!key) continue
    const prev = byTerm.get(key)
    if (!prev || (r.importance === 'must' && prev.importance !== 'must')) byTerm.set(key, { term: k.trim(), importance: r.importance })
  }
  const stems = stemsOf(text)
  const kws = [...byTerm.values()].map(k => { const m = termMatch(text, stems, k.term); return { ...k, match: m, found: m === 'found' } })
  const kwTotal = kws.reduce((n, k) => n + (k.importance === 'must' ? 2 : 1), 0)
  const kwGot = kws.reduce((n, k) => n + (k.importance === 'must' ? 2 : 1) * (k.match === 'found' ? 1 : k.match === 'partial' ? 0.5 : 0), 0)
  const keywords = kwTotal ? kwGot / kwTotal : 1

  // Title
  const company = new Set(words(analysis.company))
  const jd = [...new Set(words(analysis.title))].filter(w => !company.has(w))
  const share = t => { const have = new Set(words(t)); return jd.length ? jd.filter(w => have.has(w)).length / jd.length : 1 }
  const latestRole = resume.sections.find(s => s.type === 'experience' && !s.hidden)?.entries.find(e => !e.hidden)?.jobTitle ?? ''
  const title = Math.max(share(resume.personal?.jobTitle), 0.8 * share(latestRole))

  const overall = Math.round(100 * (JOB_WEIGHTS.requirements * requirements + JOB_WEIGHTS.keywords * keywords + JOB_WEIGHTS.title * title))
  return {
    overall,
    requirements: { score: Math.round(100 * requirements), ...count },
    keywords: {
      score: Math.round(100 * keywords),
      found: kws.filter(k => k.match === 'found'),
      partial: kws.filter(k => k.match === 'partial'),
      missing: kws.filter(k => k.match === 'missing').sort((a, b) => (a.importance === 'must' ? -1 : 1) - (b.importance === 'must' ? -1 : 1)),
    },
    title: { score: Math.round(100 * title), job: analysis.title, resume: resume.personal?.jobTitle || latestRole },
  }
}
