import { uid, DEFAULT_SETTINGS } from '../defaults'
import { SECTION_TYPES } from '../sections'

// Heuristic resume parser: lines (from extract.js) → a resume object in this app's format.
// It aims to get the structure right (sections, entries, dates, bullets) so editing is quick;
// the user reviews everything afterwards.

const HEADINGS = [
  ['profile', /^(profile|professional profile|summary|professional summary|career summary|executive summary|about( me)?|objective|career objective|personal statement|overview)$/],
  ['experience', /^((professional|work|relevant|career|employment)\s+)?(experience|history)$|^employment$|^work$|^career$|^experience$|^positions?( held)?$/],
  ['education', /^(education|academic background|academics|education (and|&) training|qualifications|academic qualifications)$/],
  ['skills', /^((technical|core|key|professional|relevant)\s+)?(skills|competencies|expertise|skill set|skills (and|&) (tools|expertise|interests))$|^technologies$|^tools$|^tech stack$|^areas of expertise$/],
  ['languages', /^languages?$/],
  ['projects', /^((personal|selected|key|side|academic)\s+)?projects$/],
  ['certificates', /^(certifications?|certificates?|licen[sc]es?( (and|&) certifications?)?|certifications? (and|&) licen[sc]es?)$/],
  ['courses', /^(courses?|coursework|trainings?|relevant coursework|professional development)$/],
  ['awards', /^(awards?|honou?rs?|achievements?|awards? (and|&) (honou?rs|achievements))$/],
  ['interests', /^(interests|hobbies|hobbies (and|&) interests|personal interests)$/],
  ['publications', /^(publications?|papers|research)$/],
  ['organisations', /^(volunteering|volunteer (work|experience)|organi[sz]ations|leadership|activities|extracurricular activities|memberships|affiliations)$/],
  ['references', /^(references?|referees)$/],
  ['declaration', /^declaration$/],
]

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
const MONTH_RX = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'
// Standalone dates only: "Code2040" or "×2019x" aren't dates.
const DATE_RX = `(?<![A-Za-z0-9])(?:${MONTH_RX}\\s*,?\\s*\\d{4}|\\d{1,2}\\s*[/.-]\\s*\\d{4}|\\d{4}\\s*[/.-]\\s*\\d{1,2}|(?:19|20)\\d{2})(?![0-9])`
const PRESENT_RX = '(?:present|current|now|today|ongoing|till date|to date)'
export const RANGE = new RegExp(`(${DATE_RX})\\s*(?:[-–—~]|to|until|till)\\s*(${DATE_RX}|${PRESENT_RX})`, 'i')
const SINGLE = new RegExp(`(${DATE_RX})`, 'i')
// A date ending a title line ("…, Amazon Web Services 11/2022"), but not a sentence's "…in 2020".
const TRAILING = new RegExp(`\\S\\s+(${DATE_RX})\\s*$`, 'i')
const LEADING = new RegExp(`^\\s*(${DATE_RX})\\s+\\S`, 'i')
const trailingDate = t => TRAILING.test(t) && !/\b(in|since|by|from|of|until|during|to|for|and)\s+\S+\s*$/i.test(t)
// A title line that starts or ends with its date (dates in a left column, or right-aligned).
const edgeDate = t => trailingDate(t) || LEADING.test(t)

export const BULLET_GLYPHS = '•●▪■◦○◆◇►▸‣⁃∙·➢➤✓✔→»\uf0b7\uf0a7\uf076\uf0d8\uf0fc\uf0a8'
const BULLET = new RegExp(`^\\s*(?:[${BULLET_GLYPHS}*]\\s*|[–—-]\\s+|\\d{1,2}[.)]\\s+)`)
const BULLET_HTML = new RegExp(`^(\\s*(?:<[^>]+>\\s*)*)(?:[${BULLET_GLYPHS}*]\\s*|[–—-]\\s+)`)
export const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
export const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/
const URL = /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[\w\-/%]+|github\.com\/[\w\-/]+|[\w-]+\.(?:com|io|dev|me|net|org|design|co|app|ai|xyz|page|site|in|uk)(?:\/[\w\-/.%]*)?))/gi

const clean = t => t.replace(/\s+/g, ' ').trim()
const stripBullet = t => t.replace(BULLET, '').trim()
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

export function toMonth(raw) {
  if (!raw) return ''
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (new RegExp(`^${PRESENT_RX}$`).test(s)) return ''
  let m = new RegExp(`^(${MONTH_RX})\\s*,?\\s*(\\d{4})$`).exec(s)
  if (m) return `${m[2]}-${String(MONTHS[m[1].replace('.', '').slice(0, 3)]).padStart(2, '0')}`
  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(s)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  m = /^(\d{4})\s*[/.-]\s*(\d{1,2})$/.exec(s)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  m = /^(\d{4})$/.exec(s)
  if (m) return m[1] // year only
  return ''
}

