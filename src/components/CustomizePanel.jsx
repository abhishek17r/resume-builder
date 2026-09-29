import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { GripVertical, RotateCcw } from 'lucide-react'
import { useStore, useResume } from '../lib/store'
import { SECTION_TYPES } from '../lib/sections'
import { DATE_FORMATS, LANGUAGES } from '../lib/format'
import { SortableList, SortableItem } from './Sortable'
import { Card, Field, StepScale, Segmented, Tiles, Select, Toggle, Chip, ColorInput } from './Controls'
import { TEMPLATES, KEEP_ON_TEMPLATE } from '../lib/templates'
import { TemplateCard } from './TemplateGallery'
import { FONTS as FONT_LIST, ensureFont } from '../lib/fonts'

const NAV = [
  ['document', 'Document'], ['templates', 'Templates'], ['layout', 'Layout'], ['font-size', 'Font Size'],
  ['spacing', 'Spacing'], ['entries', 'Entries'], ['headings', 'Headings'], ['font', 'Font'],
  ['colors', 'Colors'], ['header', 'Header'], ['photo', 'Photo'], ['links', 'Links'], ['footer', 'Footer'],
]

// Quick colour combinations: [text, background, accent, sideText, sideBackground, sideAccent]
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

const FONTS = FONT_LIST.map(f => f.name)

// Load a font preview only when its button scrolls into view.
const lazyFont = name => el => {
  if (!el || el.dataset.watched) return
  el.dataset.watched = '1'
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ensureFont(name); io.disconnect() } })
  io.observe(el)
}

