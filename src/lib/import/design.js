// Design pass: fonts, sizes, line height and colours, read from the styled lines.
// Relies on the roles the text pass assigned (name, title, heading, entryTitle, date, body, contact).

import { FONTS } from '../fonts'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const roundTo = (v, step) => Math.round(Math.round(v / step) * step * 100) / 100
const median = a => { const s = [...a].filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]))
const same = (a, b) => a && b && dist(a, b) < 45

// Most common value, weighted by text length.
function dominant(lines, key) {
  const counts = new Map()
  for (const l of lines) {
    const v = l[key]
    if (v == null) continue
    counts.set(v, (counts.get(v) ?? 0) + l.text.length)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// Colours from anti-aliased samples vary a little; cluster to one representative.
function dominantColor(lines) {
  const cols = lines.map(l => ({ c: l.color, w: l.text.length })).filter(x => x.c)
  if (!cols.length) return null
  let best = null
  for (const { c } of cols) {
    const score = cols.filter(o => same(o.c, c)).reduce((n, o) => n + o.w, 0)
    if (!best || score > best.score) best = { c, score }
  }
  return best.c
}

export function analyzeDesign(doc, lines) {
  if (!doc) return { settings: {}, notes: ['Default design (no styling information in this file type)'] }
  const s = {}
  const notes = []
  const by = role => lines.filter(l => l.role === role)
  const body = by('body').filter(l => l.text.length > 3)
  const inSide = l => l.col === 'side'

  // ---------- fonts
  const bodyFamily = dominant(body, 'family')
  const nameFamily = dominant(by('name'), 'family')
  if (bodyFamily && FONTS.some(f => f.name === bodyFamily)) s.bodyFont = bodyFamily
  if (nameFamily && nameFamily !== bodyFamily && FONTS.some(f => f.name === nameFamily)) s.nameFont = nameFamily
  const rawFamilies = [...new Set(lines.map(l => l.family).filter(Boolean))]
  notes.push(s.bodyFont ? `Font: ${s.bodyFont}${s.nameFont ? ` (name in ${s.nameFont})` : ''}` : `Font not matched (${rawFamilies.join(', ') || 'unknown'}) — using default`)

  // ---------- sizes (pt): base = body text; others are offsets from it, as in Customize → Font Size
  const base = roundTo(median(body.map(l => l.pt)) ?? 9, 0.5)
  s.baseSize = clamp(base, 8, 12)
  const size = role => median(by(role).map(l => l.pt))
  const off = (role, step, lo, hi) => { const v = size(role); return v == null ? undefined : clamp(roundTo(v - s.baseSize, step), lo, hi) }
  s.nameSize = off('name', 1, 5, 17)
  s.titleSize = off('title', 0.5, 0, 6)
  s.headingSize = off('heading', 0.5, 0, 6)
  s.entrySize = off('entryTitle', 0.5, 0, 3)
  for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k]
  notes.push(`Sizes: body ${s.baseSize}pt · name ${s.baseSize + (s.nameSize ?? 11)}pt · headings ${s.baseSize + (s.headingSize ?? 3.5)}pt · entry titles ${s.baseSize + (s.entrySize ?? 0.5)}pt`)

  // ---------- line height: baseline distance between wrapped body lines
  const ratios = []
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1]
    const b = lines[i]
    if (a.role === 'body' && b.role === 'body' && a.page === b.page && a.col === b.col && Math.abs(a.pt - b.pt) < 0.2 && a.y > b.y) {
      const r = (a.y - b.y) / b.pt
      if (r > 0.9 && r < 2.2) ratios.push(r)
    }
  }
  const lh = median(ratios)
  if (lh) s.lineHeight = clamp(Math.round(lh * 20) / 20, 1, 2)
  if (s.lineHeight) notes.push(`Line height ${s.lineHeight}`)

  // ---------- colours
  const two = !!doc.sideBg
  const mainLines = lines.filter(l => !inSide(l))
  const sideLines = lines.filter(inSide)
  const text = dominantColor(mainLines.filter(l => l.role === 'body')) ?? dominantColor(mainLines) ?? '#222222'
  const headMain = dominantColor(mainLines.filter(l => l.role === 'heading'))
  s.bg = doc.mainBg ?? '#ffffff'
  s.text = text
  s.accent = headMain ?? text

  if (two && doc.sideBg && dist(doc.sideBg, s.bg) > 40) {
    s.colorMode = 'multi'
    s.colorArea = 'column'
    s.bg2 = doc.sideBg
    const text2 = dominantColor(sideLines.filter(l => l.role === 'body' || l.role === 'contact')) ?? dominantColor(sideLines) ?? '#ffffff'
    s.text2 = text2
    s.accent2 = dominantColor(sideLines.filter(l => l.role === 'heading')) ?? text2
    notes.push('Two-tone colours (sidebar + page)')
  } else {
    s.colorMode = 'single'
    notes.push('Single colour scheme')
  }

  // Which parts use the accent colour: those whose colour matches the accent but not the body text.
  const accentFor = (role, region = mainLines) => {
    const c = dominantColor(region.filter(l => l.role === role))
    return !!c && same(c, s.accent) && !same(s.accent, s.text)
  }
  const nameRegion = by('name')[0] && inSide(by('name')[0]) && s.colorMode === 'multi' ? sideLines : mainLines
  const nameAccent = nameRegion === sideLines ? s.accent2 : s.accent
  const nameText = nameRegion === sideLines ? s.text2 : s.text
  const nameColor = dominantColor(by('name'))
  s.applyAccent = {
    name: !!nameColor && same(nameColor, nameAccent) && !same(nameAccent, nameText),
    jobTitle: accentFor('title'),
    headings: !!headMain && !same(headMain, s.text) ? true : same(s.accent, s.text),
    headerIcons: true,
    dates: accentFor('date'),
    entryTitle: accentFor('entryTitle') || same(s.accent, s.text),
    entrySubtitle: false,
    linkIcons: true,
  }

  // ---------- headings & header details
  const headings = by('heading')
  if (headings.length) s.headingCaps = headings.filter(h => h.text === h.text.toUpperCase()).length > headings.length / 2 ? 'uppercase' : 'capitalize'
  const contacts = by('contact')
  const nameX = by('name')[0]?.x
  if (contacts.length) {
    if (contacts.some(c => / \| /.test(c.text))) s.detailsArrangement = 'bar'
    else if (contacts.some(c => / [•·] /.test(c.text))) s.detailsArrangement = 'bullet'
    else s.detailsArrangement = 'icon'
    // Icons are graphics; their presence shows as contact text indented past the name.
    if (s.detailsArrangement === 'icon' && nameX != null && !contacts.some(c => c.x > nameX + 6)) s.detailsArrangement = 'bar'
  }
  const n = by('name')[0]
  if (n && !inSide(n) && Math.abs((n.x + n.x1) / 2 - doc.pageW / 2) < doc.pageW * 0.05 && n.x > doc.pageW * 0.15) s.headerAlign = 'center'
  s.headingStyle = 'plain'
  s.iconStyle = 'none'

  return { settings: s, notes }
}
