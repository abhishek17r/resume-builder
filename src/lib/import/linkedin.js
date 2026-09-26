import { uid, DEFAULT_SETTINGS } from '../defaults'
import { RANGE, EMAIL, PHONE, toMonth, takeDates, summarise } from './parse'

// LinkedIn imports:
//   1. Profile PDF (profile → More → Save to PDF): fixed layout where every role is marked by
//      font size — sidebar headings (Contact, Top Skills…), then in the main column the name,
//      headline, location, and 15.75pt section headings; in Experience, company > title > dates.
//   2. Data export ZIP (Settings → Data privacy → Get a copy of your data): CSV files with
//      exact fields (Profile.csv, Positions.csv, Education.csv…).
// Both produce text only; LinkedIn PDFs have no design worth keeping, so a clean one-column
// template is applied.

const LINKEDIN_SETTINGS = {
  columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'column',
  text: '#1f2328', bg: '#ffffff', accent: '#1f2a6b',
  bodyFont: 'Lato', nameFont: '', headingStyle: 'underline', headingCaps: 'uppercase',
  datePosition: 'right', detailsArrangement: 'bar', titleStyle: 'normal', lineHeight: 1.3,
}

const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const clean = t => t.replace(/\s+/g, ' ').trim()
const BULLET = /^\s*[•●▪■◦○◆►▸‣⁃∙·*–-]\s*/

// Plain text (with \n line breaks) → description HTML: bullet lines become a list.
export function textToHtml(text = '') {
  const out = []
  let list = null
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) { list = null; continue }
    if (BULLET.test(line)) {
      if (!list) { list = []; out.push({ list }) }
      list.push(line.replace(BULLET, ''))
    } else {
      list = null
      out.push({ p: line })
    }
  }
  return out.map(b => (b.list ? `<ul>${b.list.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p>${esc(b.p)}</p>`)).join('')
}

function finish(personal, sections, source) {
  const resume = {
    id: uid(),
    name: personal.fullName ? `${personal.fullName} – LinkedIn` : 'LinkedIn import',
    updatedAt: Date.now(),
    personal,
    sections: sections.filter(s => s.entries.length),
    settings: { ...DEFAULT_SETTINGS, applyAccent: { ...DEFAULT_SETTINGS.applyAccent }, ...LINKEDIN_SETTINGS },
  }
  if (!personal.fullName && !resume.sections.length) throw new Error('Couldn’t find any profile content in this file.')
  return { source, summary: summarise(resume), layout: null, design: null, linkedin: true, build: () => structuredClone(resume) }
}

// Join wrapped lines; a line ending in a hyphen continues the word ("as-a-" + "Service").
const joinLines = ls => ls.map(l => l.text.trim()).reduce((acc, t) => (!acc ? t : /[A-Za-z]-$/.test(acc) ? acc + t : `${acc} ${t}`), '')

const section = (type, heading, entries, column = 'right') => ({ id: uid(), type, heading, column, hidden: false, entries })

/* ------------------------------ profile PDF ------------------------------ */

const SIDE_HEADINGS = /^(contact|top skills|skills|languages|certifications|honors-awards|honors & awards|publications|patents|courses|projects)$/i
const MAIN_HEADINGS = /^(summary|about|experience|education|licenses & certifications|volunteer experience|projects|honors & awards|publications|languages|skills|courses|organizations|patents|recommendations)$/i
const isFooter = l => /^page\s*\d+\s*of\s*\d+$/i.test(l.text)

