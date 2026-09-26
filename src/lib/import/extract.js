import { mapPdfFont } from '../fonts'

// Turns an uploaded file into { lines, doc }.
//
// lines: reading-order text lines with their styling, e.g.
//   { text, html, pt, size, bold, italic, family, color, x, x1, top, page, col, gap }
//   - pt: font size in points; size: relative to body text (1 = body)
//   - col: 'side' | 'main' | null (two-column PDFs)
//   - html: the line with inline <b>/<i> runs kept
// doc (PDF only): page geometry and backgrounds, used by layout/design analysis
//   { pageW, pageH, side: 'left'|'right'|null, sideW, sideBg, mainBg }

export async function extractLines(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf' || file.type === 'application/pdf') return extractPdf(file)
  if (ext === 'docx') return { lines: await extractDocx(file), doc: null }
  if (['txt', 'md', 'markdown', 'text'].includes(ext) || file.type.startsWith('text/')) return { lines: extractText(await file.text()), doc: null }
  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, Markdown or a resume JSON export.')
}

/* ------------------------------- PDF ------------------------------- */

async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true /* draw glyphs as paths: no web-font loading, which stalls in background tabs */ }).promise
  let doc = null
  const side = []
  const main = []

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    // Colours and filled shapes come from the drawing instructions; no page rendering needed.
    const paint = readPaint(await page.getOperatorList(), pdfjs.OPS)
    const content = await page.getTextContent()
    const segs = pdfSegments(content, page, vp.height, paint)

    if (n === 1) {
      const bands = findBackgrounds(paint.rects, vp.width, vp.height)
      doc = { pageW: vp.width, pageH: vp.height, side: bands.side, sideW: bands.width ?? 0, sideBg: bands.sideBg ?? null, mainBg: bands.mainBg }
    }

    // Column split: the sidebar edge if there is one, else a clear vertical gutter in the text.
    let split = null
    if (doc.side && doc.sideBg) {
      split = doc.side === 'left' ? doc.sideW : vp.width - doc.sideW
    } else {
      split = findColumnSplit(segs, vp.width)
      if (split && n === 1) {
        doc.side = split < vp.width / 2 ? 'left' : 'right'
        doc.sideW = doc.side === 'left' ? split : vp.width - split
      }
    }
    const sideIsLeft = doc.side !== 'right'
    for (const s of segs) {
      s.page = n
      if (split == null) { s.col = null; main.push(s); continue }
      const left = s.x < split - 1
      s.col = left === sideIsLeft ? 'side' : 'main'
      ;(s.col === 'side' ? side : main).push(s)
    }
  }
  if (!side.length && !main.length) throw new Error('No text found in this PDF. Scanned (image-only) PDFs can’t be read.')

  // Read the sidebar (across pages), then the main column.
  const lines = normaliseSizes([...segsToLines(side), ...segsToLines(main)])
  return { lines, doc }
}

const hexOf = args => {
  if (typeof args?.[0] === 'string') return args[0].toLowerCase()
  const v = args.length === 1 ? [args[0], args[0], args[0]] : args.slice(0, 3)
  const scale = v.every(x => x <= 1) ? 255 : 1
  return `#${v.map(x => Math.round(x * scale).toString(16).padStart(2, '0')).join('')}`
}
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

