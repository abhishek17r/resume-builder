import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { KEEP_ON_TEMPLATE } from '../lib/templates'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { Thumbnail } from './Preview'

const THUMB_W = 170

// A thumbnail of the open resume in a template, rendered only once it scrolls into view.
function LazyThumb({ resume, template }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  const preview = useMemo(() => {
    if (!visible) return null
    const kept = Object.fromEntries(KEEP_ON_TEMPLATE.map(k => [k, resume.settings[k]]))
    return { ...resume, settings: { ...DEFAULT_SETTINGS, ...template.settings, ...kept } }
  }, [visible, resume, template])
  return (
    <div ref={ref} style={{ width: THUMB_W, height: Math.round(THUMB_W * 1.414) }} className="overflow-hidden rounded-md bg-soft">
      {preview && <Thumbnail resume={preview} width={THUMB_W} />}
    </div>
  )
}

export function TemplateCard({ resume, template, active, onApply }) {
  return (
    <button onClick={() => onApply(template)} className="group text-left">
      <div className={clsx('relative w-fit rounded-lg p-1 ring-2 transition', active ? 'ring-brand' : 'ring-transparent group-hover:ring-slate-300')}>
        <LazyThumb resume={resume} template={template} />
        {active && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow"><Check size={14} /></span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1 px-1">
        <span className={clsx('text-[14px] font-semibold', active ? 'text-brand' : 'text-ink group-hover:text-brand')}>{template.name}</span>
      </div>
      <span className="px-1 text-[12px] text-muted">{template.style}</span>
    </button>
  )
}