// Pull a date range out of a line; returns the dates and the line with them removed.
export function takeDates(text) {
  let m = RANGE.exec(text)
  if (m) {
    const rest = clean(text.replace(m[0], ' ').replace(/[|,•·–—-]\s*$/, '').replace(/^\s*[|,•·–—-]/, '').replace(/\(\s*\)/, ''))
    return { startDate: toMonth(m[1]), endDate: toMonth(m[2]), found: true, rest }
  }
  m = SINGLE.exec(text)
  // On a long line, only a date at its end counts (a title followed by its date).
  const tail = text.length >= 60 ? (trailingDate(text) ? TRAILING.exec(text) : LEADING.exec(text)) : null
  if (tail) m = [tail[1], tail[1]]
  if (m && (text.trim() === m[0].trim() || /[|•·]/.test(text) || text.length < 60 || tail)) {
    // A lone year inside a sentence ("grew 2020 revenue") isn't a date line.
    const rest = clean(text.replace(m[0], ' ').replace(/\s*[|•·,]\s*$/, '').replace(/^\s*[|•·,]\s*/, ''))
    if (rest.split(' ').length > 12) return { found: false, rest: text }
    return { startDate: '', endDate: toMonth(m[1]), found: true, rest, single: true }
  }
  return { found: false, rest: text }
}

function headingType(text, lenient = false) {
  const t = text.toLowerCase().replace(/[:：]$/, '').replace(/[^a-z&\s]/g, '').replace(/\s+/g, ' ').trim()
  if (!t || t.split(' ').length > 5) return null
  for (const [type, rx] of HEADINGS) if (rx.test(t)) return type
  // Short, emphasised headings built around a telling word: "Profile Summary", "Career Profile"…
  // Only for lines styled as headings — "experience building two-sided" in a paragraph isn't one.
  if (lenient && t.split(' ').length <= 3) {
    if (/\b(profile|summary|objective|about)\b/.test(t)) return 'profile'
    if (/\b(experience|employment)\b/.test(t)) return 'experience'
    if (/\beducation\b/.test(t)) return 'education'
    if (/\bskills?\b/.test(t)) return 'skills'
    if (/\bprojects?\b/.test(t)) return 'projects'
    if (/\bcertifications?\b/.test(t)) return 'certificates'
  }
  return null
}

const looksEmphasised = (line, bodyBold) => {
  const text = line.text.replace(/[:：]$/, '')
  return !!(line.heading || line.size >= 1.15 || (line.bold && !bodyBold) || (text === text.toUpperCase() && /[A-Z]{3}/.test(text)))
}

// The document's section-heading style, learned from lines that are clearly headings ("Experience", "Skills"…).
// When most of them share a size and case, a smaller line that happens to say "Languages" or "Projects"
// (a skill group, a sub-heading) isn't a section heading.
function headingStyle(lines, bodyBold) {
  const sure = lines.filter(l => l.text.length <= 40 && !BULLET.test(l.text) && !l.heading && looksEmphasised(l, bodyBold) && headingType(l.text.replace(/[:：]$/, '')))
  if (sure.length < 3) return null
  const bucket = l => Math.round(l.size * 20) / 20
  const counts = new Map()
  for (const l of sure) counts.set(bucket(l), (counts.get(bucket(l)) ?? 0) + 1)
  const [size, n] = [...counts].sort((a, b) => b[1] - a[1])[0]
  if (n < 3 || n / sure.length < 0.6) return null
  const isCaps = l => l.text === l.text.toUpperCase() && /[A-Z]{3}/.test(l.text)
  const same = sure.filter(l => bucket(l) === size)
  return { size, caps: same.every(isCaps) }
}

const fitsStyle = (line, style) => {
  if (!style || line.heading) return true
  if (line.size < style.size - 0.08) return false
  const text = line.text.replace(/[:：]$/, '')
  return !style.caps || (text === text.toUpperCase() && /[A-Z]{3}/.test(text))
}

function isHeading(line, bodyBold, style = null) {
  const text = line.text.replace(/[:：]$/, '')
  if (text.length > 40 || BULLET.test(line.text)) return null
  if (!fitsStyle(line, style)) return null
  const emphasised = looksEmphasised(line, bodyBold)
  const known = headingType(text, emphasised)
  if (known) return known
  // Unknown heading: short, emphasised, and not a sentence. Capitals alone don't make a short acronym
  // ("SQL", "AWS" in a skills list) a heading.
  const capsHeading = text === text.toUpperCase() && /[A-Z]{3}/.test(text) && (line.bold || !bodyBold) && (text.replace(/[^A-Za-z]/g, '').length >= 5 || text.includes(' '))
  if ((line.heading || line.size >= 1.15 || capsHeading) && text.split(' ').length <= 4 && !/[.,;@|]/.test(text) && !RANGE.test(text)) return 'custom'
  return null
}

