import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { usePagedLayout, Sheet, MM } from './ResumeDocument'
import { useStore } from '../lib/store'

// A page scaled to `scale`, occupying exactly its scaled footprint in the flow.
function ScaledSheet({ model, page, scale }) {
  const { w, h } = model.ctx.g.page
  return (
    <div className="relative overflow-hidden bg-white shadow-[0_2px_18px_rgba(0,0,0,0.10)]" style={{ width: w * MM * scale, height: h * MM * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Sheet model={model} page={page} />
      </div>
    </div>
  )
}

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// Editor-side preview: fits the column, click anywhere to open the full-screen preview.
// Also owns the print copy, so Download prints exactly these pages.
export default function Preview({ resume, open, setOpen, onDownload }) {
  const { pages, model, measurer } = usePagedLayout(resume)
  const ref = useRef(null)
  const width = useWidth(ref)
  const pageW = model.ctx.g.page.w * MM
  const scale = width ? Math.min(1, width / pageW) : 0
  const setPageCount = useStore(s => s.setPageCount)
  useEffect(() => { setPageCount(pages.length) }, [pages.length, setPageCount])

  return (
    <>
      {measurer}
      <div ref={ref} className="w-full">
        {scale > 0 && (
          <button onClick={() => setOpen(true)} className="group relative block w-full cursor-zoom-in text-left" title="Open preview">
            <div className="flex flex-col items-center gap-6">
              {pages.map(p => <ScaledSheet key={p.index} model={model} page={p} scale={scale} />)}
            </div>
            <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[13px] font-medium text-white opacity-0 shadow transition group-hover:opacity-100">
              <Maximize2 size={14} /> Preview
            </span>
          </button>
        )}
        <p className="mt-3 text-center text-[13px] text-muted">
          {pages.length} page{pages.length > 1 ? 's' : ''} · {resume.settings.pageFormat} · click to preview
        </p>
      </div>

      {open && <PreviewModal model={model} pages={pages} onClose={() => setOpen(false)} onDownload={onDownload} />}

      {createPortal(
        <div id="print-root">
          {pages.map(p => <div key={p.index} className="print-page"><Sheet model={model} page={p} /></div>)}
        </div>,
        document.body,
      )}
    </>
  )
}

function PreviewModal({ model, pages, onClose, onDownload }) {
  const ref = useRef(null)
  const width = useWidth(ref)
  const pageW = model.ctx.g.page.w * MM
  const fit = width ? Math.min(1.5, (width - 32) / pageW) : 0
  const [zoom, setZoom] = useState(null) // null = fit to width
  const scale = zoom ?? fit

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const step = d => setZoom(z => Math.max(0.3, Math.min(2.5, +((z ?? fit) + d).toFixed(2))))

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#2b1f3f]/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 py-3 text-white sm:px-6">
        <span className="min-w-0 truncate text-[15px] font-semibold">{model.resume.personal.fullName || model.resume.name}</span>
        <span className="hidden shrink-0 text-[13px] text-white/60 sm:inline">· {pages.length} page{pages.length > 1 ? 's' : ''}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button onClick={() => step(-0.1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" title="Zoom out"><ZoomOut size={19} /></button>
          <button onClick={() => setZoom(null)} className="min-w-16 rounded-lg px-2 py-2 text-[13px] tabular-nums hover:bg-white/10" title="Fit to width">{Math.round(scale * 100)}%</button>
          <button onClick={() => step(0.1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" title="Zoom in"><ZoomIn size={19} /></button>
          <button onClick={onDownload} className="ml-2 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:bg-white/90">
            <Download size={16} /> <span className="hidden sm:inline">Download</span>
          </button>
          <button onClick={onClose} className="ml-1 grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" title="Close (Esc)"><X size={22} /></button>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-auto" onClick={e => e.target === e.currentTarget && onClose()}>
        {scale > 0 && (
          <div className="mx-auto flex w-fit flex-col items-center gap-6 px-4 pb-10 pt-2">
            {pages.map(p => <ScaledSheet key={p.index} model={model} page={p} scale={scale} />)}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Small first-page thumbnail (Overview).
export function Thumbnail({ resume, width }) {
  const { pages, model, measurer } = usePagedLayout(resume)
  const scale = width / (model.ctx.g.page.w * MM)
  return (
    <>
      {measurer}
      <div className="pointer-events-none">
        <ScaledSheet model={model} page={pages[0]} scale={scale} />
      </div>
    </>
  )
}
