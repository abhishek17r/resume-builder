import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { GripVertical, RotateCcw, Minus, Plus, Minimize2, Loader2, Check } from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { SECTION_TYPES } from '../lib/sections'
import { DATE_FORMATS, LANGUAGES } from '../lib/format'
import { SortableList, SortableItem } from './Sortable'
import { Segmented, Tiles, Select, Toggle, Chip, ColorInput } from './Controls'
import { TEMPLATES, KEEP_ON_TEMPLATE } from '../lib/templates'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { TemplateCard } from './TemplateGallery'
import { FONTS as FONT_LIST, ensureFont } from '../lib/fonts'

// Design, in three layers: pick a style, dial it in with a few high-level controls
// (accent, type pairing, density, fit to a page), then fine-tune any detail.

// Colour sets: [text, background, accent, sideText, sideBackground, sideAccent]
const PALETTES = [
  ['Navy', ['#1f2a6b', '#fdfbf8', '#1f2a6b', '#ffffff', '#16195a', '#ffffff']],
  ['Charcoal', ['#222222', '#ffffff', '#222222', '#f5f5f5', '#2b2b2b', '#ffffff']],
  ['Forest', ['#1d2b24', '#ffffff', '#2f6b4f', '#1d2b24', '#e7efe9', '#2f6b4f']],
  ['Plum', ['#2d1b36', '#fffafc', '#7a2a6b', '#ffffff', '#4a1f45', '#f6c9e8']],
  ['Ocean', ['#10263b', '#ffffff', '#0e6ba8', '#ffffff', '#0e3a5c', '#8fd3ff']],
  ['Terracotta', ['#2b2b2b', '#fffaf6', '#c2573a', '#2b2b2b', '#f6e3d9', '#c2573a']],
  ['Slate', ['#27303f', '#ffffff', '#27303f', '#f1f5f9', '#2f3a4b', '#93c5fd']],
  ['Gold', ['#1c1c1c', '#fffdf7', '#9a7b2f', '#fffdf7', '#1c1c1c', '#d9b95b']],
]

// Type pairings: a body font and (optionally) a different font for the name.
const PAIRINGS = [
  { id: 'classic', label: 'Classic', note: 'Garamond', bodyFont: 'EB Garamond', nameFont: '' },
  { id: 'editorial', label: 'Editorial', note: 'Source Serif · Playfair', bodyFont: 'Source Serif 4', nameFont: 'Playfair Display' },
  { id: 'modern', label: 'Modern', note: 'Inter', bodyFont: 'Inter', nameFont: '' },
  { id: 'humanist', label: 'Humanist', note: 'Source Sans · Lora', bodyFont: 'Source Sans 3', nameFont: 'Lora' },
  { id: 'friendly', label: 'Friendly', note: 'Lato · Montserrat', bodyFont: 'Lato', nameFont: 'Montserrat' },
  { id: 'technical', label: 'Technical', note: 'IBM Plex', bodyFont: 'IBM Plex Sans', nameFont: 'IBM Plex Mono' },
]

// Density moves size, line height, spacing and margins together, relative to the template as designed.
const DENSITY_KEYS = ['baseSize', 'lineHeight', 'sectionGap', 'entryGap', 'marginX', 'marginY']
const DENSITY = [
  { id: 'compact', label: 'Compact', note: 'Fits more on a page', d: { baseSize: -0.5, lineHeight: -0.05, sectionGap: -1, entryGap: -1, marginX: -2, marginY: -2 } },
  { id: 'balanced', label: 'Balanced', note: 'The template as designed', d: {} },
  { id: 'airy', label: 'Airy', note: 'More white space', d: { baseSize: 0.5, lineHeight: 0.1, sectionGap: 2, entryGap: 1, marginX: 4, marginY: 4 } },
]
const densityValues = (s, d) => {
  const base = { ...DEFAULT_SETTINGS, ...(TEMPLATES.find(t => t.id === s.templateId)?.settings ?? {}) }
  return Object.fromEntries(DENSITY_KEYS.map(k => [k, +(base[k] + (d.d[k] ?? 0)).toFixed(2)]))
}

const TABS = [['type', 'Type'], ['layout', 'Layout'], ['colour', 'Colour'], ['page', 'Page'], ['details', 'Details']]
const FONTS = FONT_LIST.map(f => f.name)

