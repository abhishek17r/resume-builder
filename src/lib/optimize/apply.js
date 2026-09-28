import { SECTION_TYPES } from '../sections'
import { uid } from '../defaults'
import { setItem, moveItemUp, getItems, appendBullet } from './bullets'
import { autoFixText } from './rules'

const richKey = type => SECTION_TYPES[type]?.fields.find(f => f.kind === 'rich')?.key
const escHtml = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Apply an optimiser edit to a resume draft in place. Returns false if its target no longer exists.
// edit: { kind, target: { sectionId, entryId, bullet }, after, fix? }
//   kind: rewrite_bullet | rewrite_summary | add_skill | move_bullet_up | autofix | add_bullet (after = text, html? = formatted)
export function applyEditTo(r, edit) {
  const { kind, target = {}, after = '' } = edit
  const sec = r.sections.find(s => s.id === target.sectionId)
  if (!sec) return false
  const entry = sec.entries.find(e => e.id === target.entryId)
  const key = richKey(sec.type)

  if (kind === 'rewrite_summary') {
    const e = entry ?? sec.entries[0]
    if (!e) return false
    e.text = `<p>${escHtml(after.trim())}</p>`
    return true
  }
  if (kind === 'add_skill') {
    if (entry && 'info' in entry) {
      const have = (entry.info || '').toLowerCase()
      const add = after.split(/\s*,\s*/).filter(x => x && !have.includes(x.toLowerCase()))
      if (add.length) entry.info = [entry.info, add.join(', ')].filter(Boolean).join(', ')
    } else sec.entries.push({ id: uid(), skill: after.trim(), info: '', level: -1 })
    return true
  }
  if (!entry) return false
  if (kind === 'rewrite_bullet') {
    if (!key) {
      if ('info' in entry) { entry.info = after.trim(); return true }
      return false
    }
    if (!getItems(entry[key])[target.bullet]) return false
    entry[key] = setItem(entry[key], target.bullet, after)
    return true
  }
  if (kind === 'add_bullet' && key) {
    entry[key] = appendBullet(entry[key], edit.html || escHtml(after.trim()))
    return true
  }
  if (kind === 'move_bullet_up' && key) {
    entry[key] = moveItemUp(entry[key], target.bullet)
    return true
  }
  if (kind === 'autofix' && key) {
    const item = getItems(entry[key])[target.bullet]
    if (!item) return false
    entry[key] = setItem(entry[key], target.bullet, autoFixText(edit.fix, item.text))
    return true
  }
  return false
}
