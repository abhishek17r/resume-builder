// Resume fonts (all on Google Fonts) and on-demand loading, so the list can be long
// without every page downloading every family.

export const FONTS = [
  { name: 'PT Serif', cat: 'serif' },
  { name: 'Merriweather', cat: 'serif' },
  { name: 'Lora', cat: 'serif' },
  { name: 'Playfair Display', cat: 'serif' },
  { name: 'EB Garamond', cat: 'serif' },
  { name: 'Libre Baskerville', cat: 'serif' },
  { name: 'Source Serif 4', cat: 'serif' },
  { name: 'Noto Serif', cat: 'serif' },
  { name: 'Roboto Slab', cat: 'serif' },
  { name: 'Tinos', cat: 'serif' }, // Times New Roman metrics
  { name: 'Gelasio', cat: 'serif' }, // Georgia metrics
  { name: 'Caladea', cat: 'serif' }, // Cambria metrics
  { name: 'Lato', cat: 'sans' },
  { name: 'Roboto', cat: 'sans' },
  { name: 'Open Sans', cat: 'sans' },
  { name: 'Source Sans 3', cat: 'sans' },
  { name: 'Inter', cat: 'sans' },
  { name: 'IBM Plex Sans', cat: 'sans' },
  { name: 'DM Sans', cat: 'sans' },
  { name: 'Montserrat', cat: 'sans' },
  { name: 'Raleway', cat: 'sans' },
  { name: 'Poppins', cat: 'sans' },
  { name: 'Nunito', cat: 'sans' },
  { name: 'Work Sans', cat: 'sans' },
  { name: 'Noto Sans', cat: 'sans' },
  { name: 'Arimo', cat: 'sans' }, // Arial / Helvetica metrics
  { name: 'Crimson Pro', cat: 'serif' },
  { name: 'Cormorant Garamond', cat: 'serif' },
  { name: 'Spectral', cat: 'serif' },
  { name: 'Bitter', cat: 'serif' },
  { name: 'Karla', cat: 'sans' },
  { name: 'Rubik', cat: 'sans' },
  { name: 'Manrope', cat: 'sans' },
  { name: 'Fira Sans', cat: 'sans' },
  { name: 'Barlow', cat: 'sans' },
  { name: 'Mulish', cat: 'sans' },
  { name: 'Ubuntu', cat: 'sans' },
  { name: 'Josefin Sans', cat: 'sans' },
  { name: 'IBM Plex Mono', cat: 'mono' },
  { name: 'JetBrains Mono', cat: 'mono' },
  { name: 'Roboto Mono', cat: 'mono' },
]

const BY_NAME = new Map(FONTS.map(f => [f.name, f]))
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const BY_NORM = new Map(FONTS.map(f => [norm(f.name), f.name]))

// Common desktop/PDF fonts → closest web font we can load.
const ALIASES = {
  arial: 'Arimo', helvetica: 'Arimo', helveticaneue: 'Arimo', liberationsans: 'Arimo', arialmt: 'Arimo',
  timesnewroman: 'Tinos', times: 'Tinos', timesnewromanpsmt: 'Tinos', liberationserif: 'Tinos',
  georgia: 'Gelasio', cambria: 'Caladea', calibri: 'Lato', carlito: 'Lato',
  garamond: 'EB Garamond', ebgaramond: 'EB Garamond', baskerville: 'Libre Baskerville',
  sourcesanspro: 'Source Sans 3', sourceserifpro: 'Source Serif 4', segoeui: 'Open Sans',
  verdana: 'Open Sans', tahoma: 'Open Sans', trebuchetms: 'Source Sans 3', gillsans: 'Lato',
  futura: 'Montserrat', avenir: 'Nunito', avenirnext: 'Nunito', proximanova: 'Montserrat',
  couriernew: 'Roboto Mono', courier: 'Roboto Mono', consolas: 'JetBrains Mono', menlo: 'JetBrains Mono', monaco: 'JetBrains Mono',
  sfprotext: 'Inter', sfprodisplay: 'Inter', sanfrancisco: 'Inter', bookantiqua: 'EB Garamond', palatino: 'EB Garamond',
}

export const fontCategory = name => BY_NAME.get(name)?.cat ?? (/serif|garamond|times|georgia|baskerville|slab/i.test(name) && !/sans/i.test(name) ? 'serif' : 'sans')

export const fontStack = name => {
  const cat = fontCategory(name)
  return `"${name}", ${cat === 'serif' ? 'Georgia, serif' : cat === 'mono' ? 'Menlo, monospace' : 'Helvetica, Arial, sans-serif'}`
}

// "ABCDEF+PTSerif-BoldItalic" → { family: "PT Serif", bold: true, italic: true, raw: "PTSerif" }
export function mapPdfFont(pdfName = '') {
  const base = pdfName.replace(/^[A-Z]{6}\+/, '')
  const [fam, style = ''] = base.split(/[-,]/)
  const styleAll = `${style} ${base}`
  const bold = /bold|black|heavy|semibold|demi/i.test(styleAll)
  const italic = /italic|oblique/i.test(styleAll)
  const key = norm(fam.replace(/(MT|PS|Std|Pro|LT)$/g, ''))
  const family = BY_NORM.get(key) ?? BY_NORM.get(norm(fam)) ?? ALIASES[key] ?? ALIASES[norm(fam)] ?? null
  return { family, bold, italic, raw: fam }
}

// Inject a Google Fonts stylesheet for a family once.
// Google Fonts rejects requests for styles a family doesn't have.
const AXES = {
  'Roboto Slab': 'wght@400;700', 'Libre Baskerville': 'ital,wght@0,400;0,700;1,400',
  'Ubuntu': 'ital,wght@0,400;0,700;1,400;1,700', 'Josefin Sans': 'ital,wght@0,400;0,700;1,400;1,700',
  'Manrope': 'wght@400;700', // no italics
}
const loaded = new Set(['DM Sans'])
export function ensureFont(name) {
  if (!name || loaded.has(name) || !BY_NAME.has(name)) return
  loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:${AXES[name] ?? 'ital,wght@0,400;0,700;1,400;1,700'}&display=swap`
  document.head.appendChild(link)
}