// Load a font preview only when it scrolls into view.
const lazyFont = name => el => {
  if (!el || el.dataset.watched) return
  el.dataset.watched = '1'
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ensureFont(name); io.disconnect() } })
  io.observe(el)
}

export default function CustomizePanel() {
  const r = useResume()
  const s = r.settings
  const { setSetting: set, resetSettings, applyPreset, applyTemplate } = useStore()
  const [tab, setTab] = useState('type')

  return (
    <div className="space-y-4 pb-24">
      <StyleStrip r={r} s={s} onApply={t => applyTemplate(t, KEEP_ON_TEMPLATE)} onReset={() => confirm('Reset the design to the default template?') && resetSettings()} />
      <QuickControls s={s} set={set} applyPreset={applyPreset} />

      <section className="card overflow-hidden">
        <div className="flex items-center gap-5 border-b border-rule px-5">
          <h2 className="display py-3 text-[22px] leading-none text-ink">Fine-tune</h2>
          <nav className="ml-auto flex gap-4 overflow-x-auto">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={clsx('-mb-px border-b-2 py-3 text-[13.5px] transition', tab === id ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="px-5 pb-3">
          {tab === 'type' && <TypeTab s={s} set={set} />}
          {tab === 'layout' && <LayoutTab r={r} s={s} set={set} />}
          {tab === 'colour' && <ColourTab s={s} set={set} applyPreset={applyPreset} />}
          {tab === 'page' && <PageTab s={s} set={set} />}
          {tab === 'details' && <DetailsTab r={r} s={s} set={set} />}
        </div>
      </section>
    </div>
  )
}

/* ---------------- 1. style ---------------- */

function StyleStrip({ r, s, onApply, onReset }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="display text-[22px] leading-none text-ink">Style</h2>
        <span className="text-[12px] text-muted">Start from a template; everything below adjusts it.</span>
        <button onClick={onReset} className="ml-auto flex items-center gap-1 text-[12px] text-muted hover:text-ink" title="Back to the default template"><RotateCcw size={12} /> Reset</button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TEMPLATES.map(t => (
          <div key={t.id} className="shrink-0">
            <TemplateCard resume={r} template={t} width={104} compact active={s.templateId === t.id} onApply={onApply} />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------------- 2. quick controls ---------------- */

function QuickControls({ s, set, applyPreset }) {
  const density = DENSITY.find(d => Object.entries(densityValues(s, d)).every(([k, v]) => s[k] === v))?.id
  const pairing = PAIRINGS.find(p => p.bodyFont === s.bodyFont && (p.nameFont || '') === (s.nameFont || ''))?.id
  return (
    <section className="card divide-y divide-rule">
      <QuickRow label="Accent">
        <div className="flex flex-wrap items-center gap-2">
          {PALETTES.map(([label, [text, bg, accent, text2, bg2, accent2]]) => {
            const on = s.accent === accent && s.bg2 === bg2
            return (
              <button key={label} title={label} onClick={() => applyPreset({ text, bg, accent, text2, bg2, accent2 })}
                className={clsx('relative grid h-7 w-7 place-items-center rounded-full ring-offset-2 transition', on ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-rule')}
                style={{ background: `linear-gradient(135deg, ${accent} 50%, ${bg2} 50%)` }}>
                {on && <Check size={13} className="text-white drop-shadow" />}
              </button>
            )
          })}
          <label className="relative ml-1 flex cursor-pointer items-center gap-1.5 text-[12px] text-muted hover:text-ink" title="Pick any accent colour">
            <span className="h-7 w-7 rounded-full border border-dashed border-ink/30" style={{ background: s.accent }} />
            Custom
            <input type="color" value={s.accent} onChange={e => set('accent', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      </QuickRow>

      <QuickRow label="Type">
        <div className="grid grid-cols-3 gap-1.5">
          {PAIRINGS.map(p => (
            <button key={p.id} onClick={() => applyPreset({ bodyFont: p.bodyFont, nameFont: p.nameFont })} ref={el => { lazyFont(p.bodyFont)(el); if (p.nameFont) lazyFont(p.nameFont)(el) }}
              className={clsx('rounded-md border px-2.5 py-2 text-left transition', pairing === p.id ? 'border-ink bg-white ring-1 ring-ink' : 'border-rule bg-white hover:border-ink/40')}>
              <span className="block text-[18px] leading-none text-ink" style={{ fontFamily: `"${p.nameFont || p.bodyFont}"` }}>Aa</span>
              <span className="mt-1 block text-[12.5px] font-medium text-ink" style={{ fontFamily: `"${p.bodyFont}"` }}>{p.label}</span>
              <span className="meta block truncate text-[10.5px] text-muted">{p.note}</span>
            </button>
          ))}
        </div>
      </QuickRow>

      <QuickRow label="Density">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-rule bg-white">
            {DENSITY.map((d, i) => (
              <button key={d.id} onClick={() => applyPreset(densityValues(s, d))} title={d.note}
                className={clsx('px-4 py-1.5 text-[13.5px] transition', i > 0 && 'border-l border-rule', density === d.id ? 'bg-ink text-white' : 'text-body hover:bg-field hover:text-ink')}>
                {d.label}
              </button>
            ))}
          </div>
          {!density && <span className="meta text-muted">custom</span>}
          <FitToPage applyPreset={applyPreset} />
        </div>
      </QuickRow>
    </section>
  )
}

function QuickRow({ label, children }) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-start gap-3 px-5 py-4">
      <span className="pt-1.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// Tighten spacing, margins, line height and finally the font size, one notch at a time, until it fits.
const FIT_STEPS = [
  ['sectionGap', -1, 2], ['entryGap', -1, 2], ['marginY', -2, 6], ['marginX', -2, 6],
  ['lineHeight', -0.05, 1.1], ['baseSize', -0.5, 8],
]
function FitToPage({ applyPreset }) {
  const pages = useStore(st => st.pageCount)
  const [state, setState] = useState(null) // null | 'fitting' | 'done' | 'failed'
  useEffect(() => { if (state && state !== 'fitting') { const t = setTimeout(() => setState(null), 3500); return () => clearTimeout(t) } }, [state])
  const fit = async () => {
    setState('fitting')
    const before = Object.fromEntries(DENSITY_KEYS.map(k => [k, useStore.getState().current().settings[k]]))
    const wait = () => new Promise(res => setTimeout(res, 320))
    for (let round = 0; round < 6; round++) {
      for (const [key, delta, floor] of FIT_STEPS) {
        if (useStore.getState().pageCount <= 1) { setState('done'); return }
        const cur = useStore.getState().current().settings[key]
        const next = +(cur + delta).toFixed(2)
        if (next < floor) continue
        applyPreset({ [key]: next })
        await wait()
      }
    }
    if (useStore.getState().pageCount <= 1) { setState('done'); return }
    // Even the tightest settings don't fit: put the spacing back rather than leave it cramped.
    applyPreset(before)
    setState('failed')
  }
  if (pages <= 1 && state !== 'done') return <span className="meta text-muted">1 page</span>
  return (
    <button onClick={fit} disabled={state === 'fitting'}
      className="flex items-center gap-1.5 rounded-md border border-rule bg-white px-3 py-1.5 text-[13px] font-medium text-ink hover:border-ink/40 disabled:opacity-60"
      title="Tighten spacing, margins and size until the resume fits on one page">
      {state === 'fitting' ? <Loader2 size={13} className="animate-spin" /> : <Minimize2 size={13} />}
      {state === 'fitting' ? 'Fitting…' : state === 'done' ? 'Fits on 1 page' : state === 'failed' ? 'Too long for 1 page: trim content' : `Fit ${pages} pages to 1`}
    </button>
  )
}

/* ---------------- 3. fine-tune ---------------- */

// One setting per row: label on the left, control on the right.
function Row({ label, hint, children }) {
  return (
    <div className="grid grid-cols-[132px_1fr] items-center gap-3 border-b border-rule/60 py-3 last:border-b-0">
      <div>
        <p className="text-[13px] text-ink">{label}</p>
        {hint && <p className="text-[11.5px] leading-snug text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// A compact number control: slider, value and − / + nudges.
function Num({ value, min, max, step, onChange, unit = '', sign = false }) {
  const clamp = v => Math.min(max, Math.max(min, +v.toFixed(2)))
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(clamp(+e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[#17171b]" />
      <button onClick={() => onChange(clamp(value - step))} disabled={value <= min} className="grid h-7 w-7 place-items-center rounded border border-rule bg-white text-ink hover:border-ink/40 disabled:opacity-30"><Minus size={12} /></button>
      <span className="meta w-14 text-center text-ink">{sign && value > 0 ? '+' : ''}{value}{unit}</span>
      <button onClick={() => onChange(clamp(value + step))} disabled={value >= max} className="grid h-7 w-7 place-items-center rounded border border-rule bg-white text-ink hover:border-ink/40 disabled:opacity-30"><Plus size={12} /></button>
    </div>
  )
}

function TypeTab({ s, set }) {
  const [cat, setCat] = useState('all')
  const fonts = useMemo(() => FONT_LIST.filter(f => cat === 'all' || f.cat === cat), [cat])
  return (
    <>
      <Row label="Body font">
        <div className="mb-2 inline-flex overflow-hidden rounded-md border border-rule bg-white text-[12.5px]">
          {[['all', 'All'], ['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']].map(([v, l], i) => (
            <button key={v} onClick={() => setCat(v)} className={clsx('px-3 py-1', i > 0 && 'border-l border-rule', cat === v ? 'bg-ink text-white' : 'text-body hover:bg-field')}>{l}</button>
          ))}
        </div>
        <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto pr-1 sm:grid-cols-3">
          {fonts.map(({ name: f }) => (
            <button key={f} onClick={() => set('bodyFont', f)} style={{ fontFamily: `"${f}"` }} ref={lazyFont(f)}
              className={clsx('truncate rounded px-2 py-1.5 text-left text-[14px] transition', s.bodyFont === f ? 'bg-ink text-white' : 'text-ink hover:bg-field')}>
              {f}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Name font"><Select value={s.nameFont} onChange={v => set('nameFont', v)} options={[{ value: '', label: 'Same as body' }, ...FONTS]} /></Row>
      <Row label="Base size"><Num value={s.baseSize} min={8} max={12} step={0.5} unit="pt" onChange={v => set('baseSize', v)} /></Row>
      <Row label="Name" hint="Above base size"><Num value={s.nameSize} min={5} max={17} step={1} unit="pt" sign onChange={v => set('nameSize', v)} /></Row>
      <Row label="Title"><Num value={s.titleSize} min={0} max={6} step={0.5} unit="pt" sign onChange={v => set('titleSize', v)} /></Row>
      <Row label="Section headings"><Num value={s.headingSize} min={0} max={6} step={0.5} unit="pt" sign onChange={v => set('headingSize', v)} /></Row>
      <Row label="Entry titles"><Num value={s.entrySize} min={0} max={3} step={0.5} unit="pt" sign onChange={v => set('entrySize', v)} /></Row>
      <Row label="Line height"><Num value={s.lineHeight} min={1} max={2} step={0.05} onChange={v => set('lineHeight', v)} /></Row>
      <Row label="Heading case"><Segmented value={s.headingCaps} onChange={v => set('headingCaps', v)} options={[{ value: 'capitalize', label: 'Title Case' }, { value: 'uppercase', label: 'UPPERCASE' }]} /></Row>
      <Row label="Job title"><Segmented value={s.titleStyle ?? 'italic'} onChange={v => set('titleStyle', v)} options={[{ value: 'italic', label: 'Italic' }, { value: 'normal', label: 'Upright' }]} /></Row>
      <Row label="Entry subtitle" hint="Employer, school or issuer"><Segmented value={s.subtitleStyle ?? 'bold'} onChange={v => set('subtitleStyle', v)} options={[{ value: 'bold', label: 'Bold' }, { value: 'italic', label: 'Italic' }, { value: 'normal', label: 'Plain' }]} /></Row>
    </>
  )
}

function LayoutTab({ r, s, set }) {
  const { setSectionColumn, moveSection } = useStore()
  return (
    <>
      <Row label="Columns">
        <Tiles size="sm" value={s.columns} onChange={v => set('columns', v)} options={[
          { value: 'one', label: 'One', art: a => <ColArt a={a} kind="one" /> },
          { value: 'two', label: 'Two', art: a => <ColArt a={a} kind="two" /> },
          { value: 'mix', label: 'Mixed', art: a => <ColArt a={a} kind="mix" /> },
        ]} />
      </Row>
      {s.columns === 'two' && (
        <>
          <Row label="Header"><Segmented value={s.headerPosition} onChange={v => set('headerPosition', v)} options={[{ value: 'top', label: 'Top' }, { value: 'left', label: 'In side column' }, { value: 'right', label: 'Right' }]} /></Row>
          <Row label="Side column" hint={`Main column ${100 - s.leftWidth}%`}><Num value={s.leftWidth} min={25} max={50} step={1} unit="%" onChange={v => set('leftWidth', v)} /></Row>
        </>
      )}
      <Row label="Entries"><Segmented value={s.entryLayout} onChange={v => set('entryLayout', v)} options={[{ value: 'full', label: 'Full width' }, { value: 'columns', label: 'Dates in a column' }]} /></Row>
      {s.entryLayout === 'full' && (
        <Row label="Dates & location"><Segmented value={s.datePosition} onChange={v => set('datePosition', v)} options={[{ value: 'right', label: 'Right' }, { value: 'below', label: 'Below title' }]} /></Row>
      )}
      <Row label="Subtitle placement"><Segmented value={s.subtitlePlacement ?? 'same'} onChange={v => set('subtitlePlacement', v)} options={[{ value: 'same', label: 'Same line' }, { value: 'next', label: 'Next line' }]} /></Row>
      <Row label="Bullets"><Segmented value={s.listStyle ?? 'bullet'} onChange={v => set('listStyle', v)} options={[{ value: 'bullet', label: '•' }, { value: 'hyphen', label: '–' }, { value: 'none', label: 'None' }]} /></Row>
      <Row label="Bullet indent"><Num value={s.bulletIndent ?? 0} min={0} max={8} step={1} unit="mm" onChange={v => set('bulletIndent', v)} /></Row>
      {s.columns !== 'one' && (
        <div className="py-3">
          <p className="text-[13px] text-ink">Sections</p>
          <p className="mb-2 text-[11.5px] text-muted">{s.columns === 'two' ? 'Drag to reorder; choose the column for each.' : 'Neighbouring half-width sections sit side by side.'}</p>
          <SectionLayout sections={r.sections} columns={s.columns} onMove={moveSection} onColumn={setSectionColumn} />
        </div>
      )}
    </>
  )
}

function ColourTab({ s, set, applyPreset }) {
  const { setAccentTarget } = useStore()
  return (
    <>
      <Row label="Scheme" hint={s.colorMode === 'single' ? 'One set of colours' : 'Header or side area gets its own'}>
        <Segmented value={s.colorMode} onChange={v => set('colorMode', v)} options={[{ value: 'single', label: 'Single' }, { value: 'multi', label: 'Two-tone' }]} />
      </Row>
      <Row label="Colour area"><Segmented value={s.colorArea} onChange={v => set('colorArea', v)} options={[{ value: 'full', label: 'Full page' }, { value: 'column', label: s.columns === 'two' ? 'Column / header' : 'Header' }, { value: 'border', label: 'Border' }]} /></Row>
      <Row label={s.colorMode === 'multi' ? 'Main area' : 'Colours'}>
        <div className="flex gap-5">
          <ColorInput label="Text" value={s.text} onChange={v => set('text', v)} />
          <ColorInput label="Background" value={s.bg} onChange={v => set('bg', v)} />
          <ColorInput label="Accent" value={s.accent} onChange={v => set('accent', v)} />
        </div>
      </Row>
      {s.colorMode === 'multi' && (
        <Row label="Header / side">
          <div className="flex gap-5">
            <ColorInput label="Text" value={s.text2} onChange={v => set('text2', v)} />
            <ColorInput label="Background" value={s.bg2} onChange={v => set('bg2', v)} />
            <ColorInput label="Accent" value={s.accent2} onChange={v => set('accent2', v)} />
          </div>
        </Row>
      )}
      <Row label="Accent on">
        <div className="flex flex-wrap gap-1.5">
          {[['name', 'Name'], ['jobTitle', 'Job title'], ['headings', 'Headings'], ['headerIcons', 'Header icons'], ['dates', 'Dates'], ['entryTitle', 'Entry title'], ['entrySubtitle', 'Entry subtitle'], ['linkIcons', 'Link icons']].map(([k, l]) => (
            <Chip key={k} checked={s.applyAccent[k]} onChange={v => setAccentTarget(k, v)}>{l}</Chip>
          ))}
        </div>
      </Row>
      <Row label="Links">
        <div className="space-y-2">
          <Toggle checked={s.linkUnderline} onChange={v => set('linkUnderline', v)} label="Underline" />
          <Toggle checked={s.linkBlue} onChange={v => set('linkBlue', v)} label="Blue" />
        </div>
      </Row>
    </>
  )
}

function PageTab({ s, set }) {
  return (
    <>
      <Row label="Page size"><Select value={s.pageFormat} options={[{ value: 'A4', label: 'A4 (210 × 297 mm)' }, { value: 'Letter', label: 'US Letter (8.5 × 11 in)' }]} onChange={v => set('pageFormat', v)} /></Row>
      <Row label="Side margins"><Num value={s.marginX} min={4} max={24} step={1} unit="mm" onChange={v => set('marginX', v)} /></Row>
      <Row label="Top & bottom"><Num value={s.marginY} min={4} max={24} step={1} unit="mm" onChange={v => set('marginY', v)} /></Row>
      <Row label="Between sections"><Num value={s.sectionGap} min={1} max={9} step={1} onChange={v => set('sectionGap', v)} /></Row>
      <Row label="Between entries"><Num value={s.entryGap ?? 4} min={1} max={9} step={1} onChange={v => set('entryGap', v)} /></Row>
      <Row label="Dates"><Select value={s.dateFormat} options={DATE_FORMATS} onChange={v => set('dateFormat', v)} /></Row>
      <Row label="Language" hint={`Month names and “${(LANGUAGES[s.language] ?? LANGUAGES.en).present}”`}>
        <Select value={s.language ?? 'en'} options={Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l.label }))} onChange={v => set('language', v)} />
      </Row>
      <Row label="Footer">
        <div className="space-y-2">
          <Toggle checked={s.footerName} onChange={v => set('footerName', v)} label="Name" />
          <Toggle checked={s.footerEmail} onChange={v => set('footerEmail', v)} label="Email" />
          <Toggle checked={s.footerPageNumbers} onChange={v => set('footerPageNumbers', v)} label="Page numbers" />
        </div>
      </Row>
    </>
  )
}

function DetailsTab({ r, s, set }) {
  return (
    <>
      <Row label="Section headings">
        <div className="grid grid-cols-4 gap-1.5">
          {['plain', 'underline', 'overline', 'line', 'box', 'bar', 'dotted', 'fill'].map(st => (
            <button key={st} onClick={() => set('headingStyle', st)} title={st}
              className={clsx('grid h-11 place-items-center rounded-md border bg-white transition', s.headingStyle === st ? 'border-ink ring-1 ring-ink' : 'border-rule hover:border-ink/40')}>
              <HeadingArt style={st} a={s.headingStyle === st} />
            </button>
          ))}
        </div>
      </Row>
      <Row label="Heading icons"><Segmented value={s.headingIcons} onChange={v => set('headingIcons', v)} options={[{ value: 'none', label: 'None' }, { value: 'outline', label: 'Outline' }, { value: 'filled', label: 'Filled' }]} /></Row>
      <Row label="Name & title"><Segmented value={s.titlePlacement ?? 'below'} onChange={v => set('titlePlacement', v)} options={[{ value: 'below', label: 'Separate lines' }, { value: 'inline', label: 'Same line' }]} /></Row>
      <Row label="Header alignment"><Segmented value={s.headerAlign} onChange={v => set('headerAlign', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} /></Row>
      <Row label="Contact details"><Segmented value={s.detailsArrangement} onChange={v => set('detailsArrangement', v)} options={[{ value: 'icon', label: 'Icons' }, { value: 'bullet', label: 'a • b' }, { value: 'bar', label: 'a | b' }]} /></Row>
      {s.detailsArrangement === 'icon' && (
        <Row label="Icon frame">
          <div className="flex flex-wrap gap-1.5">
            {['none', 'circle', 'rounded', 'square', 'circle-outline', 'rounded-outline', 'square-outline'].map(v => {
              const [shape, variant] = v.split('-')
              const on = s.iconStyle === v
              return (
                <button key={v} onClick={() => set('iconStyle', v)} title={v === 'none' ? 'No frame' : `${shape} ${variant ? 'outline' : 'filled'}`}
                  className={clsx('grid h-9 w-9 place-items-center rounded-md border bg-white transition', on ? 'border-ink ring-1 ring-ink' : 'border-rule hover:border-ink/40')}>
                  {v === 'none'
                    ? <span className="text-[15px] leading-none text-ink">✉</span>
                    : <span className="grid h-5 w-5 place-items-center text-[10px]" style={{
                        borderRadius: { circle: '50%', rounded: 5, square: 0 }[shape],
                        background: variant ? 'transparent' : '#17171b', color: variant ? '#17171b' : '#fff', border: variant ? '1.5px solid #17171b' : 'none',
                      }}>✉</span>}
                </button>
              )
            })}
          </div>
        </Row>
      )}
      <Row label="Link icons"><Toggle checked={s.linkIcon} onChange={v => set('linkIcon', v)} label="After linked titles" /></Row>
      <Row label="Photo" hint={r.personal.photo ? null : 'Add one in Content → Header'}>
        <div className="space-y-2">
          <Toggle checked={s.showPhoto !== false} onChange={v => set('showPhoto', v)} label="Show on resume" />
          {s.showPhoto !== false && (
            <>
              <Num value={s.photoSize ?? 24} min={14} max={40} step={2} unit="mm" onChange={v => set('photoSize', v)} />
              <Segmented value={s.photoShape ?? 'circle'} onChange={v => set('photoShape', v)} options={[{ value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]} />
            </>
          )}
        </div>
      </Row>
    </>
  )
}

/* ---------------- section layout editor ---------------- */

function SectionLayout({ sections, columns, onMove, onColumn }) {
  return (
    <SortableList ids={sections.map(s => s.id)} onMove={onMove}>
      <div className="space-y-2">
        {sections.map(sec => {
          const Icon = SECTION_TYPES[sec.type].icon
          return (
            <SortableItem key={sec.id} id={sec.id}>
              {({ handleProps }) => (
                <div className={clsx('flex items-center gap-3 rounded-lg bg-soft px-3 py-2.5', sec.hidden && 'opacity-50')}>
                  <button {...handleProps} className="cursor-grab touch-none text-slate-400"><GripVertical size={17} /></button>
                  <Icon size={17} className="text-ink" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{sec.heading}</span>
                  <div className="flex overflow-hidden rounded-md border border-slate-200 text-[13px]">
                    {[['left', columns === 'two' ? 'Side' : 'Half'], ['right', columns === 'two' ? 'Main' : 'Full']].map(([v, l]) => (
                      <button key={v} onClick={() => onColumn(sec.id, v)}
                        className={clsx('px-3 py-1', (sec.column === 'left') === (v === 'left') ? 'bg-brand text-white' : 'bg-white text-ink hover:bg-slate-100')}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SortableItem>
          )
        })}
      </div>
    </SortableList>
  )
}

/* ---------------- tile artwork ---------------- */

const tone = a => (a ? '#17171b' : '#cdc8bc')

function ColArt({ a, kind }) {
  const c = tone(a)
  const bar = (w, key) => <div key={key} className="h-1.5 rounded-sm" style={{ width: w, background: c }} />
  if (kind === 'one') return <div className="space-y-1.5">{[56, 56, 56].map((w, i) => bar(w, i))}</div>
  if (kind === 'two') {
    return (
      <div className="flex gap-1.5">
        <div className="space-y-1.5">{[24, 24, 24].map((w, i) => bar(w, i))}</div>
        <div className="space-y-1.5">{[32, 32, 32].map((w, i) => bar(w, i))}</div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {bar(58)}
      <div className="flex gap-1.5">{bar(26)}{bar(26)}</div>
      {bar(58)}
    </div>
  )
}

function HeadingArt({ style, a }) {
  const c = tone(a)
  const text = <div className="h-1.5 w-8 rounded-sm" style={{ background: style === 'fill' ? '#fff' : c }} />
  const wrap = {
    plain: {}, underline: { borderBottom: `2px solid ${c}`, paddingBottom: 3 }, overline: { borderTop: `2px solid ${c}`, paddingTop: 3 },
    box: { border: `2px solid ${c}`, padding: '3px 8px' }, bar: { borderLeft: `4px solid ${c}`, paddingLeft: 4 },
    dotted: { borderBottom: `2px dotted ${c}`, paddingBottom: 3 }, fill: { background: c, padding: '4px 8px' }, line: {},
  }[style]
  return (
    <div className="flex w-16 items-center gap-1" style={wrap}>
      {text}
      {style === 'line' && <div className="h-0.5 flex-1" style={{ background: c }} />}
    </div>
  )
}