// Some designs set sections side by side ("Skills | Languages" on one row). Text extraction reads such
// rows straight across, interleaving the two sections. When two or more headings share a row, read each
// column of that band (down to the next heading of the same size) on its own, left to right.
function untangleGrid(lines, bodyBold) {
  const caps = t => t === t.toUpperCase() && /[A-Z]{3}/.test(t)
  const isHead = l => l.col == null && l.text.length <= 40 && !BULLET.test(l.text) && looksEmphasised(l, bodyBold) && (headingType(l.text) || caps(l.text))
  const out = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (!isHead(l)) { out.push(l); i++; continue }
    const row = [l]
    let j = i + 1
    while (j < lines.length && lines[j].page === l.page && Math.abs(lines[j].y - l.y) < 2 && isHead(lines[j])) row.push(lines[j++])
    if (row.length < 2) { out.push(l); i++; continue }
    const size = Math.min(...row.map(h => h.size ?? 1))
    let k = j
    while (k < lines.length && !(isHead(lines[k]) && Math.abs((lines[k].size ?? 1) - size) < 0.03)) k++
    const starts = row.map(h => h.x).sort((a, b) => a - b)
    const colOf = x => starts.reduce((c, sx, idx) => (x >= sx - 3 ? idx : c), 0)
    const cols = starts.map(() => [])
    for (const h of row) cols[colOf(h.x)].unshift(h)
    for (const line of lines.slice(j, k)) cols[colOf(line.x ?? 0)].push(line)
    for (const c of cols) {
      // Gaps were measured across the interleaved order; recompute them within the column.
      c.forEach((line, n) => {
        const prev = c[n - 1]
        if (prev && prev.page === line.page && prev.y != null && line.y != null) line.gap = (prev.y - line.y) / (line.pt && line.size ? line.pt / line.size : 10)
      })
      out.push(...c)
    }
    i = k
  }
  return out
}

/* ------------------------------ personal ------------------------------ */

const ROLE_WORDS = /\b(engineer|developer|manager|designer|analyst|scientist|consultant|director|lead|head|founder|officer|architect|specialist|associate|intern|student|researcher|administrator|coordinator|executive|president|vp|product|marketing|sales|software|data|senior|junior|principal|staff)\b/i

function parsePersonal(lines) {
  const personal = { fullName: '', jobTitle: '', email: '', phone: '', location: '', links: [], photo: '' }
  if (!lines.length) return personal

  // Name: the largest text near the top, including following lines in the same style (a wrapped name).
  const top = lines.slice(0, 8)
  const nameLine = top.reduce((a, b) => (b.size > a.size + 0.05 ? b : a), top[0])
  const sameStyle = (a, b) => Math.abs(a.size - b.size) < 0.04 && !!a.bold === !!b.bold && !!a.italic === !!b.italic
  const nameLines = [nameLine]
  // Only when the name is visibly styled, and the next line is short plain words (a wrapped surname).
  const nameStyled = nameLine.size >= 1.15 || nameLine.bold || nameLine.heading
  // …but never a job title set in the same style ("Product Manager").
  const wrapPart = l => l.text.split(' ').length <= 3 && !/[@|\d:,]/.test(l.text) && !ROLE_WORDS.test(l.text)
  for (let i = lines.indexOf(nameLine) + 1; nameStyled && i < lines.length && sameStyle(lines[i], nameLine) && wrapPart(lines[i]) && nameLines.length < 3; i++) nameLines.push(lines[i])
  personal.fullName = clean(nameLines.map(l => l.text).join(' ').replace(EMAIL, '').replace(PHONE, ''))
  nameLines.forEach(l => { l.role = 'name' })

  // Title: the line(s) right after the name that share one style and aren't contact details.
  const after = lines.indexOf(nameLines.at(-1)) + 1
  const titleLines = []
  for (let i = after; i < lines.length && titleLines.length < 3; i++) {
    const l = lines[i]
    if (EMAIL.test(l.text) || PHONE.test(l.text) || new RegExp(URL.source, 'i').test(l.text)) break
    if (titleLines.length && !sameStyle(l, titleLines[0])) break
    if (!titleLines.length && Math.abs(l.size - 1) < 0.04 && !l.italic && !l.bold && lines[i + 1] && !sameStyle(l, lines[i + 1])) { titleLines.push(l); break }
    titleLines.push(l)
  }
  if (titleLines.length) {
    personal.jobTitle = clean(titleLines.map(l => l.text).join(' '))
    titleLines.forEach(l => { l.role = 'title' })
  }
  const leftovers = []

  for (const line of lines) {
    let t = line.text
    if (line.role === 'name' || line.role === 'title') continue
    line.role = 'contact'
    const email = EMAIL.exec(t)
    if (email && !personal.email) { personal.email = email[0]; t = t.replace(email[0], ' ') }
    for (const m of t.matchAll(URL)) {
      const url = m[1].replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
      if (url.includes('@') || personal.email.endsWith(url)) continue
      const type = /linkedin\.com/i.test(url) ? 'linkedin' : /github\.com/i.test(url) ? 'github' : 'website'
      if (!personal.links.some(l => l.value === url)) personal.links.push({ id: uid(), type, value: url })
      t = t.replace(m[0], ' ')
    }
    const phone = PHONE.exec(t)
    if (phone && !personal.phone && phone[0].replace(/\D/g, '').length >= 8) { personal.phone = clean(phone[0]); t = t.replace(phone[0], ' ') }
    t = clean(t.replace(/(^|\s)(email|e-mail|phone|mobile|tel|linkedin|github|website|portfolio)\s*:?(?=\s|$)/gi, ' ').replace(/^[|•·,\s]+|[|•·,\s]+$/g, '').replace(/\s*[|•·]\s*[|•·]\s*/g, ' | '))
    if (t) leftovers.push(...t.split(/\s*[|•·]\s*/).map(clean).filter(Boolean))
  }

  for (const t of leftovers) {
    const looksLocation = /^[A-Z][\w .'-]+,\s*[A-Z][\w .'-]+$/.test(t) && t.split(' ').length <= 5
    if (looksLocation && !personal.location) personal.location = t
    else if (!personal.jobTitle && t.length <= 120) personal.jobTitle = t
    else if (looksLocation) continue
    else if (personal.jobTitle.length + t.length < 120 && !personal.location) personal.jobTitle += ` | ${t}`
  }
  return personal
}

