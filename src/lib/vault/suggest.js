import { SECTION_TYPES } from '../sections'
import { bulletScore } from '../optimize/rules'
import { getItems } from '../optimize/bullets'
import { entityOf, itemKey, fingerprint, similar, norm } from './sync'
import { SCORED_KINDS } from './score'

// Vault bullets that could be added to a resume: same company/project (and same role) as an entry
// already on the resume, but not on it yet. The vault is the source; nothing new is invented.
export function vaultCandidates(resume, vault) {
  const items = vault?.items ?? []
  const byKey = new Map(items.map(i => [i.key, i]))
  const out = []
  for (const section of resume.sections) {
    if (section.hidden) continue
    const rich = SECTION_TYPES[section.type]?.fields.find(f => f.kind === 'rich')?.key
    if (!rich) continue
    for (const entry of section.entries) {
      if (entry.hidden) continue
      const ent = entityOf(section, entry)
      if (!ent || !SCORED_KINDS.has(ent.kind) || !ent.title.trim()) continue
      const item = byKey.get(itemKey(ent.kind, ent.title, ent.subtitle))
        ?? items.find(i => i.manual && i.kind === ent.kind && norm(i.title) === norm(ent.title))
      if (!item) continue
      const current = getItems(entry[rich])
      const fps = new Set(current.map(b => fingerprint(b.text)))
      const role = ent.role?.title
      const past = !!(ent.role ? ent.role.end : ent.end)
      const scored = current.map(b => ({ i: b.i, score: bulletScore(b.text, { past }).score }))
      const weakest = scored.reduce((w, b) => (!w || b.score < w.score ? b : w), null)
      for (const b of item.bullets) {
        if (role && b.role && norm(b.role) !== norm(role)) continue // another role at the same company
        if (b.origins.some(fp => fps.has(fp)) || current.some(c => similar(c.text, b.text))) continue
        const { score } = bulletScore(b.text, { past, ignored: new Set(b.ignored ?? []) })
        out.push({
          id: `${entry.id}:${b.id}`,
          target: { sectionId: section.id, entryId: entry.id },
          entryLabel: [role || ent.title, role ? ent.title : ent.subtitle].filter(Boolean).join(' · '),
          bulletCount: current.length,
          weakest: weakest && weakest.score < score ? { ...weakest, text: current[weakest.i].text } : null,
          item, bullet: b, score,
        })
      }
    }
  }
  return out
}

// No job: the strongest bullets, preferring ones that show something the resume doesn't yet (new tags).
export function rankForQuality(cands, vault, resumeId) {
  const covered = new Set((vault?.items ?? []).flatMap(i => i.bullets.filter(b => b.sources.some(s => s.resumeId === resumeId)).flatMap(b => b.tags)))
  return cands
    .filter(c => c.score >= 70)
    .map(c => ({ ...c, newTags: c.bullet.tags.filter(t => !covered.has(t)) }))
    .sort((a, b) => b.score + 12 * b.newTags.length - (a.score + 12 * a.newTags.length))
}

const wordRx = k => new RegExp(`(^|[^a-z0-9])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i')
const WEIGHT = { must: { missing: 3, partial: 2, covered: 0.5 }, nice: { missing: 1.5, partial: 1, covered: 0.25 } }

// With a job: keyword evidence for the job's requirements, weighted towards gaps and must-haves.
export function rankForJob(cands, analysis, match) {
  const status = Object.fromEntries((match?.requirements ?? []).map(r => [r.id, r.status]))
  const reqs = (analysis?.requirements ?? []).map(r => ({ ...r, rx: r.keywords.filter(Boolean).map(wordRx) }))
  return cands
    .map(c => {
      const hits = reqs.filter(r => r.rx.some(rx => rx.test(c.bullet.text)))
      const relevance = hits.reduce((n, r) => n + (WEIGHT[r.importance]?.[status[r.id] ?? 'missing'] ?? 1), 0)
      return { ...c, requirementIds: hits.map(r => r.id), relevance }
    })
    .filter(c => c.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.score - a.score)
}
