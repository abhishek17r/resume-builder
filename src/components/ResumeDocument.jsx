import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail, Phone, MapPin, Globe, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { SECTION_TYPES, LEVELS } from '../lib/sections'
import { formatRange, isBlankHtml, sanitize, toHref } from '../lib/format'
import { LinkedInIcon, GitHubIcon } from './BrandIcons'
import { ensureFont, fontStack } from '../lib/fonts'

export const PAGE_SIZES = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } }
export const MM = 96 / 25.4 // CSS px per mm

export const LINK_TYPES = {
  linkedin: { label: 'LinkedIn', icon: LinkedInIcon },
  github: { label: 'GitHub', icon: GitHubIcon },
  website: { label: 'Website', icon: Globe },
  other: { label: 'Link', icon: LinkIcon },
}

const family = f => { ensureFont(f); return fontStack(f) }

// Gutters between the side column and the main column, measured from the strip edge.
const SIDE_INNER = 6
const MAIN_INNER = 7

/*
 * How rendering works
 * -------------------
 * 1. buildModel() turns the resume into a flat list of small blocks per column (a heading,
 *    an entry's title line, one bullet, one paragraph…). Each block carries the gap above it
 *    and whether it must stay on the same page as the block after it.
 * 2. A hidden measurer renders every block at its exact column width; we read the heights.
 * 3. paginate() fills pages column by column, starting a new page when the next block (plus
 *    anything it must stay with) doesn't fit.
 * 4. <Sheet> draws one page at true size. The editor preview, full-screen preview and print
 *    all use it, so what you see is exactly what prints.
 */

/* ============================== model ============================== */

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const onColor = bg => (luminance(bg) > 0.45 ? '#1d1d1f' : '#ffffff')

function palette(s) {
  if (s.colorArea === 'full') {
    // The whole page is the accent (single) or side (two-tone) colour; text contrasts automatically.
    const bg = s.colorMode === 'multi' ? s.bg2 : s.accent
    const fg = onColor(bg)
    const tone = { text: fg, accent: fg, bg }
    return { base: tone, strong: tone }
  }
  const base = { text: s.text, accent: s.accent, bg: s.bg }
  const strong = s.colorMode === 'multi' ? { text: s.text2, accent: s.accent2, bg: s.bg2 } : base
  return { base, strong }
}

function geometry(s) {
  const page = PAGE_SIZES[s.pageFormat] ?? PAGE_SIZES.A4
  const mx = s.marginX
  const my = s.marginY
  const two = s.columns === 'two'
  const headerTop = !two || s.headerPosition === 'top'
  const sideRight = two && s.headerPosition === 'right'
  const border = s.colorArea === 'border'
  const multi = s.colorMode === 'multi'
  const strip = two ? (page.w * s.leftWidth) / 100 : 0

  const cols = {}
  if (two) {
    if (sideRight) {
      cols.side = { x: page.w - strip + SIDE_INNER, w: strip - SIDE_INNER - mx }
      cols.main = { x: mx, w: page.w - strip - MAIN_INNER - mx }
    } else {
      cols.side = { x: mx, w: strip - mx - SIDE_INNER }
      cols.main = { x: strip + MAIN_INNER, w: page.w - strip - MAIN_INNER - mx }
    }
  } else {
    cols.main = { x: mx, w: page.w - 2 * mx }
  }

  return {
    page, mx, my, two, headerTop, sideRight, strip, cols, border,
    strongSide: multi && !border && s.colorArea !== 'full' && two && !headerTop,
    strongBand: multi && !border && s.colorArea !== 'full' && headerTop,
    gap: s.sectionGap * 1.2, // mm between sections
  }
}

const entryIsBlank = (type, e) =>
  SECTION_TYPES[type].fields.every(f => (f.kind === 'rich' ? isBlankHtml(e[f.key]) : f.kind === 'level' ? !(e.level >= 0) : !e[f.key]))

const escapeHtml = t => t.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