// Walk the page's drawing instructions, tracking the fill colour and transform, to collect:
//   glyphs: every shown character (in content order) with the fill colour it was drawn in
//   rects:  bounding boxes of filled shapes (backgrounds, sidebars) in PDF page coordinates
function readPaint(ops, OPS) {
  const FILLS = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke])
  let state = { fill: '#000000', ctm: [1, 0, 0, 1, 0, 0] }
  const stack = []
  const glyphs = []
  const rects = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    if (fn === OPS.save) stack.push({ ...state })
    else if (fn === OPS.restore) state = stack.pop() ?? state
    else if (fn === OPS.transform) state = { ...state, ctm: mul(state.ctm, args) }
    else if (fn === OPS.setFillRGBColor || fn === OPS.setFillGray) state = { ...state, fill: hexOf(args) }
    else if (fn === OPS.setFillCMYKColor) {
      const [c, m, y, k] = args
      state = { ...state, fill: hexOf([(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)]) }
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      for (const g of args[0] ?? []) {
        if (g && typeof g === 'object' && g.unicode) for (const ch of g.unicode) if (ch.trim()) glyphs.push({ ch, color: state.fill })
      }
    } else if (fn === OPS.constructPath) {
      // [paintOp, pathData, [minX, minY, maxX, maxY]] in this pdf.js version
      const paintOp = args[0]
      const box = args[2]
      if (FILLS.has(paintOp) && box && box.length === 4 && Number.isFinite(box[0])) {
        const pts = [apply(state.ctm, box[0], box[1]), apply(state.ctm, box[2], box[3]), apply(state.ctm, box[0], box[3]), apply(state.ctm, box[2], box[1])]
        const xs = pts.map(p => p[0])
        const ys = pts.map(p => p[1])
        rects.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), color: state.fill })
      }
    }
  }
  return { glyphs, rects }
}

// Page background = a filled shape covering (nearly) the whole page; sidebar = a full-height
// filled band touching the left or right edge, 18–55% of the width, in a different colour.
function findBackgrounds(rects, pageW, pageH) {
  const full = rects.filter(r => r.x1 - r.x0 > pageW * 0.95 && r.y1 - r.y0 > pageH * 0.95)
  const mainBg = full.at(-1)?.color ?? '#ffffff'
  const bands = rects.filter(r => r.y1 - r.y0 > pageH * 0.8 && r.color !== mainBg)
  for (const r of bands) {
    const w = r.x1 - r.x0
    if (w < pageW * 0.18 || w > pageW * 0.55) continue
    if (r.x0 < pageW * 0.02) return { side: 'left', width: r.x1, sideBg: r.color, mainBg }
    if (r.x1 > pageW * 0.98) return { side: 'right', width: pageW - r.x0, sideBg: r.color, mainBg }
  }
  return { side: null, mainBg }
}