/* ------------------------------ sections ------------------------------ */

// Group a section's lines into items: a header (non-bullet lines) followed by bullet/body lines.
// PDFs often draw bullet dots as graphics, so indented lines are treated as bullets too; a new
// bullet starts when the previous one ended (sentence end or the line stopped short of the margin).
function groupEntries(lines, dated) {
  const xs = lines.map(l => l.x).filter(x => x != null)
  const baseX = xs.length ? Math.min(...xs) : null
  const maxX1 = Math.max(0, ...lines.map(l => l.x1 ?? 0))
  const indented = l => baseX != null && l.x != null && l.x > baseX + 3
  const hasMarkers = lines.some(l => l.bullet || BULLET.test(l.text))
  // Entry titles are bold in most designs, but some set them only a little larger than the body.
  // Sizes are relative to the document's body text (1.0), see extract.js.
  const titleLike = l => !!l.bold || (l.size != null && l.size >= 1.03)
  const reachesEdge = h => h.x1 != null && maxX1 && baseX != null && h.x1 >= maxX1 - Math.max(12, (maxX1 - baseX) * 0.12)

  const entries = []
  let cur = null
  const start = () => { cur = { head: [], body: [] }; entries.push(cur) }
  const item = (line, text, bullet) => { line.role = 'body'; return { text, html: lineHtml(line), bullet, x: line.x, x1: line.x1 } }
  // A date coming up for this line's entry: right after it, or after the rest of a title wrapped over a few lines.
  const dateAhead = i => {
    for (let k = 1; k <= 5 && lines[i + k]; k++) {
      const l = lines[i + k]
      if (RANGE.test(l.text) || SINGLE.test(l.text)) return true
      if (k >= 2 && !titleLike(l)) return false
    }
    return false
  }

  lines.forEach((line, i) => {
    const marker = line.bullet || BULLET.test(line.text)
    const text = marker ? stripBullet(line.text) : line.text
    if (!cur) start()
    const prev = cur.body.at(-1)
    const hasDate = RANGE.test(text) || (SINGLE.test(text) && text.length < 60) || (titleLike(line) && edgeDate(text))

    if (marker) {
      cur.body.push(item(line, text, true))
      return
    }

    const headHasDate = cur.head.some(h => RANGE.test(h.text) || SINGLE.test(h.text))
    // A title: a title-styled line, or a line with a few words left once dates are taken out.
    const headHasTitle = cur.head.some(h => h.title || takeDates(h.text).rest.replace(/[|,]/g, ' ').trim().split(/\s+/).filter(Boolean).length >= 3)
    // Dates in their own left column come first; the title beside them is the entry's title, not an indented description line.
    if (titleLike(line) && !hasDate && cur.head.length && !headHasTitle && !cur.body.length) {
      line.role = 'entryTitle'
      cur.head.push({ text, bold: line.bold, size: line.size, x1: line.x1, title: true })
      return
    }

    // Indented lines belong to the description, even when they're bold fragments like "15%.".
    if (indented(line) && !hasDate) {
      // With real bullet markers in the section, an unmarked indented line always continues the previous one.
      const prevEnded = !prev || (!hasMarkers && (/[.!?]$/.test(prev.text) || (prev.x1 != null && maxX1 && prev.x1 < maxX1 - Math.max(30, (maxX1 - baseX) * 0.12))))
      if (prev && !prevEnded) join(prev, item(line, text, true))
      else cur.body.push(item(line, text, true))
      return
    }

    // A wrapped continuation of the previous bullet/paragraph line.
    const continuation = prev && !hasDate && !titleLike(line) && (
      /^[a-z(,&]/.test(text) ||
      (prev.bullet && !/[.!?:;]$/.test(prev.text) && line.gap != null && line.gap < 1.5)
    )
    if (continuation) { join(prev, item(line, text, prev.bullet)); return }

    // A wrapped location: "09/2010 – 06/2014 | Cambridge," then "MA".
    const prevHead = cur.head.at(-1)
    if (!cur.body.length && prevHead && /,$/.test(prevHead.text) && !titleLike(line) && !hasDate && text.split(/\s+/).length <= 3 && !/[.!?]$/.test(text)) {
      prevHead.text = `${prevHead.text} ${text}`
      return
    }
    // A title that wrapped: same style as the title line above it, which ran to the column's edge, ended
    // mid-phrase, or was cut short by a date printed beside it (only that date may sit in between).
    const titleIdx = cur.head.findLastIndex(h => h.title)
    const lastHead = cur.head[titleIdx]
    const between = titleIdx >= 0 ? cur.head.slice(titleIdx + 1) : []
    if (!cur.body.length && lastHead && !hasDate && titleLike(line) && between.every(h => h.beside) && !RANGE.test(lastHead.text) && !SINGLE.test(lastHead.text)
      && Math.abs((lastHead.size ?? 1) - (line.size ?? 1)) < 0.02 && !!lastHead.bold === !!line.bold
      && (reachesEdge(lastHead) || between.length > 0 || /(&|,|-|–|\b(of|and|for|in|the))$/i.test(lastHead.text)) && !/[.:;|]$/.test(lastHead.text)
      && (line.gap == null || line.gap < 1.6)) {
      lastHead.text = `${lastHead.text}${/-$/.test(lastHead.text) ? '' : ' '}${text}`
      lastHead.x1 = line.x1
      return
    }
    // A bold line inside a dated entry with no date of its own coming up is a sub-heading
    // in the description ("Email Platform"), not a new job.
    if (dated && titleLike(line) && !hasDate && headHasDate && headHasTitle && !dateAhead(i)) {
      const it = item(line, text, false)
      it.html = `<b>${it.html ?? esc(text)}</b>`.replace(/^<b><b>(.*)<\/b><\/b>$/, '<b>$1</b>')
      cur.body.push(it)
      return
    }
    // Under a title, sentences are description (a short line like "San Francisco, CA" stays in the header).
    if (headHasTitle && (headHasDate || cur.head.some(h => h.title)) && !hasDate && !titleLike(line) && !cur.body.length && (/[.!?]$/.test(text) || /\.\s/.test(text) || text.split(/\s+/).length > 6)) {
      cur.body.push(item(line, text, false))
      return
    }
    // A second date means a second entry, even without a description in between (awards, certificates).
    const newEntry = (hasDate && headHasDate && headHasTitle) || (cur.body.length > 0 || (titleLike(line) && cur.head.length > 0 && headHasDate)) && (
      hasDate || titleLike(line) || (line.gap != null && line.gap > 1.8) ||
      (dated && text.length < 90 && !/[.!?]$/.test(text) && lines[i + 1] && (RANGE.test(lines[i + 1].text) || SINGLE.test(lines[i + 1].text)))
    )
    if (newEntry) start()

    // Once the description has started, plain lines stay in it.
    if (!newEntry && cur.body.length && !hasDate) cur.body.push(item(line, text, false))
    // Long sentences after a header are description text, not header lines.
    else if (cur.head.length >= 1 && text.length > 90 && !hasDate) cur.body.push(item(line, text, false))
    else if (cur.head.length >= 3 && !hasDate) cur.body.push(item(line, text, false))
    else {
      line.role = hasDate ? 'date' : cur.head.some(h => !RANGE.test(h.text)) ? 'entrySub' : 'entryTitle'
      // `beside`: a date printed on the same line as the title, to its right.
      cur.head.push({ text, bold: line.bold, size: line.size, x1: line.x1, title: titleLike(line) && !hasDate, beside: hasDate && line.gap != null && Math.abs(line.gap) < 0.3 })
    }
  })
  return entries.filter(e => e.head.length || e.body.length)
}

// A line's HTML (with inline bold) minus any leading bullet glyph; falls back to escaped text.
function lineHtml(line) {
  if (!line.html) return null
  return line.html.replace(BULLET_HTML, '$1').trim()
}

// Join a wrapped line onto the previous one; "time-" + "to-book" → "time-to-book".
function join(prev, next) {
  const hyphen = /[a-z]-$/i.test(prev.text) && /^[a-z]/.test(next.text)
  const sep = hyphen ? '' : ' '
  const prevHtml = prev.html ?? esc(prev.text)
  const nextHtml = next.html ?? esc(next.text)
  prev.html = prev.html || next.html ? prevHtml + sep + nextHtml : null
  prev.text += sep + next.text
  prev.x1 = next.x1
}

function bodyHtml(body) {
  if (!body.length) return ''
  let html = ''
  let inList = false
  for (const b of body) {
    if (b.bullet && !inList) { html += '<ul>'; inList = true }
    if (!b.bullet && inList) { html += '</ul>'; inList = false }
    const inner = b.html ?? esc(b.text)
    if (!b.text.trim()) continue
    html += b.bullet ? `<li>${inner}</li>` : `<p>${inner}</p>`
  }
  if (inList) html += '</ul>'
  return html
}

// "Senior PM, Acme" / "Senior PM at Acme" / "Acme | Senior PM" / "Senior PM — Acme"
function splitTitle(text, strict = false) {
  // Split at the last separator: "Best Paper, Systems Track, USENIX ATC" → award / issuer, and
  // "Architect – Professional, Amazon Web Services" → name / issuer.
  // strict: only the separators that mean "title, employer" (used when a "|" already split the line)
  let best = null
  for (const sep of strict ? [', ', ' – ', ' — '] : [' | ', ' – ', ' — ', ' - ', ', ']) {
    const i = text.lastIndexOf(sep)
    if (i > 0 && (!best || i > best.i)) best = { i, sep }
  }
  if (best) return [clean(text.slice(0, best.i)), clean(text.slice(best.i + best.sep.length))]
  const at = /^(.*?)\s+(?:at|@)\s+(.*)$/i.exec(text)
  if (at) return [clean(at[1]), clean(at[2])]
  return [clean(text), '']
}

// The two title fields in the order the section displays them (e.g. position, then organisation).
const titleKeys = type => SECTION_TYPES[type].title?.(new Proxy({}, { get: (_, k) => k })) ?? SECTION_TYPES[type].fields.map(f => f.key)

const SCHOOL = /\b(university|college|school|institute|academy|iit|iim|polytechnic)\b/i
const looksLocation = t => /^[A-Z][\w .'-]+(,\s*[A-Z][\w .'-]+)?$/.test(t) && t.split(' ').length <= 4 && !/\b(inc|ltd|llc|university|college|school|institute|corp)\b/i.test(t)