// Split sanitized rich text into top-level pieces: each list item and each paragraph/line.
function splitRich(html) {
  if (isBlankHtml(html)) return []
  const doc = new DOMParser().parseFromString(`<div>${sanitize(html)}</div>`, 'text/html')
  const out = []
  let inline = ''
  const flush = () => {
    if (!isBlankHtml(inline)) out.push({ kind: 'p', html: `<div>${inline}</div>` })
    inline = ''
  }
  for (const n of doc.body.firstChild.childNodes) {
    if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
      flush()
      let i = 1
      for (const li of n.children) {
        if (li.tagName !== 'LI' || isBlankHtml(li.innerHTML)) continue
        out.push({ kind: n.tagName.toLowerCase(), html: li.outerHTML, start: i++ })
      }
    } else if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV')) {
      flush()
      if (!isBlankHtml(n.innerHTML)) out.push({ kind: 'p', html: n.outerHTML })
    } else if (n.nodeType === 1 && n.tagName === 'BR') {
      flush()
    } else {
      inline += n.nodeType === 1 ? n.outerHTML : escapeHtml(n.textContent)
    }
  }
  flush()
  return out
}

function richBlocks(html, keyBase, { indent, firstGap = 0.5 } = {}) {
  return splitRich(html).map((piece, i) => {
    const inner = piece.kind === 'p'
      ? piece.html
      : `<${piece.kind}${piece.kind === 'ol' ? ` start="${piece.start}"` : ''}>${piece.html}</${piece.kind}>`
    return {
      key: `${keyBase}.r${i}`,
      gap: i === 0 ? firstGap : piece.kind === 'p' ? 0.6 : 0.15,
      el: <div className="rich" style={indent ? { paddingLeft: indent } : undefined} dangerouslySetInnerHTML={{ __html: inner }} />,
    }
  })
}

// Blocks for one section. `narrow` = side/half column (dates always sit below titles there).
function sectionBlocks(section, ctx, tone, narrow) {
  const { s, g } = ctx
  const type = section.type
  const entries = section.entries.filter(e => !e.hidden && !entryIsBlank(type, e))
  if (!entries.length) return []
  const def = SECTION_TYPES[type]
  const E = (s.entryGap ?? 4) * 0.48 // mm between entries
  const blocks = [{
    key: `${section.id}.h`, gap: g.gap, keep: true,
    el: <Heading ctx={ctx} tone={tone} icon={def.icon}>{section.heading}</Heading>,
  }]

  entries.forEach((e, i) => {
    const k = `${section.id}.${e.id}`
    const gap = i === 0 ? 0 : E

    if (type === 'profile') {
      blocks.push(...richBlocks(e.text, k, { firstGap: gap }))
      return
    }
    if (type === 'declaration') {
      blocks.push(...richBlocks(e.text, k, { firstGap: gap }))
      if (e.fullName || e.place) blocks.push({ key: `${k}.sig`, gap: 2, el: <div>{[e.fullName, e.place].filter(Boolean).join(', ')}</div> })
      return
    }
    if (type === 'skills' || type === 'languages' || type === 'interests') {
      blocks.push({ key: k, gap, el: <SkillEntry e={e} type={type} ctx={ctx} tone={tone} /> })
      return
    }
    if (type === 'references') {
      blocks.push({ key: k, gap, el: <ReferenceEntry e={e} ctx={ctx} tone={tone} /> })
      return
    }

    const columns = s.entryLayout === 'columns' && !narrow
    const desc = richBlocks(e.description, k, { indent: columns ? 'calc(24% + 4mm)' : undefined })
    blocks.push({ key: `${k}.t`, gap, keep: desc.length > 0, el: <EntryHeader e={e} type={type} ctx={ctx} tone={tone} narrow={narrow} columns={columns} /> })
    blocks.push(...desc)
  })
  return blocks
}