// Give each text item the colour its characters were drawn in, by lining up the item's
// characters with the drawn glyph stream (both come from the same content stream, in order).
function colorItems(items, glyphs) {
  let p = 0
  for (const it of items) {
    const counts = {}
    for (const ch of it.str) {
      if (!ch.trim()) continue
      let q = p
      while (q < glyphs.length && q - p < 40 && glyphs[q].ch !== ch) q++
      if (q < glyphs.length && glyphs[q].ch === ch) {
        counts[glyphs[q].color] = (counts[glyphs[q].color] ?? 0) + 1
        p = q + 1
      }
    }
    it.color = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
}

// Group text items into line segments; a big horizontal gap starts a new segment.
function pdfSegments(content, page, pageH, paint) {
  const fontInfo = {}
  const items = content.items
    .filter(it => it.str !== undefined)
    .map(it => {
      const [, , , d, x, y] = it.transform
      if (!fontInfo[it.fontName]) {
        let name = ''
        try { name = page.commonObjs.get(it.fontName)?.name ?? '' } catch { /* not loaded */ }
        fontInfo[it.fontName] = mapPdfFont(name)
      }
      const f = fontInfo[it.fontName]
      return { str: it.str, x, y, w: it.width, size: Math.abs(d) || it.height, bold: f.bold, italic: f.italic, family: f.family, fontRaw: f.raw }
    })
    .filter(it => it.str.trim() || it.w > 0)

  colorItems(items, paint.glyphs) // before sorting: glyphs are in content order
  items.sort((a, b) => b.y - a.y || a.x - b.x)

  const rows = []
  for (const it of items) {
    const row = rows.find(r => Math.abs(r.y - it.y) < Math.max(2, it.size * 0.4))
    if (row) row.items.push(it)
    else rows.push({ y: it.y, items: [it] })
  }

  const segs = []
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x)
    let cur = null
    for (const it of row.items) {
      const gap = cur ? it.x - cur.x1 : 0
      if (!cur || gap > Math.max(24, it.size * 2.5)) {
        cur = { x: it.x, x1: it.x + it.w, y: row.y, parts: [] }
        segs.push(cur)
      } else if (gap > it.size * 0.15 && !cur.parts.at(-1)?.s.endsWith(' ') && !it.str.startsWith(' ')) {
        cur.parts.push({ s: ' ', space: true })
      }
      cur.parts.push({ s: it.str, bold: it.bold, italic: it.italic, size: it.size, family: it.family ?? it.fontRaw, color: it.color })
      cur.x1 = Math.max(cur.x1, it.x + it.w)
    }
  }

  attachBulletGlyphs(segs)

  return segs
    .map(s => {
      const real = s.parts.filter(p => !p.space && p.s.trim())
      if (!real.length) return null
      // A line's style = the style of most of its characters.
      const chars = p => p.s.trim().length
      const total = real.reduce((n, p) => n + chars(p), 0)
      const share = pred => real.filter(pred).reduce((n, p) => n + chars(p), 0) / total
      const pt = Math.max(...real.map(p => p.size))
      const famCount = {}
      for (const p of real) famCount[p.family] = (famCount[p.family] ?? 0) + chars(p)
      const family = Object.entries(famCount).sort((a, b) => b[1] - a[1])[0][0]
      const top = pageH - s.y - pt * 0.85
      return {
        text: s.parts.map(p => p.s).join('').replace(/\s+/g, ' ').trim(),
        html: runsToHtml(s.parts),
        x: s.x, x1: s.x1, y: s.y, top, pt,
        bold: share(p => p.bold) > 0.97, // whole line bold (titles); partial bold stays in html
        italic: share(p => p.italic) > 0.97,
        family: family === 'undefined' ? null : family,
        color: (() => {
          const byColor = {}
          for (const p of real) if (p.color) byColor[p.color] = (byColor[p.color] ?? 0) + chars(p)
          return Object.entries(byColor).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        })(),
      }
    })
    .filter(Boolean)
}

// Some generators draw each bullet dot as its own text item, a little off the text baseline, so it
// lands on a "line" of its own. Attach each lone dot to the text just to its right.
const GLYPH_ONLY = /^[\s•●▪■◦○◆◇►▸‣⁃∙·➢➤✓✔→»\uf0b7\uf0a7\uf076\uf0d8\uf0fc\uf0a8*–-]+$/
function attachBulletGlyphs(segs) {
  for (let i = segs.length - 1; i >= 0; i--) {
    const g = segs[i]
    const text = g.parts.map(p => p.s).join('')
    if (!text.trim() || !GLYPH_ONLY.test(text) || text.trim().length > 2) continue
    const size = Math.max(...g.parts.map(p => p.size ?? 0), 6)
    let best = null
    for (const t of segs) {
      if (t === g) continue
      const dx = t.x - g.x1
      const dy = Math.abs(t.y - g.y)
      if (dx >= -1 && dx < size * 2 && dy < size * 0.9 && (!best || dy < best.dy)) best = { t, dy }
    }
    if (!best) continue
    best.t.parts.unshift({ s: '• ', space: true }) // marker only; html strips it, text keeps it for bullet detection
    best.t.x = Math.min(best.t.x, g.x)
    best.t.hadGlyph = true
    segs.splice(i, 1)
  }
}