function datedEntry(item, type) {
  const def = SECTION_TYPES[type]
  const [k1, k2] = titleKeys(type)
  const e = { id: uid(), startDate: '', endDate: '', location: '', description: '' }
  const heads = []
  let dated = false
  for (const h of item.head) {
    const d = takeDates(h.text)
    if (d.found && !dated) {
      dated = true
      e.startDate = d.startDate
      e.endDate = d.endDate
      const rest = d.rest.split(/\s*\|\s*/).filter(Boolean)
      // Text sharing the date line is usually the location ("Mar 2021 – Present | Remote").
      if (rest.length && heads.length && (looksLocation(rest.at(-1)) || /^(remote|hybrid|on-?site)$/i.test(rest.at(-1)))) e.location = rest.pop()
      heads.push(...rest)
    } else {
      heads.push(...h.text.split(/\s+\|\s+(?=[A-Z])/).filter(Boolean))
    }
  }
  // Location: a short "City, Country" piece among the header pieces.
  if (!e.location) {
    const locIdx = heads.findIndex((h, i) => i > 0 && looksLocation(h) && h.includes(','))
    if (locIdx > 0) e.location = heads.splice(locIdx, 1)[0]
    else if (heads.length > 2 && looksLocation(heads.at(-1))) e.location = heads.pop()
  }

  const [t0, t1] = heads.length ? splitTitle(heads[0], true) : ['', '']
  if (heads.length >= 2 && t1) {
    e[k1] = t0
    e[k2] = [t1, ...heads.slice(1)].join(' | ')
  } else if (heads.length >= 2) {
    e[k1] = heads[0]
    e[k2] = heads.slice(1).join(' | ')
  } else if (heads.length === 1 && type === 'education' && SCHOOL.test(heads[0]) && heads[0].includes(', ')) {
    const i = heads[0].lastIndexOf(', ')
    const [a, b] = [heads[0].slice(0, i), heads[0].slice(i + 2)]
    ;[e[k1], e[k2]] = SCHOOL.test(b) ? [clean(a), clean(b)] : [clean(b), clean(a)]
  } else if (heads.length === 1) {
    const [a, b] = splitTitle(heads[0])
    e[k1] = a
    e[k2] = b
  }
  if (type === 'education' && e[k1] && e[k2] && /\b(university|college|school|institute|academy)\b/i.test(e[k1]) && !/\b(university|college|school|institute|academy)\b/i.test(e[k2])) {
    ;[e[k1], e[k2]] = [e[k2], e[k1]] // "School, Degree" → degree first
  }
  if (!def.fields.some(f => f.key === 'startDate')) { e.endDate = e.endDate || e.startDate; delete e.startDate }
  e.description = bodyHtml(item.body)
  return e
}