export function buildModel(resume) {
  const s = resume.settings
  const g = geometry(s)
  const { base, strong } = palette(s)
  const ctx = { s, g, base, strong }
  const sections = resume.sections.filter(x => !x.hidden)
  const sideTone = g.strongSide ? strong : base
  const bandTone = g.strongBand ? strong : base

  const columns = { main: [] }
  const band = g.headerTop ? <Header resume={resume} ctx={ctx} tone={bandTone} inSidebar={false} /> : null

  if (g.two) {
    columns.side = []
    if (!g.headerTop) columns.side.push({ key: 'header', gap: 0, el: <Header resume={resume} ctx={ctx} tone={sideTone} inSidebar /> })
    for (const sec of sections) {
      if (sec.column === 'left') columns.side.push(...sectionBlocks(sec, ctx, sideTone, true))
      else columns.main.push(...sectionBlocks(sec, ctx, base, false))
    }
  } else if (s.columns === 'mix') {
    // Consecutive "half" sections pair up side by side; each pair is placed as one unit.
    for (let i = 0; i < sections.length; i++) {
      const a = sections[i]
      const b = sections[i + 1]
      if (a.column === 'left' && b?.column === 'left') {
        i++
        const halves = [a, b].map(sec => sectionBlocks(sec, ctx, base, true))
        if (!halves[0].length && !halves[1].length) continue
        columns.main.push({
          key: `${a.id}+${b.id}`, gap: g.gap,
          el: (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '7mm' }}>
              {halves.map((blocks, hi) => (
                <div key={hi}>
                  {blocks.map((bl, j) => <div key={bl.key} style={{ marginTop: j === 0 ? 0 : `${bl.gap}mm`, display: 'flow-root' }}>{bl.el}</div>)}
                </div>
              ))}
            </div>
          ),
        })
      } else {
        columns.main.push(...sectionBlocks(a, ctx, base, false))
      }
    }
  } else {
    for (const sec of sections) columns.main.push(...sectionBlocks(sec, ctx, base, false))
  }

  return { resume, ctx, band, columns }
}

/* ============================== pagination ============================== */

function paginate(model, H) {
  const { g } = model.ctx
  const pageH = g.page.h * MM
  const my = g.my * MM
  const bandH = model.band ? H.__band ?? 0 : 0
  const bandGap = model.band ? (g.strongBand ? g.gap * 0.9 : g.gap) * MM : 0
  const top = i => (i === 0 && model.band ? bandH + bandGap : my)
  const cap = i => pageH - top(i) - my

  const out = {}
  for (const [col, blocks] of Object.entries(model.columns)) {
    const pages = [[]]
    let used = 0
    blocks.forEach((b, idx) => {
      let p = pages.length - 1
      const h = H[b.key] ?? 0
      let gap = pages[p].length ? b.gap * MM : 0
      // This block plus the chain of blocks it must stay with (heading → entry title → first bullet).
      let group = gap + h
      for (let j = idx; blocks[j].keep && j + 1 < blocks.length; j++) group += blocks[j + 1].gap * MM + (H[blocks[j + 1].key] ?? 0)
      if (pages[p].length && used + group > cap(p) + 0.5) {
        pages.push([])
        p++
        used = 0
        gap = 0
      }
      pages[p].push({ block: b, gap })
      used += gap + h
    })
    out[col] = pages
  }
  const count = Math.max(...Object.values(out).map(p => p.length))
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    count,
    top: top(i),
    cols: Object.fromEntries(Object.entries(out).map(([c, pages]) => [c, pages[i] ?? []])),
  }))
}

/* ============================== hook ============================== */

