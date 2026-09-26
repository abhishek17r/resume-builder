// Layout pass: page, columns, header position, margins and entry arrangement, read from the
// geometry of the source PDF. Works on the styled lines (after the text pass tagged their roles).

const PT_TO_MM = 25.4 / 72
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }

export function analyzeLayout(doc, lines) {
  if (!doc) return { settings: { columns: 'one', headerPosition: 'top' }, notes: ['One column (no layout information in this file type)'] }

  const s = {}
  const notes = []
  s.pageFormat = Math.abs(doc.pageW - 612) < 6 ? 'Letter' : 'A4'

  const two = !!doc.side && lines.some(l => l.col === 'side') && lines.some(l => l.col === 'main')
  s.columns = two ? 'two' : 'one'

  const nameLine = lines.find(l => l.role === 'name')
  if (two) {
    s.leftWidth = clamp(Math.round((doc.sideW / doc.pageW) * 100), 25, 50)
    s.headerPosition = nameLine?.col === 'side' ? doc.side : 'top'
    notes.push(`Two columns · sidebar on the ${doc.side} (${s.leftWidth}%)`)
    notes.push(s.headerPosition === 'top' ? 'Header across the top' : `Header in the ${doc.side} sidebar`)
  } else {
    s.headerPosition = 'top'
    notes.push('One column · header on top')
  }

  // Margins: distance from the page edges to the outermost text of the main column.
  const main = lines.filter(l => l.col !== 'side' && l.page === 1)
  if (main.length) {
    const outer = two && doc.side === 'left'
      ? doc.pageW - Math.max(...main.map(l => l.x1))
      : Math.min(...main.map(l => l.x))
    s.marginX = clamp(Math.round(outer * PT_TO_MM), 4, 24)
  }
  const tops = lines.filter(l => l.page === 1).map(l => l.top)
  if (tops.length) s.marginY = clamp(Math.round(Math.min(...tops) * PT_TO_MM), 4, 24)
  notes.push(`Margins ${s.marginX ?? '–'} × ${s.marginY ?? '–'} mm`)

  // Dates beside the title (same baseline, pushed right) or on their own line below it.
  const dates = lines.filter(l => l.role === 'date')
  const beside = dates.filter(d => lines.some(t => t !== d && t.page === d.page && t.col === d.col && Math.abs(t.y - d.y) < 1.5 && t.x < d.x))
  s.datePosition = dates.length && beside.length > dates.length / 2 ? 'right' : 'below'
  s.entryLayout = 'full'
  notes.push(s.datePosition === 'right' ? 'Dates to the right of titles' : 'Dates below titles')

  // Section spacing: typical gap above headings, relative to body size.
  const headings = lines.filter(l => l.role === 'heading' && l.gap != null)
  const gapPt = median(headings.map(h => h.gap * (median(lines.map(l => l.pt)) ?? 10) - h.pt))
  if (gapPt != null && gapPt > 0) s.sectionGap = clamp(Math.round((gapPt * PT_TO_MM) / 1.2), 1, 9)

  return { settings: s, notes }
}
