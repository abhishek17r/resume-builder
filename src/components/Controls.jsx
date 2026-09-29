import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'

export function Card({ id, title, children }) {
  return (
    <section id={id} className="card scroll-mt-6 p-6">
      <h2 className="display mb-5 text-[28px] leading-none text-ink">{title}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

export function Field({ label, value, children }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</span>
        {value != null && <span className="meta text-ink">{value}</span>}
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
        className="relative flex h-10 flex-1 cursor-pointer items-center rounded-md border border-rule bg-white"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          set(Math.round(((e.clientX - r.left) / r.width) * (stops.length - 1)))
        }}
        title={String(format(value))}
      >
        {Array.from({ length: ticks }, (_, i) => (
          <div key={i} className="flex flex-1 justify-center">
            {i === active ? <div className="h-6 w-2.5 rounded-sm bg-ink" /> : <div className="h-3 w-px bg-ink/25" />}
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
    <button {...p} className="grid h-10 w-10 place-items-center rounded-md border border-rule bg-white text-ink transition hover:border-ink/40 disabled:opacity-30">
      {children}
    </button>
  )
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-rule bg-white">
      {options.map((o, i) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={clsx('px-4 py-2 text-[14px] transition', i > 0 && 'border-l border-rule',
            value === o.value ? 'bg-ink text-white' : 'text-body hover:bg-field hover:text-ink')}>
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
          <div className={clsx('grid place-items-center overflow-hidden rounded-md border bg-white transition',
            size === 'sm' ? 'h-16 w-20' : 'h-[68px] w-[128px]',
            value === o.value ? 'border-ink ring-1 ring-ink' : 'border-rule hover:border-ink/40')}>
            {o.art(value === o.value)}
          </div>
          {o.label && <span className={clsx('text-[13px]', value === o.value ? 'font-medium text-ink' : 'text-muted')}>{o.label}</span>}
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
      <span className={clsx('relative h-5 w-9 rounded-full transition', checked ? 'bg-ink' : 'bg-ink/20')}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Chip({ checked, onChange, children }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={clsx('rounded-md border px-3 py-1.5 text-[13px] transition',
        checked ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink hover:border-ink/40')}>
      {children}
    </button>
  )
}

export function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2">
      <span className="relative h-11 w-11 overflow-hidden rounded-md ring-1 ring-rule" style={{ background: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </span>
      <span className="meta text-muted">{label}</span>
    </label>
  )
}
