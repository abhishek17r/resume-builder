// Month names and the word for an ongoing role, per resume language.
export const LANGUAGES = {
  en: { label: 'English', present: 'Present', months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  de: { label: 'Deutsch', present: 'Heute', months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] },
  fr: { label: 'Français', present: 'Présent', months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] },
  es: { label: 'Español', present: 'Actualidad', months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] },
  pt: { label: 'Português', present: 'Atual', months: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] },
  it: { label: 'Italiano', present: 'Presente', months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'] },
  nl: { label: 'Nederlands', present: 'Heden', months: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'] },
}

export const DATE_FORMATS = ['MM/YYYY', 'MM-YYYY', 'MMM YYYY', 'MMMM YYYY', 'YYYY']

// `value` is "YYYY-MM" (from <input type="month">) or "".
export function formatMonth(value, fmt, lang = 'en') {
  const MONTHS = (LANGUAGES[lang] ?? LANGUAGES.en).months
  if (!value) return ''
  const [y, m] = value.split('-')
  if (!m) return y // year-only dates (common in imported resumes)
  const mi = Number(m) - 1
  switch (fmt) {
    case 'MM-YYYY': return `${m}-${y}`
    case 'MMM YYYY': return `${MONTHS[mi].slice(0, 3)} ${y}`
    case 'MMMM YYYY': return `${MONTHS[mi]} ${y}`
    case 'YYYY': return y
    default: return `${m}/${y}`
  }
}

export function formatRange(start, end, fmt, { hasStart = true, lang = 'en', presentLabel = (LANGUAGES[lang] ?? LANGUAGES.en).present } = {}) {
  const s = formatMonth(start, fmt, lang)
  const e = end ? formatMonth(end, fmt, lang) : ''
  if (!hasStart) return e
  if (!s && !e) return ''
  if (!s) return e
  return `${s} – ${e || presentLabel}`
}

// Allow only the tags the editor can produce, so pasted HTML can't inject scripts or styles.
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'P', 'BR', 'A', 'DIV', 'SPAN'])

export function sanitize(html = '') {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const walk = node => {
    for (const child of [...node.children]) {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...child.childNodes)
        continue
      }
      const align = child.style?.textAlign
      for (const attr of [...child.attributes]) {
        if (!(child.tagName === 'A' && attr.name === 'href')) child.removeAttribute(attr.name)
      }
      if (align && ['left', 'center', 'right', 'justify'].includes(align)) child.style.textAlign = align
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') || ''
        if (!/^(https?:|mailto:)/i.test(href)) child.removeAttribute('href')
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noreferrer')
      }
      walk(child)
    }
  }
  walk(doc.body.firstChild)
  for (const li of doc.body.firstChild.querySelectorAll('li')) stripLeadingGlyph(li)
  return doc.body.firstChild.innerHTML
}

const GLYPH = /^[\s\u00a0]*[•●▪■◦○◆◇►▸‣⁃∙·➢➤✓✔→»\uf0b7\uf0a7\uf076\uf0d8\uf0fc\uf0a8*][\s\u00a0]*/

// Remove a typed/imported bullet character from the start of a list item (it'd show twice).
function stripLeadingGlyph(el) {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node && !node.nodeValue.trim()) node = walker.nextNode()
  if (node && GLYPH.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(GLYPH, '')
}

export const isBlankHtml = html => !html || !html.replace(/<[^>]*>|&nbsp;/g, '').trim()

export const toHref = v => (/^(https?:|mailto:|tel:)/i.test(v) ? v : `https://${v}`)