function listEntries(lines, type) {
  const key = { skills: 'skill', languages: 'language', interests: 'interest' }[type]
  const out = []
  for (const line of lines) {
    const text = stripBullet(line.text)
    if (!text) continue
    const colon = /^([^:]{2,40}):\s*(.+)$/.exec(text)
    if (colon) { out.push({ id: uid(), [key]: clean(colon[1]), info: clean(colon[2]), level: -1 }); continue }
    if (type === 'interests' && !colon) {
      for (const part of text.split(/\s*[,;|•·]\s*/).filter(Boolean)) out.push({ id: uid(), interest: clean(part), info: '' })
      continue
    }
    if (type === 'languages') {
      // "English" (bold) over "Native" (plain) is one language with its level.
      const last = out.at(-1)
      if (line.bold && text.length <= 40 && !/[,;|•·]/.test(text)) { out.push({ id: uid(), language: clean(text), info: '', level: -1, _group: true }); continue }
      if (last?._group && !last.info && !/[,;|•·]/.test(text)) { last.info = clean(text); continue }
      for (const part of text.split(/\s*[,;|•·]\s*/).filter(Boolean)) {
        const m = /^(.*?)\s*[(–—-]\s*(.*?)\)?$/.exec(part)
        out.push({ id: uid(), language: clean(m ? m[1] : part), info: m ? clean(m[2]) : '', level: -1 })
      }
      continue
    }
    // "• Python  • SQL  • Figma" on one line: separate skills.
    if (type !== 'languages' && /\s[•·▪●]\s/.test(text) && !line.bold) {
      for (const part of text.split(/\s*[•·▪●]\s*/).map(clean).filter(Boolean)) out.push({ id: uid(), [key]: part, info: '', level: -1 })
      continue
    }
    const prev = out.at(-1)
    // A bold line names a group; the plain lines under it are its details.
    line.role = 'body'
    if (line.bold && text.length <= 40) { line.role = 'entryTitle'; out.push({ id: uid(), [key]: text, info: '', level: -1, _group: true }); continue }
    if (prev?._group) { prev.info = prev.info ? `${prev.info}${/-$/.test(prev.info) ? '' : ' '}${text}` : text; continue }
    // Wrapped continuation of a comma list.
    if (prev?.info && (/,$/.test(prev.info) || /^[a-z]/.test(text))) { prev.info += ` ${text}`; continue }
    // Plain comma lists stay together as one entry's details; short lines become their own entry.
    if (text.includes(',') && text.length > 40) {
      const prev = out.at(-1)
      if (prev && !prev.info) prev.info = text
      else out.push({ id: uid(), [key]: '', info: text, level: -1 })
    } else {
      out.push({ id: uid(), [key]: text, info: '', level: -1 })
    }
  }
  return out.map(({ _group, ...e }) => e)
}

