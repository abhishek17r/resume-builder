import { useEffect, useState } from 'react'
import { Undo2, Redo2, Eye } from 'lucide-react'
import TopBar from './components/TopBar'
import ContentPanel from './components/ContentPanel'
import CustomizePanel from './components/CustomizePanel'
import Preview from './components/Preview'
import Overview from './components/Overview'
import CreatePage from './components/CreatePage'
import OptimizePanel from './components/OptimizePanel'
import VaultPage from './components/VaultPage'
import { useStore, useResume, useHydrated } from './lib/store'
import { onSaveResult } from './lib/storage'
import { PAGE_SIZES } from './components/ResumeDocument'

export default function App() {
  const [view, setView] = useState(() => location.hash.slice(1).split('/')[0] || 'content')
  const [createTab, setCreateTab] = useState(() => location.hash.split('/')[1] || 'blank')
  const [returnTo, setReturnTo] = useState('overview')
  const openCreate = (tab = 'blank') => {
    if (view !== 'new') setReturnTo(view)
    setCreateTab(tab)
    setView('new')
  }
  const [previewOpen, setPreviewOpen] = useState(false)
  const resume = useResume()
  const empty = !resume
  const { undo, redo, past, future } = useStore()
  const hydrated = useHydrated()
  const [saveError, setSaveError] = useState(null)

  useEffect(() => onSaveResult(err => setSaveError(err ? err.message || String(err) : null)), [])

  // Keep the vault in step with every resume (debounced while typing).
  const resumes = useStore(s => s.resumes)
  useEffect(() => {
    if (!hydrated) return
    const t = setTimeout(() => useStore.getState().syncVault(), 800)
    return () => clearTimeout(t)
  }, [resumes, hydrated])

  useEffect(() => {
    history.replaceState(null, '', view === 'new' ? `#new/${createTab}` : `#${view}`)
    window.scrollTo(0, 0)
    document.getElementById('editor-pane')?.scrollTo(0, 0)
  }, [view, createTab])

  // Follow manual URL edits and back/forward between #overview, #content and #customize.
  useEffect(() => {
    const onHash = () => {
      const [next, tab] = location.hash.slice(1).split('/')
      if (next === 'new') setCreateTab(tab || 'blank')
      if (['overview', 'content', 'customize', 'optimize', 'new', 'vault'].includes(next)) setView(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onKey = e => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      // Leave native undo alone inside text inputs.
      if (e.target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      e.shiftKey ? redo() : undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const download = () => {
    const page = PAGE_SIZES[resume.settings.pageFormat]
    const style = document.createElement('style')
    style.textContent = `@page { size: ${page.w}mm ${page.h}mm; margin: 0; }`
    document.head.appendChild(style)
    const prevTitle = document.title
    document.title = resume.personal.fullName ? `${resume.personal.fullName} - Resume` : resume.name
    window.print()
    document.title = prevTitle
    style.remove()
  }

  // Wait for saved resumes to load from IndexedDB, so nothing edits the placeholder state first.
  if (!hydrated) return <div className="grid min-h-screen place-items-center text-muted">Loading your resumes…</div>

  const createPage = (
    <CreatePage
      initialTab={createTab}
      onCancel={() => setView(empty ? 'overview' : returnTo === 'new' ? 'overview' : returnTo)}
      onCreated={(id, next) => setView(next ?? 'content')}
    />
  )

  // The create page and (with no resumes) the Overview are plain pages without the editor panes.
  if (view === 'new' || view === 'vault' || (empty && view !== 'overview')) return (
    <div className="min-h-screen px-0 sm:px-6">
      <div className="sticky top-0 z-30 pt-0 sm:pt-4"><TopBar view={view === 'new' || view === 'vault' ? view : 'overview'} setView={setView} onDownload={download} openCreate={openCreate} /></div>
      {view === 'new' ? createPage : view === 'vault' ? <VaultPage /> : <Overview onOpen={() => setView('content')} onCreate={openCreate} />}
    </div>
  )

  return (
    // On large screens the editor and the preview are two independent scroll areas under a fixed top bar.
    <div className={view === 'overview' ? 'min-h-screen px-0 sm:px-6' : 'min-h-screen px-0 sm:px-6 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden'}>
      {saveError && (
        <div className="fixed inset-x-0 top-0 z-[120] bg-red-600 px-4 py-2 text-center text-[14px] font-medium text-white">
          Couldn’t save your latest changes ({saveError}). Export your resume as JSON from the ⋯ menu to keep a copy.
        </div>
      )}
      <div className="sticky top-0 z-30 shrink-0 pt-0 sm:pt-4">
        <TopBar view={view} setView={setView} onDownload={download} openCreate={openCreate} />
      </div>

      {view === 'overview' ? (
        <Overview onOpen={() => setView('content')} onCreate={openCreate} />
      ) : (
        <main className="mx-auto mt-6 flex w-full flex-col gap-8 px-4 sm:px-0 lg:mt-0 lg:min-h-0 lg:flex-1 lg:flex-row">
          <div id="editor-pane" className={`pane-scroll lg:shrink-0 lg:overflow-y-auto lg:pt-6 ${view === 'customize' ? 'lg:w-[660px]' : view === 'optimize' ? 'lg:w-[620px]' : 'lg:w-[540px]'}`}>
            {view === 'customize' ? <CustomizePanel />
              : view === 'optimize' ? <OptimizePanel onShow={target => { useStore.getState().setFocus(target); setView('content') }} />
              : <ContentPanel />}
          </div>
          {/* Below lg the preview column is hidden; the floating Preview button opens it full screen. */}
          <div className="pane-scroll hidden min-w-0 flex-1 pb-24 lg:block lg:overflow-y-auto lg:pt-6">
            <Preview resume={resume} open={previewOpen} setOpen={setPreviewOpen} onDownload={download} />
          </div>
        </main>
      )}

      {view !== 'overview' && (
        <button onClick={() => setPreviewOpen(true)} className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-white shadow-xl lg:hidden">
          <Eye size={18} /> Preview
        </button>
      )}

      {view !== 'overview' && (
        <div className="fixed bottom-6 right-6 z-40 flex overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-black/5">
          <button onClick={undo} disabled={!past.length} title="Undo (⌘Z)" className="grid h-12 w-14 place-items-center text-ink hover:bg-soft disabled:opacity-30"><Undo2 size={20} /></button>
          <span className="my-3 w-px bg-slate-200" />
          <button onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)" className="grid h-12 w-14 place-items-center text-ink hover:bg-soft disabled:opacity-30"><Redo2 size={20} /></button>
        </div>
      )}
    </div>
  )
}