export function isLinkedInPdf(lines) {
  const texts = new Set(lines.map(l => l.text.trim().toLowerCase()))
  const hasSidebar = texts.has('contact') || texts.has('top skills')
  const hasMain = texts.has('experience') || texts.has('summary') || texts.has('education')
  const hasFooter = lines.some(isFooter)
  const mentionsLinkedIn = lines.some(l => /linkedin\.com\/in\//i.test(l.text))
  return hasMain && (hasSidebar || mentionsLinkedIn) && (hasFooter || hasSidebar)
}

const near = (a, b) => b != null && Math.abs(a - b) < 0.3
const rawGap = (prev, line) => (prev && prev.page === line.page ? prev.y - line.y : null)

// Split a column into [{ heading, lines }] at lines of the given heading size.
function sectionsBy(lines, isHeading) {
  const out = []
  let cur = { heading: null, lines: [] }
  out.push(cur)
  for (const l of lines) {
    if (isHeading(l)) { cur = { heading: clean(l.text), lines: [] }; out.push(cur) } else cur.lines.push(l)
  }
  return out
}

// Sidebar list items wrap onto a second line with tighter spacing than the gap between items.
function sidebarItems(lines) {
  const items = []
  let prev = null
  for (const l of lines) {
    const g = rawGap(prev, l)
    if (prev && g != null && g < l.pt * 1.38) items[items.length - 1] += ` ${l.text}`
    else items.push(l.text)
    prev = l
  }
  return items.map(clean).filter(Boolean)
}

// Contact lines: URLs wrap mid-token ("…/in/john-" + "doe-123 (LinkedIn)"), so rejoin them.
function parseContact(lines, personal) {
  let text = ''
  for (const l of lines) {
    const t = l.text.trim()
    const glue = /[-/.]$/.test(text) && !/\s/.test(t.split(' (')[0])
    text += glue ? t : `\n${t}`
  }
  const email = EMAIL.exec(text)?.[0]
  if (email) personal.email = email
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.includes('@')) continue
    const m = /^(\S+)\s*\((LinkedIn|Company|Personal|Portfolio|Blog|Other|RSS Feed)\)$/i.exec(t)
    if (m) {
      const value = m[1].replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
      const type = /linkedin\.com/i.test(value) ? 'linkedin' : /github\.com/i.test(value) ? 'github' : 'website'
      personal.links.push({ id: uid(), type, value })
      continue
    }
    const phone = PHONE.exec(t)
    if (phone && !personal.phone) personal.phone = clean(phone[0])
  }
}

// Paragraph/bullet HTML from description lines, using the vertical gaps LinkedIn leaves between paragraphs.
function linesToHtml(lines) {
  const paras = []
  let prev = null
  for (const l of lines) {
    const g = rawGap(prev, l)
    const breakPara = !prev || g == null || g > l.pt * 1.9 || BULLET.test(l.text)
    if (breakPara) paras.push(l.text.trim())
    else {
      const last = paras.length - 1
      paras[last] = /[a-z]-$/i.test(paras[last]) && /^[a-z]/.test(l.text) ? paras[last] + l.text.trim() : `${paras[last]} ${l.text.trim()}`
    }
    prev = l
  }
  // "Intro ► point one ► point two" (common in LinkedIn summaries) → intro + list
  const html = []
  let list = []
  const flush = () => { if (list.length) html.push(`<ul>${list.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`); list = [] }
  for (const p of paras) {
    if (p.includes('►')) {
      const [intro, ...points] = p.split('►').map(clean)
      if (intro) { flush(); html.push(`<p>${esc(intro)}</p>`) }
      list.push(...points.filter(Boolean))
      continue
    }
    if (BULLET.test(p)) { list.push(p.replace(BULLET, '')); continue }
    flush()
    html.push(`<p>${esc(p)}</p>`)
  }
  flush()
  return html.join('')
}

const DURATION = /^\(?\s*(\d+\s+(years?|yrs?|months?|mos?)\s*)+\)?$/i
const dateLine = t => RANGE.test(t) || /^\(?\s*(19|20)\d{2}\s*\)?$/.test(t.replace(/\(.*?\)\s*$/, '').trim())
const looksLocation = t => t.split(' ').length <= 8 && !/[.!?]$/.test(t) && !/^[a-z]/.test(t)