function paragraphHtml(lines) {
  const paras = []
  for (const l of lines) {
    l.role = 'body'
    const bullet = l.bullet || BULLET.test(l.text)
    const text = bullet ? stripBullet(l.text) : l.text
    const next = { text, html: lineHtml(l), bullet }
    const last = paras.at(-1)
    if (last && !bullet && !last.bullet && !(l.gap != null && l.gap > 1.8) && !last.closed) join(last, next)
    else paras.push(next)
    if (l.blankAfter) paras.at(-1).closed = true
  }
  return bodyHtml(paras)
}

function buildSection(type, heading, lines, col = null) {
  const def = SECTION_TYPES[type]
  let entries = []
  if (type === 'profile' || type === 'declaration') {
    entries = [{ id: uid(), text: paragraphHtml(lines) }]
  } else if (type === 'skills' || type === 'languages' || type === 'interests') {
    entries = listEntries(lines, type)
  } else if (type === 'references') {
    entries = groupEntries(lines, false).map(it => {
      const all = [...it.head, ...it.body].map(x => x.text)
      const email = all.join(' ').match(EMAIL)?.[0] ?? ''
      const phone = all.join(' ').match(PHONE)?.[0] ?? ''
      const [jobTitle, organisation] = splitTitle(all[1] ?? '')
      return { id: uid(), name: all[0] ?? '', jobTitle, organisation, email, phone: clean(phone) }
    })
  } else {
    const t = type === 'custom' ? 'custom' : type
    entries = groupEntries(lines, true).map(it => datedEntry(it, t))
  }
  return {
    id: uid(), type, hidden: false, heading: heading || def.label,
    // 'left' = side column, 'right' = main column (see layout.js). Without a source column, guess by type.
    column: col ? (col === 'side' ? 'left' : 'right') : ['experience', 'projects', 'organisations', 'publications', 'custom', 'references'].includes(type) ? 'right' : 'left',
    entries: entries.filter(e => Object.entries(e).some(([k, v]) => k !== 'id' && k !== 'level' && v)),
  }
}