const escapeHtml = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Text runs → HTML with <b>/<i> kept. Spaces take the style of the text around them.
function runsToHtml(parts) {
  let html = ''
  let b = false
  let i = false
  const close = () => { if (i) { html += '</i>'; i = false } if (b) { html += '</b>'; b = false } }
  for (const p of parts) {
    if (p.space) { html += ' '; continue }
    if (!!p.bold !== b || !!p.italic !== i) {
      close()
      if (p.bold) { html += '<b>'; b = true }
      if (p.italic) { html += '<i>'; i = true }
    }
    html += escapeHtml(p.s)
  }
  close()
  return html
    .replace(/\s+/g, ' ')
    .replace(/<(b|i)>(\s+)/g, '$2<$1>')
    .replace(/(\s+)<\/(b|i)>/g, '</$2>$1')
    .replace(/<\/b>(\s*)<b>/g, '$1')
    .trim()
}

// Find an x position that no segment crosses, with real content on both sides: a two-column layout.
function findColumnSplit(segs, pageWidth) {
  if (segs.length < 12) return null
  let best = null
  for (let x = pageWidth * 0.2; x <= pageWidth * 0.75; x += 4) {
    const crossing = segs.filter(s => s.x < x - 2 && s.x1 > x + 2).length
    if (crossing > segs.length * 0.04) continue
    const l = segs.filter(s => s.x1 <= x + 2).length
    const r = segs.filter(s => s.x >= x - 2).length
    const score = Math.min(l, r)
    if (score >= 6 && (!best || score > best.score)) best = { x, score }
  }
  return best?.x ?? null
}

function segsToLines(segs) {
  segs.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  return segs.map((s, i) => {
    const prev = segs[i - 1]
    return { ...s, gap: prev && prev.page === s.page ? prev.y - s.y : null }
  })
}

function normaliseSizes(lines) {
  const sizes = lines.filter(l => l.text.length > 25).map(l => l.pt).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] || lines[0]?.pt || 10
  return lines.map(l => ({ ...l, size: +(l.pt / body).toFixed(2), gap: l.gap == null ? null : l.gap / body }))
}

/* ------------------------------- DOCX ------------------------------- */

async function extractDocx(file) {
  const mammoth = (await import('mammoth')).default
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const lines = []
  const walk = el => {
    for (const node of el.children) {
      const tag = node.tagName
      if (tag === 'UL' || tag === 'OL') { walk(node); continue }
      if (tag === 'TABLE') { node.querySelectorAll('p, li').forEach(p => pushBlock(p)); continue }
      pushBlock(node)
    }
  }
  const pushBlock = node => {
    const tag = node.tagName
    const text = node.textContent.replace(/\s+/g, ' ').trim()
    if (!text) return
    const strong = node.querySelector('strong, b')
    const allBold = strong && strong.textContent.replace(/\s+/g, ' ').trim() === text
    const hLevel = /^H(\d)$/.exec(tag)?.[1]
    lines.push({
      text,
      html: node.innerHTML.replace(/<(?!\/?(b|strong|i|em|u)\b)[^>]*>/gi, ''),
      size: hLevel ? Math.max(1.1, 2.2 - hLevel * 0.25) : 1,
      bold: !!allBold || !!hLevel,
      bullet: tag === 'LI',
      heading: !!hLevel,
      x: 0,
      gap: null,
      col: null,
    })
  }
  walk(doc.body)
  if (!lines.length) throw new Error('This document looks empty.')
  return lines
}

/* ------------------------------- text ------------------------------- */

export function extractText(text) {
  const escape = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const lines = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const md = /^(#{1,6})\s+(.*)$/.exec(raw.trim())
    const t = (md ? md[2] : raw).trim()
    if (!t) { if (lines.length) lines.at(-1).blankAfter = true; continue }
    const plain = t.replace(/\*\*(.*?)\*\*/g, '$1')
    const html = escape(t).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    lines.push({
      text: plain,
      html: html !== escape(plain) ? html : null,
      size: md ? Math.max(1.1, 2.2 - md[1].length * 0.25) : 1,
      bold: !!md || /^\*\*.*\*\*$/.test(t),
      heading: !!md,
      x: raw.search(/\S/),
      gap: null,
      col: null,
    })
  }
  return lines
}
