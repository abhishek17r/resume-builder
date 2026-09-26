// Design templates: ten distinct looks. Each differs in structure (columns, header placement,
// entry layout, heading treatment) and typography — not just colour. Applying one replaces the
// design settings; content is never touched. Colours can be changed afterwards in Customize.

export const TEMPLATES = [
  {
    id: 'harbor', name: 'Harbor', style: 'Dark sidebar, header inside',
    settings: {
      columns: 'two', headerPosition: 'left', leftWidth: 35, colorMode: 'multi', colorArea: 'column',
      bodyFont: 'PT Serif', nameFont: '', headingStyle: 'plain', headingCaps: 'capitalize', datePosition: 'below',
      detailsArrangement: 'icon', iconStyle: 'none', titleStyle: 'italic',
      text: '#1f2a6b', bg: '#fdfbf8', accent: '#1f2a6b', text2: '#ffffff', bg2: '#16195a', accent2: '#ffffff',
    },
  },
  {
    id: 'scholar', name: 'Scholar', style: 'Classic, centred, one column',
    settings: {
      columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'column',
      bodyFont: 'EB Garamond', nameFont: '', baseSize: 10, headingStyle: 'underline', headingCaps: 'uppercase',
      datePosition: 'right', headerAlign: 'center', detailsArrangement: 'bar', titleStyle: 'italic',
      text: '#1d1d1f', bg: '#ffffff', accent: '#1d1d1f',
    },
  },
  {
    id: 'current', name: 'Current', style: 'Modern, clean lines',
    settings: {
      columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'column',
      bodyFont: 'Inter', nameFont: '', headingStyle: 'line', headingCaps: 'uppercase', datePosition: 'right',
      headerAlign: 'left', detailsArrangement: 'icon', iconStyle: 'none', titleStyle: 'normal', lineHeight: 1.3,
      text: '#1f2937', bg: '#ffffff', accent: '#0e6ba8', applyAccent: { name: false, headings: true, entryTitle: false, dates: false, headerIcons: true, linkIcons: true, jobTitle: true, entrySubtitle: false },
    },
  },
  {
    id: 'keystone', name: 'Keystone', style: 'Colour banner over two columns',
    settings: {
      columns: 'two', headerPosition: 'top', leftWidth: 32, colorMode: 'multi', colorArea: 'column',
      bodyFont: 'Lato', nameFont: 'Merriweather', headingStyle: 'line', headingCaps: 'uppercase', datePosition: 'right',
      headerAlign: 'left', detailsArrangement: 'icon', iconStyle: 'rounded', titleStyle: 'normal',
      text: '#1d2b24', bg: '#ffffff', accent: '#2f6b4f', text2: '#ffffff', bg2: '#23433a', accent2: '#b9e2c9',
    },
  },
  {
    id: 'milestone', name: 'Milestone', style: 'Timeline with a dates column',
    settings: {
      columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'column', entryLayout: 'columns',
      bodyFont: 'IBM Plex Sans', nameFont: '', headingStyle: 'fill', headingCaps: 'uppercase',
      headerAlign: 'left', detailsArrangement: 'icon', iconStyle: 'circle', titleStyle: 'normal',
      text: '#231942', bg: '#ffffff', accent: '#5b3cc4',
    },
  },
  {
    id: 'meridian', name: 'Meridian', style: 'Light sidebar on the right',
    settings: {
      columns: 'two', headerPosition: 'right', leftWidth: 33, colorMode: 'multi', colorArea: 'column',
      bodyFont: 'Source Sans 3', nameFont: 'Source Serif 4', headingStyle: 'dotted', headingCaps: 'uppercase', datePosition: 'below',
      detailsArrangement: 'icon', iconStyle: 'circle-outline', titleStyle: 'normal',
      text: '#2b2b2b', bg: '#ffffff', accent: '#c2573a', text2: '#2b2b2b', bg2: '#f6e3d9', accent2: '#b24a2f',
    },
  },
  {
    id: 'brief', name: 'Brief', style: 'Compact, fits more on a page',
    settings: {
      columns: 'mix', headerPosition: 'top', colorMode: 'single', colorArea: 'column',
      bodyFont: 'Roboto', nameFont: '', baseSize: 8.5, sectionGap: 3, entryGap: 3, lineHeight: 1.15, marginX: 8, marginY: 8,
      headingStyle: 'overline', headingCaps: 'uppercase', datePosition: 'right', headerAlign: 'left', detailsArrangement: 'bullet', titleStyle: 'normal',
      text: '#222222', bg: '#ffffff', accent: '#222222',
    },
  },
  {
    id: 'margin', name: 'Margin', style: 'Accent edge with bar headings',
    settings: {
      columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'border',
      bodyFont: 'Open Sans', nameFont: 'Playfair Display', headingStyle: 'bar', headingCaps: 'capitalize', datePosition: 'right',
      headerAlign: 'left', detailsArrangement: 'bullet', titleStyle: 'italic',
      text: '#2b2b2b', bg: '#ffffff', accent: '#b5647a',
    },
  },
  {
    id: 'frame', name: 'Frame', style: 'Elegant, boxed headings with icons',
    settings: {
      columns: 'one', headerPosition: 'top', colorMode: 'single', colorArea: 'column',
      bodyFont: 'Lora', nameFont: 'Playfair Display', headingStyle: 'box', headingCaps: 'uppercase', headingIcons: 'outline',
      datePosition: 'right', headerAlign: 'center', detailsArrangement: 'icon', iconStyle: 'circle-outline', titleStyle: 'italic',
      subtitleStyle: 'italic', text: '#1c1c1c', bg: '#fffdf7', accent: '#9a7b2f',
    },
  },
  {
    id: 'nightfall', name: 'Nightfall', style: 'Full-colour page',
    settings: {
      columns: 'two', headerPosition: 'left', leftWidth: 34, colorMode: 'single', colorArea: 'full',
      bodyFont: 'Montserrat', nameFont: '', headingStyle: 'underline', headingCaps: 'uppercase', datePosition: 'below',
      detailsArrangement: 'icon', iconStyle: 'none', titleStyle: 'normal',
      text: '#ffffff', bg: '#ffffff', accent: '#1f2937',
    },
  },
]

// Settings a template never changes (they're about the document, not its look).
export const KEEP_ON_TEMPLATE = ['language', 'dateFormat', 'pageFormat', 'showPhoto']