function parseExperience(lines, companyPt, titlePt) {
  const entries = []
  let company = ''
  let cur = null
  let prev = null
  for (const l of lines) {
    const t = clean(l.text)
    if (near(l.pt, companyPt) && !dateLine(t)) {
      company = t
      cur = null
    } else if (near(l.pt, titlePt) && !dateLine(t)) {
      if (cur && !cur.dated && !cur.desc.length) cur.jobTitle += ` ${t}` // wrapped title
      else { cur = { id: uid(), jobTitle: t, employer: company, startDate: '', endDate: '', location: '', desc: [], dated: false }; entries.push(cur) }
    } else if (cur && !cur.dated && dateLine(t)) {
      const d = takeDates(t.replace(/\((\d+\s+(years?|months?)\s*)+\)/gi, '').replace(/\s*·\s*/g, ' '))
      cur.startDate = d.startDate ?? ''
      cur.endDate = d.endDate ?? ''
      cur.dated = true
      cur.expectLocation = true
    } else if (DURATION.test(t)) {
      // total time at a company with several roles — skip
    } else if (cur) {
      const g = rawGap(prev, l)
      if (cur.expectLocation && looksLocation(t) && (g == null || g < l.pt * 1.8)) cur.location = t
      else cur.desc.push(l)
      cur.expectLocation = false
    }
    prev = l
  }
  return entries.map(({ desc, dated, expectLocation, ...e }) => ({ ...e, description: linesToHtml(desc) }))
}

function parseEducation(lines, schoolPt) {
  const entries = []
  let cur = null
  for (const l of lines) {
    const t = clean(l.text)
    if (near(l.pt, schoolPt)) {
      cur = { id: uid(), degree: '', school: t, startDate: '', endDate: '', location: '', desc: [] }
      entries.push(cur)
    } else if (cur) {
      // "BE, Information technology · (2000 - 2004)"
      const [degreePart, datePart] = t.split(/\s*·\s*/)
      if (!cur.degree && degreePart && !dateLine(degreePart)) {
        cur.degree = degreePart
        if (datePart) {
          const d = takeDates(datePart.replace(/[()]/g, ''))
          cur.startDate = d.startDate ?? ''
          cur.endDate = d.endDate ?? ''
        }
      } else if (dateLine(t) && !cur.endDate) {
        const d = takeDates(t.replace(/[()·]/g, ''))
        cur.startDate = d.startDate ?? ''
        cur.endDate = d.endDate ?? ''
      } else cur.desc.push(l)
    }
  }
  return entries.map(({ desc, ...e }) => ({ ...e, description: linesToHtml(desc) }))
}

