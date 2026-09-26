import { SECTION_TYPES } from '../sections'
import { formatRange } from '../format'
import { getItems } from './bullets'

// The compact resume payload the API reads: sections → entries → numbered bullets.
// Entry/section ids are the app's own, so suggestions can be applied back exactly.
export function resumeToPayload(resume) {
  const s = resume.settings
  return {
    name: resume.personal.fullName || '',
    title: resume.personal.jobTitle || '',
    sections: resume.sections.filter(x => !x.hidden).map(sec => {
      const def = SECTION_TYPES[sec.type]
      return {
        id: sec.id,
        type: sec.type,
        heading: sec.heading,
        entries: sec.entries.filter(e => !e.hidden).map(e => {
          const rich = def.fields.find(f => f.kind === 'rich')
          const [title = '', subtitle = ''] = def.title ? def.title(e) : [e.fullName ?? '', e.place ?? '']
          const hasStart = def.fields.some(f => f.key === 'startDate')
          return {
            id: e.id,
            title: String(title ?? ''),
            subtitle: String(subtitle ?? ''),
            dates: def.fields.some(f => f.kind === 'month') ? formatRange(e.startDate, e.endDate, s.dateFormat, { hasStart }) : '',
            location: e.location ?? '',
            bullets: [
              ...(rich ? getItems(e[rich.key]) : []),
              // Skill-like entries: their details read as one bullet so the model can see them.
              ...(!rich && e.info ? [{ i: 0, text: e.info }] : []),
            ].map(({ i, text }) => ({ i, text })),
          }
        }),
      }
    }),
  }
}

// A reference to one bullet, used for issue ids and API refs.
export const refKey = (sectionId, entryId, bullet) => `${sectionId}/${entryId}/${bullet}`
