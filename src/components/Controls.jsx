import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'

export function Card({ id, title, children }) {
  return (
    <section id={id} className="card scroll-mt-28 p-8">
      <h2 className="mb-6 text-[26px] font-bold text-ink">{title}</h2>
      <div className="space-y-7">{children}</div>
    </section>
  )
}

export function Field({ label, value, children }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[16px] font-semibold text-ink">{label}</span>
        {value != null && <span className="text-[15px] text-ink">{value}</span>}
      </div>
      {children}
    </div>
  )
}

// Discrete slider: a track of tick stops with the current one highlighted, plus −/+ buttons.
export function StepScale({ value, min, max, step, onChange, format = v => v }) {
  const stops = []
  for (let v = min; v <= max + 1e-9; v = +(v + step).toFixed(4)) stops.push(v)
  const idx = stops.findIndex(v => Math.abs(v - value) < step / 2)
  const set = i => onChange(stops[Math.max(0, Math.min(stops.length - 1, i))])
  // Show at most ~9 ticks; beyond that, compress by mapping the value onto a continuous track.
  const ticks = Math.min(stops.length, 9)
  const pos = stops.length > 1 ? idx / (stops.length - 1) : 0
  const active = Math.round(pos * (ticks - 1))
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex h-11 flex-1 cursor-pointer items-center rounded-md bg-field"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          set(Math.round(((e.clientX - r.left) / r.width) * (stops.length - 1)))
        }}
        title={String(format(value))}
      >
        {Array.from({ length: ticks }, (_, i) => (
          <div key={i} className="flex flex-1 justify-center">
            {i === active ? <div className="h-11 w-10 rounded-md bg-brand" /> : <div className="h-4 w-px bg-slate-400/70" />}
          </div>
        ))}
      </div>
      <SquareBtn onClick={() => set(idx - 1)} disabled={idx <= 0}><Minus size={18} /></SquareBtn>
      <SquareBtn onClick={() => set(idx + 1)} disabled={idx >= stops.length - 1}><Plus size={18} /></SquareBtn>
    </div>
  )
}

function SquareBtn({ children, ...p }) {
  return (
    <button {...p} className="grid h-11 w-11 place-items-center rounded-md border border-slate-300 text-ink transition hover:border-ink disabled:opacity-30">
      {children}
    </button>
  )
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={clsx('min-w-28 rounded-lg border px-5 py-2.5 text-[15px] transition',
            value === o.value ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 text-ink hover:border-slate-400')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Picture tiles: `art` renders a small schematic for each option.
export function Tiles({ value, options, onChange, size = 'md' }) {
  return (
    <div className="flex flex-wrap gap-4">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} className="flex flex-col items-center gap-2">
          <div className={clsx('grid place-items-center overflow-hidden rounded-lg border-2 transition',
            size === 'sm' ? 'h-16 w-20' : 'h-[68px] w-[128px]',
            value === o.value ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-400')}>
            {o.art(value === o.value)}
          </div>
          {o.label && <span className={clsx('text-[15px]', value === o.value ? 'font-medium text-ink' : 'text-muted')}>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function Select({ value, options, onChange, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}
      className="field max-w-xs cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23333%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_14px_center] bg-no-repeat pr-10">
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink">
      <span className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Chip({ checked, onChange, children }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={clsx('rounded-full border px-4 py-1.5 text-[14px] transition',
        checked ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 text-ink hover:border-slate-400')}>
      {children}
    </button>
  )
}

export function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2">
      <span className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ background: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </span>
      <span className="text-[13px] text-muted">{label}</span>
    </label>
  )
}