export function parseLinkedInPdf(allLines) {
  const lines = allLines.filter(l => !isFooter(l) && l.text.trim())
  const side = lines.filter(l => l.col === 'side')
  const main = lines.filter(l => l.col !== 'side')

  const personal = { fullName: '', jobTitle: '', email: '', phone: '', location: '', links: [], photo: '' }
  const sections = []

  // ----- main column
  const namePt = Math.max(...main.map(l => l.pt))
  const headingPt = Math.max(0, ...main.filter(l => MAIN_HEADINGS.test(l.text.trim())).map(l => l.pt))
  const isMainHeading = l => near(l.pt, headingPt) && MAIN_HEADINGS.test(l.text.trim())
  const [header, ...mainSecs] = sectionsBy(main, isMainHeading)

  const nameLines = header.lines.filter(l => near(l.pt, namePt))
  personal.fullName = clean(joinLines(nameLines))
  const rest = header.lines.filter(l => !nameLines.includes(l))
  if (rest.length > 1) {
    personal.location = clean(rest.at(-1).text)
    personal.jobTitle = clean(joinLines(rest.slice(0, -1)))
  } else if (rest.length === 1) personal.jobTitle = clean(rest[0].text)

  for (const sec of mainSecs) {
    const h = sec.heading.toLowerCase()
    const sizes = [...new Set(sec.lines.map(l => l.pt))].sort((a, b) => b - a)
    if (h === 'summary' || h === 'about') {
      sections.push(section('profile', 'Profile Summary', [{ id: uid(), text: linesToHtml(sec.lines) }], 'left'))
    } else if (h === 'experience' || h === 'volunteer experience') {
      const entries = parseExperience(sec.lines, sizes[0], sizes[1])
      if (h === 'experience') sections.push(section('experience', 'Professional Experience', entries))
      else sections.push(section('organisations', 'Volunteering', entries.map(e => ({ id: e.id, organisation: e.employer, position: e.jobTitle, startDate: e.startDate, endDate: e.endDate, location: e.location, description: e.description }))))
    } else if (h === 'education') {
      sections.push(section('education', 'Education', parseEducation(sec.lines, sizes[0]), 'left'))
    } else {
      sections.push(section('custom', sec.heading, sidebarItems(sec.lines).map(t => ({ id: uid(), title: t, subtitle: '', description: '' }))))
    }
  }

  // ----- sidebar
  const sideHeadingPt = Math.max(0, ...side.filter(l => SIDE_HEADINGS.test(l.text.trim())).map(l => l.pt))
  const sideSecs = sectionsBy(side, l => near(l.pt, sideHeadingPt) && SIDE_HEADINGS.test(l.text.trim()))
  for (const sec of sideSecs) {
    if (!sec.heading) continue
    const h = sec.heading.toLowerCase()
    const items = sidebarItems(sec.lines)
    if (h === 'contact') parseContact(sec.lines, personal)
    else if (h === 'top skills' || h === 'skills') sections.push(section('skills', 'Skills', items.map(s => ({ id: uid(), skill: s, info: '', level: -1 })), 'left'))
    else if (h === 'languages') {
      sections.push(section('languages', 'Languages', items.map(s => {
        const m = /^(.*?)\s*\((.*)\)$/.exec(s)
        return { id: uid(), language: m ? m[1] : s, info: m ? m[2] : '', level: -1 }
      }), 'left'))
    } else if (h === 'certifications') sections.push(section('certificates', 'Certifications', items.map(s => ({ id: uid(), name: s, issuer: '', endDate: '', description: '' })), 'left'))
    else if (h.startsWith('honors')) sections.push(section('awards', 'Awards', items.map(s => ({ id: uid(), award: s, issuer: '', endDate: '', description: '' })), 'left'))
    else if (h === 'publications') sections.push(section('publications', 'Publications', items.map(s => ({ id: uid(), title: s, publisher: '', endDate: '', description: '' }))))
    else sections.push(section('custom', sec.heading, items.map(s => ({ id: uid(), title: s, subtitle: '', description: '' }))))
  }

  // Order like a resume: summary, experience, education, then the rest.
  const order = ['profile', 'experience', 'education', 'skills', 'certificates', 'languages', 'projects', 'organisations', 'awards', 'publications', 'custom']
  sections.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
  return finish(personal, sections, 'linkedin-pdf')
}

/* ------------------------------ data export ZIP ------------------------------ */