// Re-measure when a font this resume uses finishes loading. Other fonts (e.g. the previews in
// Customize → Font) are ignored, and bursts of loads are batched into one re-measure.
function useFontsVersion(families) {
  const [v, setV] = useState(0)
  const key = families.filter(Boolean).join('|')
  useEffect(() => {
    const wanted = new Set(key.split('|'))
    let timer = null
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => setV(x => x + 1), 60) }
    const onDone = e => {
      if (e.fontfaces?.some(f => wanted.has(f.family.replace(/^["']|["']$/g, '')))) bump()
    }
    document.fonts.ready.then(bump)
    document.fonts.addEventListener('loadingdone', onDone)
    return () => { clearTimeout(timer); document.fonts.removeEventListener('loadingdone', onDone) }
  }, [key])
  return v
}

// Lays the resume out into pages. Render the returned `measurer` somewhere in the tree.
export function usePagedLayout(resume) {
  const model = useMemo(() => buildModel(resume), [resume])
  const ref = useRef(null)
  const fonts = useFontsVersion([resume.settings.bodyFont, resume.settings.nameFont])
  const [H, setH] = useState({})

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const next = {}
    for (const el of root.querySelectorAll('[data-k]')) next[el.dataset.k] = el.getBoundingClientRect().height
    setH(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [model, fonts])

  const pages = useMemo(() => paginate(model, H), [model, H])

  const { g } = model.ctx
  const measurer = createPortal(
    <div ref={ref} aria-hidden className="rdoc-measure" style={{ position: 'fixed', left: -100000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      <DocRoot ctx={model.ctx}>
        {model.band && <div data-k="__band" style={{ width: `${g.page.w}mm` }}><Band model={model} /></div>}
        {Object.entries(model.columns).map(([col, blocks]) => (
          <div key={col} style={{ width: `${g.cols[col].w}mm` }}>
            {blocks.map(b => <div key={b.key} data-k={b.key} style={{ display: 'flow-root' }}>{b.el}</div>)}
          </div>
        ))}
      </DocRoot>
    </div>,
    document.body,
  )

  return { pages, model, measurer }
}

/* ============================== page ============================== */

function DocRoot({ ctx, children, style }) {
  const { s } = ctx
  const pt = n => `${n}pt`
  return (
    <div
      className="rdoc"
      style={{
        '--fs-name': pt(s.baseSize + s.nameSize),
        '--fs-title': pt(s.baseSize + s.titleSize),
        '--fs-heading': pt(s.baseSize + s.headingSize),
        '--fs-entry': pt(s.baseSize + s.entrySize),
        fontSize: pt(s.baseSize),
        lineHeight: s.lineHeight,
        fontFamily: family(s.bodyFont),
        textAlign: 'left',
        ...style,
      }}
    >
      <style>{docCss(s)}</style>
      {children}
    </div>
  )
}

function docCss(s) {
  return `
    .rdoc, .rdoc * { box-sizing: border-box; }
    .rdoc p, .rdoc ul, .rdoc ol { margin: 0; }
    .rdoc .rich ul { list-style: ${s.listStyle === 'hyphen' ? '"–  "' : s.listStyle === 'none' ? 'none' : 'disc'}; padding-left: ${s.listStyle === 'none' ? '0' : s.listStyle === 'hyphen' ? '1.1em' : '0.95em'}; }
    .rdoc .rich ol { list-style: decimal; padding-left: 1.4em; }
    .rdoc .rich li::marker { font-size: .9em; }
    .rdoc .rich b, .rdoc .rich strong { font-weight: 700; }
    .rdoc a { color: ${s.linkBlue ? '#1d4ed8' : 'inherit'}; text-decoration: ${s.linkUnderline ? 'underline' : 'none'}; }
  `
}

function Band({ model }) {
  const { g, strong, base } = model.ctx
  return (
    <div style={{
      padding: `${g.my}mm ${g.mx}mm ${g.strongBand ? g.my * 0.8 : 0}mm`,
      background: g.strongBand ? strong.bg : undefined,
      color: g.strongBand ? strong.text : base.text,
    }}>
      {model.band}
    </div>
  )
}

// One page at true size (mm). Scale it with a CSS transform on a wrapper.
export function Sheet({ model, page }) {
  const { s, g, base, strong } = model.ctx
  const r = model.resume
  const footer = [s.footerName && r.personal.fullName, s.footerEmail && r.personal.email].filter(Boolean)
  return (
    <DocRoot ctx={model.ctx} style={{ position: 'relative', overflow: 'hidden', width: `${g.page.w}mm`, height: `${g.page.h}mm`, background: base.bg, color: base.text }}>
      {g.strongSide && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: `${g.strip}mm`, [g.sideRight ? 'right' : 'left']: 0, background: strong.bg }} />
      )}
      {g.border && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '3.5mm', background: s.colorMode === 'multi' ? strong.bg : base.accent }} />
      )}
      {page.index === 0 && model.band && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}><Band model={model} /></div>
      )}
      {Object.entries(page.cols).map(([col, items]) => (
        <div key={col} style={{
          position: 'absolute', top: page.top, left: `${g.cols[col].x}mm`, width: `${g.cols[col].w}mm`,
          color: col === 'side' && g.strongSide ? strong.text : base.text,
        }}>
          {items.map(({ block, gap }) => (
            <div key={block.key} style={{ marginTop: gap, display: 'flow-root' }}>{block.el}</div>
          ))}
        </div>
      ))}
      {(footer.length > 0 || s.footerPageNumbers) && (
        <div style={{ position: 'absolute', left: `${g.mx}mm`, right: `${g.mx}mm`, bottom: `${Math.min(4, g.my * 0.4)}mm`, display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', opacity: 0.7, color: base.text }}>
          <span>{footer.join(' · ')}</span>
          {s.footerPageNumbers && <span>{page.index + 1} / {page.count}</span>}
        </div>
      )}
    </DocRoot>
  )
}

