import { API_URL } from './api'

// Resume → PDF file, saved straight to the browser's download folder (no print dialog).
// The local server renders the paged preview (#print-root) with the Chrome already on this computer,
// so the PDF matches the preview exactly. Without the server, it falls back to the print dialog.

const COUNTS_KEY = 'rw.downloads' // { "Jane_Doe_Resume_30092026": 2, … }

const readCounts = () => { try { return JSON.parse(localStorage.getItem(COUNTS_KEY)) ?? {} } catch { return {} } }

// Jane_Doe_Resume_30092026(1).pdf, then (2), (3)… for each download of the same name on the same day.
export function nextFileName(fullName, fallback = 'Resume', now = new Date()) {
  const name = (fullName || fallback).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '_') || 'Resume'
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const base = `${name}_Resume_${dd}${mm}${now.getFullYear()}`
  const counts = readCounts()
  const n = (counts[base] ?? 0) + 1
  // Keep only today's counters so the list doesn't grow forever.
  const kept = Object.fromEntries(Object.entries(counts).filter(([k]) => k.endsWith(`_${dd}${mm}${now.getFullYear()}`)))
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify({ ...kept, [base]: n })) } catch { /* private mode: numbering restarts */ }
  return `${base}(${n}).pdf`
}

// A standalone copy of the paged preview: the app's styles, the page size, and the sheets.
function printDocument(page, title) {
  const root = document.getElementById('print-root')
  if (!root) throw new Error('The preview isn’t ready yet.')
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n')
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${esc(title)}</title>
${styles}
<style>@page { size: ${page.w}mm ${page.h}mm; margin: 0; } html, body { margin: 0; background: #fff; } #print-root { display: block !important; }</style>
</head><body>${root.outerHTML}</body></html>`
}

function save(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function printDialog(page, title) {
  const style = document.createElement('style')
  style.textContent = `@page { size: ${page.w}mm ${page.h}mm; margin: 0; }`
  document.head.appendChild(style)
  const prevTitle = document.title
  document.title = title
  window.print()
  document.title = prevTitle
  style.remove()
}

/** → { ok: true, fileName } when saved, or { ok: false, fallback: 'print', reason } when the print dialog was used. */
export async function downloadResume({ fullName, name, page }) {
  const fileName = nextFileName(fullName, name)
  const title = fileName.replace(/\.pdf$/, '')
  let reason
  try {
    const res = await fetch(`${API_URL}/api/pdf`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: printDocument(page, title) }),
    })
    if (res.ok) {
      save(await res.blob(), fileName)
      return { ok: true, fileName }
    }
    reason = (await res.json().catch(() => null))?.error?.message ?? `PDF failed (${res.status})`
  } catch {
    reason = 'The local server isn’t running'
  }
  printDialog(page, title)
  return { ok: false, fallback: 'print', reason }
}