// RFC 4180 CSV: quoted fields may contain commas, quotes ("") and newlines.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Rows as objects. Some exports start with note lines, so find the header row by a known column.
function table(text, mustHave) {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  const h = rows.findIndex(r => r.some(c => c.trim().toLowerCase() === mustHave.toLowerCase()))
  if (h < 0) return []
  const head = rows[h].map(c => c.trim())
  return rows.slice(h + 1).filter(r => r.some(c => c.trim())).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const month = v => toMonth(v?.replace(/,/g, '') ?? '')

export async function parseLinkedInZip(file) {
  const JSZip = (await import('jszip')).default
  let zip
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()) } catch { throw new Error('That ZIP file couldn’t be opened.') }
  const byName = {}
  zip.forEach((path, entry) => { if (!entry.dir) byName[path.split('/').pop().toLowerCase()] = entry })
  const read = async (name, mustHave) => (byName[name] ? table(await byName[name].async('string'), mustHave) : [])

  const profile = (await read('profile.csv', 'First Name'))[0]
  const positions = await read('positions.csv', 'Company Name')
  if (!profile && !positions.length) throw new Error('This ZIP doesn’t look like a LinkedIn data export (no Profile.csv or Positions.csv).')

  const personal = { fullName: '', jobTitle: '', email: '', phone: '', location: '', links: [], photo: '' }
  if (profile) {
    personal.fullName = clean(`${profile['First Name'] ?? ''} ${profile['Last Name'] ?? ''}`)
    personal.jobTitle = profile.Headline ?? ''
    personal.location = profile['Geo Location'] ?? profile.Address ?? ''
    for (const m of (profile.Websites ?? '').matchAll(/(?:\[?[A-Z]+:)?(https?:\/\/[^\],\s]+)/g)) {
      const value = m[1].replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
      personal.links.push({ id: uid(), type: /github\.com/.test(value) ? 'github' : /linkedin\.com/.test(value) ? 'linkedin' : 'website', value })
    }
  }
  const emails = await read('email addresses.csv', 'Email Address')
  personal.email = (emails.find(e => /yes/i.test(e.Primary ?? '')) ?? emails[0])?.['Email Address'] ?? ''
  const phones = await read('phonenumbers.csv', 'Number')
  personal.phone = phones[0]?.Number ?? ''

  const sections = []
  if (profile?.Summary) sections.push(section('profile', 'Profile Summary', [{ id: uid(), text: textToHtml(profile.Summary) }], 'left'))
  sections.push(section('experience', 'Professional Experience', positions.map(p => ({
    id: uid(), jobTitle: p.Title ?? '', employer: p['Company Name'] ?? '', startDate: month(p['Started On']), endDate: month(p['Finished On']),
    location: p.Location ?? '', description: textToHtml(p.Description),
  }))))
  sections.push(section('education', 'Education', (await read('education.csv', 'School Name')).map(e => ({
    id: uid(), degree: e['Degree Name'] ?? '', school: e['School Name'] ?? '', startDate: month(e['Start Date']), endDate: month(e['End Date']),
    location: '', description: textToHtml([e.Notes, e.Activities].filter(Boolean).join('\n')),
  })), 'left'))
  sections.push(section('skills', 'Skills', (await read('skills.csv', 'Name')).map(s => ({ id: uid(), skill: s.Name, info: '', level: -1 })), 'left'))
  sections.push(section('languages', 'Languages', (await read('languages.csv', 'Name')).map(l => ({ id: uid(), language: l.Name, info: l.Proficiency ?? '', level: -1 })), 'left'))
  sections.push(section('certificates', 'Certifications', (await read('certifications.csv', 'Name')).map(c => ({
    id: uid(), name: c.Name, nameLink: c.Url ?? '', issuer: c.Authority ?? '', endDate: month(c['Started On']), description: '',
  })), 'left'))
  sections.push(section('projects', 'Projects', (await read('projects.csv', 'Title')).map(p => ({
    id: uid(), title: p.Title, titleLink: p.Url ?? '', subtitle: '', startDate: month(p['Started On']), endDate: month(p['Finished On']), location: '', description: textToHtml(p.Description),
  }))))
  sections.push(section('organisations', 'Volunteering', (await read('volunteering.csv', 'Company Name')).map(v => ({
    id: uid(), organisation: v['Company Name'], position: v.Role ?? '', startDate: month(v['Started On']), endDate: month(v['Finished On']), location: '', description: textToHtml([v.Cause, v.Description].filter(Boolean).join('\n')),
  }))))
  sections.push(section('awards', 'Awards', (await read('honors.csv', 'Title')).map(h => ({ id: uid(), award: h.Title, issuer: '', endDate: month(h['Issued On']), description: textToHtml(h.Description) })), 'left'))
  sections.push(section('publications', 'Publications', (await read('publications.csv', 'Name')).map(p => ({
    id: uid(), title: p.Name, titleLink: p.Url ?? '', publisher: p.Publisher ?? '', endDate: month(p['Published On']), description: textToHtml(p.Description),
  }))))
  sections.push(section('courses', 'Courses', (await read('courses.csv', 'Name')).map(c => ({ id: uid(), course: c.Name, institution: '', startDate: '', endDate: '', location: '', description: '' })), 'left'))

  return finish(personal, sections, 'linkedin-zip')
}
