import { extractLines } from './extract'
import { parseResume, summarise } from './parse'
import { analyzeLayout } from './layout'
import { analyzeDesign } from './design'
import { isLinkedInPdf, parseLinkedInPdf, parseLinkedInZip } from './linkedin'
import { uid, DEFAULT_SETTINGS } from '../defaults'

export const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.json,.zip,application/pdf,application/json,application/zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const LINKEDIN_ACCEPT = '.pdf,.zip,application/pdf,application/zip'

// LinkedIn profile PDF or data-export ZIP only.
export async function importLinkedIn(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'zip') return parseLinkedInZip(file)
  if (ext !== 'pdf') throw new Error('Choose the PDF saved from your LinkedIn profile, or the ZIP from LinkedIn’s data export.')
  const { lines } = await extractLines(file)
  if (!isLinkedInPdf(lines)) throw new Error('This PDF doesn’t look like a LinkedIn profile PDF. Use “Import file” for other resumes.')
  return parseLinkedInPdf(lines)
}

const TYPE_COLUMN = type => (['experience', 'projects', 'organisations', 'publications', 'custom', 'references'].includes(type) ? 'right' : 'left')

// File → three independent layers, plus build({ layout, design }) to assemble a resume:
//   text   — personal details and sections/entries (always used)
//   layout — page, columns, header position, section placement, margins, date position
//   design — fonts, sizes, line height, colours, heading case, contact style
// Nothing is saved until the caller adds the built resume.
export async function importResumeFile(file) {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'json' || file.type === 'application/json') {
    let data
    try { data = JSON.parse(await file.text()) } catch { throw new Error('That JSON file couldn’t be read.') }
    if (!data?.personal || !Array.isArray(data.sections)) throw new Error('This JSON isn’t a resume exported from this app.')
    // Fresh ids so importing the same file twice doesn't create clashing sections/entries.
    const resume = structuredClone(data)
    resume.sections = resume.sections.map(s => ({ ...s, id: uid(), entries: (s.entries ?? []).map(e => ({ ...e, id: uid() })) }))
    resume.personal.links = (resume.personal.links ?? []).map(l => ({ ...l, id: uid() }))
    resume.name = data.name || base
    return { source: 'json', summary: summarise(resume), layout: null, design: null, build: () => resume }
  }

  if (ext === 'zip') return parseLinkedInZip(file)

  const { lines, doc } = await extractLines(file)
  if (ext === 'pdf' && isLinkedInPdf(lines)) return parseLinkedInPdf(lines) // LinkedIn has its own fixed layout
  const text = parseResume(lines, base) // tags each line's role, used by the passes below
  const layout = analyzeLayout(doc, lines)
  const design = analyzeDesign(doc, lines)

  const build = ({ layout: useLayout = true, design: useDesign = true } = {}) => {
    const resume = structuredClone(text)
    const settings = { ...DEFAULT_SETTINGS, applyAccent: { ...DEFAULT_SETTINGS.applyAccent } }
    if (useLayout) Object.assign(settings, layout.settings)
    else resume.sections.forEach(s => { s.column = TYPE_COLUMN(s.type) })
    if (useDesign) {
      const { applyAccent, ...rest } = design.settings
      Object.assign(settings, rest)
      if (applyAccent) settings.applyAccent = { ...settings.applyAccent, ...applyAccent }
    }
    resume.settings = settings
    return resume
  }

  return { source: ext, summary: summarise(text), layout, design, build }
}