/* ------------------------------ entry point ------------------------------ */

export function parseResume(lines, name = 'Imported resume') {
  const bodyBold = lines.filter(l => l.bold).length > lines.length * 0.6
  lines = untangleGrid(lines, bodyBold)
  const blocks = [{ type: 'header', heading: '', lines: [] }]
  const style = headingStyle(lines, bodyBold)
  const firstKnown = lines.findIndex(l => l.text.length <= 40 && !BULLET.test(l.text) && headingType(l.text.replace(/[:：]$/, ''), looksEmphasised(l, bodyBold)))
  lines.forEach((line, i) => {
    const inHeader = i < firstKnown || (firstKnown < 0 && i < 6)
    const headerHeading = inHeader && i > 1 && line.bold && isHeading(line, bodyBold) === 'custom' && lines[i + 1] && !EMAIL.test(lines[i + 1].text)
    if (inHeader && !headerHeading) { blocks[0].lines.push(line); return }
    const type = isHeading(line, bodyBold, style)
    if (type) { line.role = 'heading'; blocks.push({ type, heading: titleCase(line.text.replace(/[:：]$/, '')), col: line.col ?? null, lines: [] }) }
    else {
      // A side-column section that runs onto the next page continues its own block, not the main column's.
      const cur = blocks.at(-1)
      let own = line.col && cur.col && line.col !== cur.col ? blocks.findLast(b => b.col === line.col) : null
      // A page without detected columns: a line at the side column's indent continues that column.
      if (!own && !line.col && cur.col && line.x != null && !cur.lines.some(l => Math.abs(l.x - line.x) < 3)) {
        own = blocks.findLast(b => b.col && b.col !== cur.col && b.lines.some(l => l.x != null && Math.abs(l.x - line.x) < 3)) ?? null
      }
      ;(own ?? cur).lines.push(line)
    }
  })

  // Prose after the last contact line in the header area is a summary without a heading.
  const head = blocks[0].lines
  const isContact = l => EMAIL.test(l.text) || PHONE.test(l.text) || new RegExp(URL.source, 'i').test(l.text)
  const lastContact = head.reduce((acc, l, i) => (isContact(l) ? i : acc), -1)
  const prose = head.filter((l, i) => (i > lastContact && i > 1 && l.text.split(' ').length >= 4 && !isContact(l)) || l.text.length > 120)
  const personal = parsePersonal(head.filter(l => !prose.includes(l)))

  // Text before any heading that isn't contact info is usually a summary.
  const sections = []
  if (prose.length) {
    const existing = blocks.find(b => b.type === 'profile')
    if (existing) existing.lines.unshift(...prose)
    else sections.push(buildSection('profile', 'Profile Summary', prose, prose[0].col ?? null))
  }
  if (personal.jobTitle.length > 120) personal.jobTitle = ''

  // Merge repeated section types (e.g. a heading split across columns).
  for (const b of blocks.slice(1)) {
    if (!b.lines.length) continue
    const same = b.type !== 'custom' && sections.find(s => s.type === b.type)
    const built = buildSection(b.type, b.heading, b.lines, b.col)
    if (same) same.entries.push(...built.entries)
    else sections.push(built)
  }

  const nonEmpty = sections.filter(s => s.entries.length)
  if (!personal.fullName && !nonEmpty.length) throw new Error('Couldn’t find any resume content in this file.')

  return {
    id: uid(),
    name,
    updatedAt: Date.now(),
    personal,
    sections: nonEmpty,
    settings: { ...DEFAULT_SETTINGS, applyAccent: { ...DEFAULT_SETTINGS.applyAccent } },
  }
}

function titleCase(t) {
  const s = clean(t)
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|\s|&)([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(And|Of|The|In|For)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase())
}

// A summary for the import dialog.
export function summarise(resume) {
  return {
    name: resume.personal.fullName,
    title: resume.personal.jobTitle,
    contacts: [resume.personal.email, resume.personal.phone, resume.personal.location, ...resume.personal.links.map(l => l.value)].filter(Boolean),
    sections: resume.sections.map(s => ({ heading: s.heading, count: s.entries.length, type: s.type })),
  }
}
