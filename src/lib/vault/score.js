import { bulletScore } from '../optimize/rules'

// Vault scoring: the same per-bullet checks as the resume Optimize tab (Impact + Clarity).
// ATS and Completeness are about a whole resume, so they don't apply here.
// Only achievement-style content is scored; skills, education, courses, certifications and summaries aren't bullets.
export const SCORED_KINDS = new Set(['experience', 'projects', 'organisations', 'publications', 'awards', 'other'])

// A bullet belongs to a past role when its role (or the item, if it has no roles) has an end date.
function isPast(item, bullet) {
  const role = item.roles?.find(r => r.title === bullet.role) ?? (item.roles?.length === 1 ? item.roles[0] : null)
  return !!(role ? role.end : item.end)
}

const avg = xs => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

/** → { overall, impact, clarity, count, byBullet: {id: {score, issues}}, byItem: {id: score}, needsWork } */
export function scoreVault(vault) {
  const byBullet = {}
  const byItem = {}
  const all = []
  let impactSum = 0
  let clarityClean = 0
  let needsWork = 0
  for (const item of vault?.items ?? []) {
    if (!SCORED_KINDS.has(item.kind)) continue
    const scores = []
    for (const b of item.bullets) {
      const r = bulletScore(b.text, { past: isPast(item, b), ignored: new Set(b.ignored ?? []) })
      byBullet[b.id] = { score: r.score, issues: r.issues }
      scores.push(r.score)
      all.push(r.score)
      const ig = new Set(b.ignored ?? [])
      const pass = k => r.checks[k] || 0
      impactSum += 50 * Math.max(pass('quantified'), ig.has('metric') ? 1 : 0) + 30 * Math.max(pass('strong'), ig.has('weak-verb') ? 1 : 0) + 20 * Math.max(pass('goodLength'), ig.has('long') || ig.has('short') ? 1 : 0)
      if (!r.issues.some(i => i.group === 'clarity' && i.severity !== 'info')) clarityClean++
      if (r.score < 70) needsWork++
    }
    byItem[item.id] = avg(scores)
  }
  const count = all.length
  return {
    overall: avg(all),
    impact: count ? Math.round(impactSum / count) : null,
    clarity: count ? Math.round((100 * clarityClean) / count) : null,
    count,
    byBullet,
    byItem,
    needsWork,
  }
}

export const scoreTone = s => (s == null ? 'text-slate-400' : s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-600' : 'text-rose-600')
export const scoreBg = s => (s == null ? 'bg-slate-100 text-slate-500' : s >= 80 ? 'bg-emerald-50 text-emerald-700' : s >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')