/* ============================== pieces ============================== */

function Header({ resume, ctx, tone, inSidebar }) {
  const { s } = ctx
  const p = resume.personal
  const center = s.headerAlign === 'center' && !inSidebar
  const nameColor = s.applyAccent.name ? tone.accent : tone.text
  const titleColor = s.applyAccent.jobTitle ? tone.accent : tone.text
  const iconColor = s.applyAccent.headerIcons ? tone.accent : tone.text

  const details = [
    p.email && { key: 'email', icon: Mail, text: p.email, href: `mailto:${p.email}` },
    p.phone && { key: 'phone', icon: Phone, text: p.phone, href: `tel:${p.phone.replace(/\s/g, '')}` },
    p.location && { key: 'loc', icon: MapPin, text: p.location },
    ...p.links.filter(l => l.value).map(l => ({ key: l.id, icon: LINK_TYPES[l.type]?.icon ?? LinkIcon, text: l.value, href: toHref(l.value) })),
  ].filter(Boolean)

  const arrangement = s.detailsArrangement
  const stacked = inSidebar && arrangement === 'icon'

  return (
    <div style={{ display: 'flex', gap: '5mm', flexDirection: inSidebar || center ? 'column' : 'row', alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
      {p.photo && s.showPhoto !== false && (
        <img src={p.photo} alt="" style={{
          width: `${s.photoSize ?? 24}mm`, height: `${s.photoSize ?? 24}mm`, objectFit: 'cover', flexShrink: 0,
          borderRadius: { circle: '50%', rounded: '3mm', square: 0 }[s.photoShape ?? 'circle'],
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ fontFamily: family(s.nameFont || s.bodyFont), fontSize: 'var(--fs-name)', fontWeight: 700, lineHeight: 1.1, color: nameColor }}>
          {p.fullName}
        </div>
        {p.jobTitle && (
          <div style={{ fontSize: 'var(--fs-title)', fontStyle: s.titleStyle === 'normal' ? 'normal' : 'italic', marginTop: '1.5mm', color: titleColor, lineHeight: 1.2 }}>{p.jobTitle}</div>
        )}
        {details.length > 0 && (
          <div style={{
            marginTop: '3mm', display: 'flex', flexWrap: 'wrap', flexDirection: stacked ? 'column' : 'row',
            justifyContent: center ? 'center' : 'flex-start', gap: stacked ? '1.1mm' : '1mm 4mm',
          }}>
            {details.map((d, i) => {
              const Icon = d.icon
              return (
                <span key={d.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2mm', overflowWrap: 'anywhere' }}>
                  {arrangement === 'icon' && <IconFrame s={s} color={iconColor} bg={tone.bg}><Icon size="1.05em" strokeWidth={2.2} /></IconFrame>}
                  {arrangement !== 'icon' && i > 0 && <span style={{ color: iconColor, marginLeft: '-2mm' }}>{arrangement === 'bullet' ? '•' : '|'}</span>}
                  {d.href ? <a href={d.href}>{d.text}</a> : d.text}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function IconFrame({ s, color, bg, children }) {
  if (s.iconStyle === 'none') return <span style={{ color, display: 'inline-flex', flexShrink: 0 }}>{children}</span>
  const [shape, variant] = s.iconStyle.split('-') // e.g. "circle-outline"
  const radius = { circle: '50%', rounded: '1.2mm', square: 0 }[shape]
  const outline = variant === 'outline'
  return (
    <span style={{
      background: outline ? 'transparent' : color, color: outline ? color : bg, border: outline ? `0.3mm solid ${color}` : 'none',
      borderRadius: radius, width: '1.9em', height: '1.9em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

function Heading({ ctx, tone, icon: Icon, children }) {
  const { s } = ctx
  const color = s.applyAccent.headings ? tone.accent : tone.text
  const st = {
    fontSize: 'var(--fs-heading)', fontWeight: 700, color, lineHeight: 1.2,
    textTransform: s.headingCaps === 'uppercase' ? 'uppercase' : 'none',
    letterSpacing: s.headingCaps === 'uppercase' ? '0.06em' : 'normal',
    display: 'flex', alignItems: 'center', gap: '2mm',
  }
  const line = `0.35mm solid ${color}`
  switch (s.headingStyle) {
    case 'underline': Object.assign(st, { borderBottom: line, paddingBottom: '1mm' }); break
    case 'overline': Object.assign(st, { borderTop: line, paddingTop: '1mm' }); break
    case 'box': Object.assign(st, { border: line, padding: '0.8mm 2mm', justifyContent: 'center' }); break
    case 'bar': Object.assign(st, { borderLeft: `1.2mm solid ${color}`, paddingLeft: '2mm' }); break
    case 'dotted': Object.assign(st, { borderBottom: `0.45mm dotted ${color}`, paddingBottom: '1mm' }); break
    case 'fill': Object.assign(st, { background: color, color: tone.bg, padding: '1mm 2mm' }); break
    default: break
  }
  const icon = s.headingIcons !== 'none' && Icon && (
    s.headingIcons === 'filled' && s.headingStyle !== 'fill'
      ? <span style={{ background: color, color: tone.bg, borderRadius: '50%', width: '1.5em', height: '1.5em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size="0.85em" strokeWidth={2.4} /></span>
      : <Icon size="1em" strokeWidth={2.2} style={{ flexShrink: 0 }} />
  )
  // Padding (not margin) below, so the measured height includes it.
  return (
    <div style={{ paddingBottom: '1.5mm' }}>
      <div style={st}>
        {icon}
        <span>{children}</span>
        {s.headingStyle === 'line' && <span style={{ flex: 1, height: 0, borderTop: line, marginLeft: '1mm' }} />}
      </div>
    </div>
  )
}

function Level({ level, color }) {
  if (!(level >= 0)) return null
  return (
    <div style={{ display: 'flex', gap: '1mm', marginTop: '1mm' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: '2.2mm', height: '2.2mm', borderRadius: '50%', background: i <= level ? color : 'transparent', border: `0.3mm solid ${color}` }} />
      ))}
    </div>
  )
}

function maybeLink(text, href, showIcon) {
  if (!text) return null
  if (!href) return text
  return (
    <a href={toHref(href)}>
      {text}
      {showIcon && <ExternalLink size="0.8em" style={{ display: 'inline', marginLeft: '0.8mm', verticalAlign: '-0.05em' }} />}
    </a>
  )
}

function SkillEntry({ e, type, ctx, tone }) {
  const { s } = ctx
  const name = e.skill ?? e.language ?? e.interest
  const titleColor = s.applyAccent.entryTitle ? tone.accent : tone.text
  const subColor = s.applyAccent.entrySubtitle ? tone.accent : tone.text
  return (
    <div>
      {name && <div style={{ fontWeight: 700, fontSize: 'var(--fs-entry)', color: titleColor }}>{name}</div>}
      {e.info && <div style={{ color: subColor }}>{e.info}</div>}
      {!e.info && e.level >= 0 && type !== 'interests' && <div>{LEVELS[e.level]}</div>}
      <Level level={e.level} color={tone.accent} />
    </div>
  )
}

function ReferenceEntry({ e, ctx, tone }) {
  const { s } = ctx
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 'var(--fs-entry)', color: s.applyAccent.entryTitle ? tone.accent : tone.text }}>{maybeLink(e.name, e.nameLink, s.linkIcon)}</div>
      {(e.jobTitle || e.organisation) && <div style={{ color: s.applyAccent.entrySubtitle ? tone.accent : tone.text }}>{[e.jobTitle, e.organisation].filter(Boolean).join(', ')}</div>}
      {(e.email || e.phone) && <div>{[e.email, e.phone].filter(Boolean).join(' | ')}</div>}
    </div>
  )
}

function EntryHeader({ e, type, ctx, tone, narrow, columns }) {
  const { s } = ctx
  const def = SECTION_TYPES[type]
  const titleColor = s.applyAccent.entryTitle ? tone.accent : tone.text
  const subColor = s.applyAccent.entrySubtitle ? tone.accent : tone.text
  const dateColor = s.applyAccent.dates ? tone.accent : tone.text

  const [title, subtitle] = def.title(e)
  const [f0, f1] = def.fields
  const titleNode = f0.link ? maybeLink(title, e[`${f0.key}Link`], s.linkIcon) : title
  const subNode = f1?.link ? maybeLink(subtitle, e[`${f1.key}Link`], s.linkIcon) : subtitle
  const hasStart = def.fields.some(f => f.key === 'startDate')
  const dates = formatRange(e.startDate, e.endDate, s.dateFormat, { hasStart, lang: s.language })

  const subStyle = {
    color: subColor,
    fontWeight: s.subtitleStyle === 'bold' || !s.subtitleStyle ? 700 : 400,
    fontStyle: s.subtitleStyle === 'italic' ? 'italic' : 'normal',
  }
  const nextLine = s.subtitlePlacement === 'next'
  const heading = (
    <div style={{ fontSize: 'var(--fs-entry)' }}>
      {title && <span style={{ color: titleColor, fontWeight: 700 }}>{titleNode}</span>}
      {subtitle && (nextLine
        ? <div style={subStyle}>{subNode}</div>
        : <span style={subStyle}>{title ? ', ' : ''}{subNode}</span>)}
    </div>
  )

  if (columns) {
    return (
      <div style={{ display: 'flex', gap: '4mm' }}>
        <div style={{ width: '24%', flexShrink: 0, color: dateColor }}>
          {dates && <div>{dates}</div>}
          {e.location && <div>{e.location}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{heading}</div>
      </div>
    )
  }

  const meta = [dates, e.location].filter(Boolean).join(' | ')
  if (s.datePosition === 'right' && !narrow) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4mm' }}>
        <div style={{ minWidth: 0 }}>{heading}</div>
        {meta && <div style={{ color: dateColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{meta}</div>}
      </div>
    )
  }
  return (
    <div>
      {heading}
      {meta && <div style={{ color: dateColor }}>{meta}</div>}
    </div>
  )
}