export default function CustomizePanel() {
  const r = useResume()
  const s = r.settings
  const { setSetting: set, setAccentTarget, setSectionColumn, moveSection, resetSettings, applyPreset, applyTemplate } = useStore()
  const [active, setActive] = useState('document')
  const [fontCat, setFontCat] = useState('all')
  const rootRef = useRef(null)

  // Scroll-spy: highlight the nav item for the card nearest the top of the viewport.
  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(`c-${id}`)).filter(Boolean)
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id.slice(2))
    }, { rootMargin: '-100px 0px -60% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  const go = id => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div ref={rootRef} className="flex gap-6 pb-24">
      <nav className="sticky top-0 hidden h-fit w-28 shrink-0 flex-col lg:flex">
        {NAV.map(([id, label]) => (
          <button key={id} onClick={() => go(id)}
            className={clsx('border-l py-1.5 pl-3 text-left text-[14px] transition',
              active === id ? 'border-ink font-medium text-ink' : 'border-rule text-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 space-y-6">
        <Card id="c-document" title="Document">
          <Field label="Language">
            <Select value={s.language ?? 'en'} options={Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l.label }))} onChange={v => set('language', v)} />
            <p className="mt-2 text-[13px] text-muted">Used for month names and “{(LANGUAGES[s.language] ?? LANGUAGES.en).present}” in dates.</p>
          </Field>
          <Field label="Date Format">
            <Select value={s.dateFormat} options={DATE_FORMATS} onChange={v => set('dateFormat', v)} />
          </Field>
          <Field label="Page Format">
            <Select value={s.pageFormat} options={[{ value: 'A4', label: 'A4 (210 × 297 mm)' }, { value: 'Letter', label: 'US Letter (8.5 × 11 in)' }]} onChange={v => set('pageFormat', v)} />
          </Field>
        </Card>

        <Card id="c-templates" title="Templates">
          <p className="-mt-3 text-muted">Apply a complete look in one click. Your content stays the same.</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
            {TEMPLATES.map(t => <TemplateCard key={t.id} resume={r} template={t} active={s.templateId === t.id} onApply={tpl => applyTemplate(tpl, KEEP_ON_TEMPLATE)} />)}
          </div>
          <button onClick={() => confirm('Reset all design settings to defaults?') && resetSettings()} className="flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink">
            <RotateCcw size={15} /> Reset design to defaults
          </button>
        </Card>

        <Card id="c-layout" title="Layout">
          <Field label="Columns">
            <Tiles value={s.columns} onChange={v => set('columns', v)} options={[
              { value: 'one', label: 'One', art: a => <ColArt a={a} kind="one" /> },
              { value: 'two', label: 'Two', art: a => <ColArt a={a} kind="two" /> },
              { value: 'mix', label: 'Mix', art: a => <ColArt a={a} kind="mix" /> },
            ]} />
          </Field>
          {s.columns === 'two' && (
            <Field label="Header Position">
              <Tiles size="sm" value={s.headerPosition} onChange={v => set('headerPosition', v)} options={[
                { value: 'top', label: 'Top', art: a => <HeaderArt a={a} pos="top" /> },
                { value: 'left', label: 'Left', art: a => <HeaderArt a={a} pos="left" /> },
                { value: 'right', label: 'Right', art: a => <HeaderArt a={a} pos="right" /> },
              ]} />
            </Field>
          )}
          {s.columns !== 'one' && (
            <Field label="Section Layout">
              <p className="-mt-1 mb-3 text-[14px] text-muted">
                {s.columns === 'two' ? 'Drag to reorder; choose which column each section sits in.' : 'Neighbouring “half” sections sit side by side.'}
              </p>
              <SectionLayout sections={r.sections} columns={s.columns} onMove={moveSection} onColumn={setSectionColumn} />
            </Field>
          )}
          {s.columns === 'two' && (
            <Field label="Column Width" value={`Side ${s.leftWidth}% · Main ${100 - s.leftWidth}%`}>
              <StepScale value={s.leftWidth} min={25} max={50} step={1} onChange={v => set('leftWidth', v)} />
            </Field>
          )}
        </Card>

        <Card id="c-font-size" title="Font Size">
          <Field label="Base Font Size" value={`${s.baseSize}pt`}>
            <StepScale value={s.baseSize} min={8} max={12} step={0.5} onChange={v => set('baseSize', v)} />
          </Field>
          <Field label="Full Name" value={`+${s.nameSize}pt`}>
            <StepScale value={s.nameSize} min={5} max={17} step={1} onChange={v => set('nameSize', v)} />
          </Field>
          <Field label="Professional Title" value={`+${s.titleSize}pt`}>
            <StepScale value={s.titleSize} min={0} max={6} step={0.5} onChange={v => set('titleSize', v)} />
          </Field>
          <Field label="Section Headings" value={`+${s.headingSize}pt`}>
            <StepScale value={s.headingSize} min={0} max={6} step={0.5} onChange={v => set('headingSize', v)} />
          </Field>
          <Field label="Entry Header" value={`+${s.entrySize}pt`}>
            <StepScale value={s.entrySize} min={0} max={3} step={0.5} onChange={v => set('entrySize', v)} />
          </Field>
        </Card>

        <Card id="c-spacing" title="Spacing">
          <Field label="Line Height" value={s.lineHeight}>
            <StepScale value={s.lineHeight} min={1} max={2} step={0.05} onChange={v => set('lineHeight', v)} />
          </Field>
          <Field label="Space Between Sections" value={s.sectionGap}>
            <StepScale value={s.sectionGap} min={1} max={9} step={1} onChange={v => set('sectionGap', v)} />
          </Field>
          <Field label="Space Between Entries" value={s.entryGap ?? 4}>
            <StepScale value={s.entryGap ?? 4} min={1} max={9} step={1} onChange={v => set('entryGap', v)} />
          </Field>
          <Field label="Left & Right Margin" value={`${s.marginX}mm`}>
            <StepScale value={s.marginX} min={4} max={24} step={1} onChange={v => set('marginX', v)} />
          </Field>
          <Field label="Top & Bottom Margin" value={`${s.marginY}mm`}>
            <StepScale value={s.marginY} min={4} max={24} step={1} onChange={v => set('marginY', v)} />
          </Field>
        </Card>

        <Card id="c-entries" title="Entry Layout">
          <Field label="Structure">
            <Tiles value={s.entryLayout} onChange={v => set('entryLayout', v)} options={[
              { value: 'full', label: 'Full Width', art: a => <Lines a={a} /> },
              { value: 'columns', label: 'Dates Column', art: a => <Lines a={a} split /> },
            ]} />
          </Field>
          {s.entryLayout === 'full' && (
            <Field label="Date & Location Position">
              <Segmented value={s.datePosition} onChange={v => set('datePosition', v)} options={[{ value: 'right', label: 'Right' }, { value: 'below', label: 'Below Title' }]} />
            </Field>
          )}
          <Field label="Subtitle Style">
            <Segmented value={s.subtitleStyle ?? 'bold'} onChange={v => set('subtitleStyle', v)} options={[{ value: 'bold', label: 'Bold' }, { value: 'italic', label: 'Italic' }, { value: 'normal', label: 'Normal' }]} />
            <p className="mt-2 text-[13px] text-muted">The subtitle is the employer, school or issuer next to the entry title.</p>
          </Field>
          <Field label="Subtitle Placement">
            <Segmented value={s.subtitlePlacement ?? 'same'} onChange={v => set('subtitlePlacement', v)} options={[{ value: 'same', label: 'Same line' }, { value: 'next', label: 'Next line' }]} />
          </Field>
          <Field label="List Style">
            <Segmented value={s.listStyle ?? 'bullet'} onChange={v => set('listStyle', v)} options={[{ value: 'bullet', label: '• Bullet' }, { value: 'hyphen', label: '– Hyphen' }, { value: 'none', label: 'None' }]} />
          </Field>
          <Field label="Bullet Indent" value={`${s.bulletIndent ?? 0} mm`}>
            <StepScale value={s.bulletIndent ?? 0} min={0} max={8} step={1} onChange={v => set('bulletIndent', v)} />
          </Field>
        </Card>

        <Card id="c-headings" title="Section Headings">
          <Field label="Style">
            <div className="grid grid-cols-4 gap-3">
              {['plain', 'underline', 'overline', 'line', 'box', 'bar', 'dotted', 'fill'].map(st => (
                <button key={st} onClick={() => set('headingStyle', st)} title={st}
                  className={clsx('grid h-14 place-items-center rounded-lg border-2 transition', s.headingStyle === st ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-400')}>
                  <HeadingArt style={st} a={s.headingStyle === st} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Capitalization">
            <Segmented value={s.headingCaps} onChange={v => set('headingCaps', v)} options={[{ value: 'capitalize', label: 'Capitalize' }, { value: 'uppercase', label: 'UPPERCASE' }]} />
          </Field>
          <Field label="Icons">
            <Segmented value={s.headingIcons} onChange={v => set('headingIcons', v)} options={[{ value: 'none', label: 'None' }, { value: 'outline', label: 'Outline' }, { value: 'filled', label: 'Filled' }]} />
          </Field>
        </Card>

        <Card id="c-font" title="Font">
          <Field label="Body Font">
            <div className="mb-3 flex gap-1 rounded-lg bg-field p-1 text-[14px]">
              {[['all', 'All'], ['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']].map(([v, l]) => (
                <button key={v} onClick={() => setFontCat(v)} className={clsx('flex-1 rounded-md py-1.5 transition', fontCat === v ? 'bg-white font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink')}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FONT_LIST.filter(f => fontCat === 'all' || f.cat === fontCat).map(({ name: f }) => (
                <button key={f} onClick={() => set('bodyFont', f)} style={{ fontFamily: `"${f}"` }} ref={lazyFont(f)}
                  className={clsx('rounded-lg border px-3 py-2.5 text-[15px] transition', s.bodyFont === f ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 text-ink hover:border-slate-400')}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Name Font">
            <Select value={s.nameFont} onChange={v => set('nameFont', v)} options={[{ value: '', label: 'Same as body font' }, ...FONTS]} />
          </Field>
        </Card>

        <Card id="c-colors" title="Colors">
          <Field label="Color Scheme">
            <Segmented value={s.colorMode} onChange={v => set('colorMode', v)} options={[{ value: 'single', label: 'Single' }, { value: 'multi', label: 'Two-tone' }]} />
            <p className="mt-2 text-[13px] text-muted">
              {s.colorMode === 'single' ? 'One set of colours for the whole page.' : 'The header area (or side column, when the header sits in it) gets its own colours.'}
            </p>
          </Field>
          <Field label="Colour Area">
            <Segmented value={s.colorArea} onChange={v => set('colorArea', v)} options={[{ value: 'full', label: 'Full page' }, { value: 'column', label: s.columns === 'two' ? 'Column / header' : 'Header' }, { value: 'border', label: 'Border' }]} />
            {s.colorArea === 'full' && <p className="mt-2 text-[13px] text-muted">The whole page takes the {s.colorMode === 'multi' ? 'side' : 'accent'} colour; text switches to light or dark automatically.</p>}
          </Field>
          <Field label="Palettes">
            <div className="flex flex-wrap gap-2">
              {PALETTES.map(([label, [text, bg, accent, text2, bg2, accent2]]) => (
                <button key={label} title={label} onClick={() => applyPreset({ text, bg, accent, text2, bg2, accent2 })}
                  className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-[13px] text-ink hover:border-slate-400">
                  <span className="flex overflow-hidden rounded-full ring-1 ring-black/10">
                    <span className="h-5 w-3" style={{ background: bg2 }} /><span className="h-5 w-3" style={{ background: accent }} /><span className="h-5 w-3" style={{ background: bg }} />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={s.colorMode === 'multi' ? 'Main area' : 'Colours'}>
            <div className="flex gap-6">
              <ColorInput label="Text" value={s.text} onChange={v => set('text', v)} />
              <ColorInput label="Background" value={s.bg} onChange={v => set('bg', v)} />
              <ColorInput label="Accent" value={s.accent} onChange={v => set('accent', v)} />
            </div>
          </Field>
          {s.colorMode === 'multi' && (
            <Field label="Header / side area">
              <div className="flex gap-6">
                <ColorInput label="Text" value={s.text2} onChange={v => set('text2', v)} />
                <ColorInput label="Background" value={s.bg2} onChange={v => set('bg2', v)} />
                <ColorInput label="Accent" value={s.accent2} onChange={v => set('accent2', v)} />
              </div>
            </Field>
          )}
          <Field label="Use Accent Colour For">
            <div className="flex flex-wrap gap-2">
              {[['name', 'Name'], ['jobTitle', 'Job title'], ['headings', 'Headings'], ['headerIcons', 'Header icons'], ['dates', 'Dates'], ['entryTitle', 'Entry title'], ['entrySubtitle', 'Entry subtitle'], ['linkIcons', 'Link icons']].map(([k, l]) => (
                <Chip key={k} checked={s.applyAccent[k]} onChange={v => setAccentTarget(k, v)}>{l}</Chip>
              ))}
            </div>
          </Field>
        </Card>

        <Card id="c-header" title="Header">
          <Field label="Text Alignment">
            <Segmented value={s.headerAlign} onChange={v => set('headerAlign', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }]} />
          </Field>
          <Field label="Job Title Style">
            <Segmented value={s.titleStyle ?? 'italic'} onChange={v => set('titleStyle', v)} options={[{ value: 'italic', label: 'Italic' }, { value: 'normal', label: 'Normal' }]} />
          </Field>
          <Field label="Details Arrangement">
            <Segmented value={s.detailsArrangement} onChange={v => set('detailsArrangement', v)} options={[{ value: 'icon', label: 'Icon' }, { value: 'bullet', label: 'Bullet •' }, { value: 'bar', label: 'Bar |' }]} />
          </Field>
          {s.detailsArrangement === 'icon' && (
            <Field label="Icon Style">
              <div className="flex flex-wrap gap-2">
                {['none', 'circle', 'rounded', 'square', 'circle-outline', 'rounded-outline', 'square-outline'].map(v => {
                  const [shape, variant] = v.split('-')
                  const on = s.iconStyle === v
                  return (
                    <button key={v} onClick={() => set('iconStyle', v)} title={v === 'none' ? 'No frame' : `${shape} ${variant ? 'outline' : 'filled'}`}
                      className={clsx('grid h-12 w-12 place-items-center rounded-lg border-2 transition', on ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-400')}>
                      {v === 'none'
                        ? <span className="text-[18px] leading-none text-ink">✉</span>
                        : <span className="grid h-6 w-6 place-items-center text-[11px]" style={{
                            borderRadius: { circle: '50%', rounded: 6, square: 0 }[shape],
                            background: variant ? 'transparent' : '#1d1530', color: variant ? '#1d1530' : '#fff', border: variant ? '1.5px solid #1d1530' : 'none',
                          }}>✉</span>}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}
        </Card>

        <Card id="c-photo" title="Photo">
          {!r.personal.photo && <p className="-mt-2 text-[14px] text-muted">Add a photo in Content → Personal Details to use these options.</p>}
          <Toggle checked={s.showPhoto !== false} onChange={v => set('showPhoto', v)} label="Show photo on resume" />
          <Field label="Size" value={`${s.photoSize ?? 24}mm`}>
            <StepScale value={s.photoSize ?? 24} min={14} max={40} step={2} onChange={v => set('photoSize', v)} />
          </Field>
          <Field label="Shape">
            <Segmented value={s.photoShape ?? 'circle'} onChange={v => set('photoShape', v)} options={[{ value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]} />
          </Field>
        </Card>

        <Card id="c-links" title="Links">
          <div className="space-y-4">
            <Toggle checked={s.linkUnderline} onChange={v => set('linkUnderline', v)} label="Underline links" />
            <Toggle checked={s.linkBlue} onChange={v => set('linkBlue', v)} label="Blue link colour" />
            <Toggle checked={s.linkIcon} onChange={v => set('linkIcon', v)} label="Show link icon after linked titles" />
          </div>
        </Card>

        <Card id="c-footer" title="Footer">
          <div className="space-y-4">
            <Toggle checked={s.footerName} onChange={v => set('footerName', v)} label="Show name in footer" />
            <Toggle checked={s.footerEmail} onChange={v => set('footerEmail', v)} label="Show email in footer" />
            <Toggle checked={s.footerPageNumbers} onChange={v => set('footerPageNumbers', v)} label="Show page numbers" />
          </div>
        </Card>
      </div>
    </div>
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

function HeaderArt({ a, pos }) {
  const strong = a ? '#17171b' : '#bdb7aa'
  const light = a ? '#e0e3ff' : '#fff'
  if (pos === 'top') return <div className="flex h-full w-full flex-col"><div className="h-1/2" style={{ background: strong }} /><div className="flex-1" style={{ background: light }} /></div>
  return (
    <div className={clsx('flex h-full w-full', pos === 'right' && 'flex-row-reverse')}>
      <div className="w-1/2" style={{ background: strong }} />
      <div className="flex-1" style={{ background: light }} />
    </div>
  )
}

function Lines({ a, split }) {
  const c = tone(a)
  return (
    <div className="flex gap-1.5">
      {split && <div className="space-y-1.5">{[0, 1, 2, 3].map(i => <div key={i} className="h-1 w-4 rounded-sm" style={{ background: c }} />)}</div>}
      <div className="space-y-1.5">{[0, 1, 2, 3].map(i => <div key={i} className="h-1 rounded-sm" style={{ width: split ? 36 : 50, background: c }} />)}</div>
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
