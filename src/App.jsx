import { useEffect, useState } from 'react'
import { Undo2, Redo2, Eye } from 'lucide-react'
import { Sidebar, EditorHeader } from './components/TopBar'
import Landing from './components/Landing'
import IntegrationsPage from './components/IntegrationsPage'
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
import { downloadResume } from './lib/download'

export default function App() {
  // First visit opens on the landing page; after that, on the resumes.
  const [view, setView] = useState(() => {
    const fromHash = location.hash.slice(1).split('/')[0]
    if (fromHash) return fromHash
    try { return localStorage.getItem('rw.seenLanding') ? 'overview' : 'home' } catch { return 'home' }
  })
  useEffect(() => { if (view !== 'home') try { localStorage.setItem('rw.seenLanding', '1') } catch { /* private mode */ } }, [view])
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
  // …and periodically, and when you come back to the tab, so the vault stays deduplicated.
  useEffect(() => {
    if (!hydrated) return
    const sync = () => { if (document.visibilityState === 'visible') useStore.getState().syncVault() }
    const t = setInterval(sync, 60_000)
    document.addEventListener('visibilitychange', sync)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', sync) }
  }, [hydrated])

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
      if (['home', 'overview', 'content', 'customize', 'optimize', 'new', 'vault', 'integrations'].includes(next)) setView(next)
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

  // Saves Name_Resume_ddmmyyyy(n).pdf straight to the download folder (print dialog only as a fallback).
  const [toast, setToast] = useState(null)
  const download = async () => {
    if (toast?.busy) return
    setToast({ busy: true, text: 'Preparing your PDF…' })
    const r = await downloadResume({ fullName: resume.personal.fullName, name: resume.name, page: PAGE_SIZES[resume.settings.pageFormat] })
    setToast(r.ok ? { text: `Saved ${r.fileName} to your downloads` } : { text: `${r.reason}, so the print dialog was used instead.`, warn: true })
    setTimeout(() => setToast(null), 5000)
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

  if (view === 'home') return <Landing onOpen={() => setView('overview')} onImport={() => openCreate('file')} onJob={() => openCreate('job')} />

  const editing = !empty && ['content', 'customize', 'optimize'].includes(view)
  const page = view === 'new' ? createPage : view === 'vault' ? <VaultPage /> : view === 'integrations' ? <IntegrationsPage /> : <Overview onOpen={() => setView('content')} onCreate={openCreate} />

  return (
    <div className="md:flex">
      {saveError && (
        <div className="fixed inset-x-0 top-0 z-[120] bg-red-600 px-4 py-2 text-center text-[14px] font-medium text-white">
          Couldn’t save your latest changes ({saveError}). Export your resume as JSON from the ⋯ menu to keep a copy.
        </div>
      )}
      {toast && (
        <div role="status" className={`fixed bottom-20 left-1/2 z-[130] -translate-x-1/2 rounded-md px-4 py-2.5 text-[14px] font-medium shadow-lg ${toast.warn ? 'bg-amber-100 text-amber-900' : 'bg-ink text-white'}`}>
          {toast.text}
        </div>
      )}
      <Sidebar view={editing ? view : view === 'new' ? 'new' : view === 'vault' ? 'vault' : view === 'integrations' ? 'integrations' : 'overview'} setView={setView} openCreate={openCreate} createTab={createTab} />

      {!editing ? (
        <div className="min-w-0 flex-1">{page}</div>
      ) : (
        // Editor: header, then the editing pane and the page preview side by side, each scrolling on its own.
        <div className="flex min-w-0 flex-1 flex-col md:h-screen">
          <EditorHeader view={view} setView={setView} onDownload={download} openCreate={openCreate} />
          <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div id="editor-pane" className={`pane-scroll px-4 py-6 sm:px-8 lg:shrink-0 lg:overflow-y-auto ${view === 'customize' ? 'lg:w-[640px]' : view === 'optimize' ? 'lg:w-[600px]' : 'lg:w-[540px]'}`}>
              {view === 'customize' ? <CustomizePanel />
                : view === 'optimize' ? <OptimizePanel onShow={target => { useStore.getState().setFocus(target); setView('content') }} />
                : <ContentPanel />}
            </div>
            {/* Below lg the preview column is hidden; the floating Preview button opens it full screen. */}
            <div className="pane-scroll hidden min-w-0 flex-1 border-l border-rule bg-desk px-8 pb-24 pt-8 lg:block lg:overflow-y-auto">
              <Preview resume={resume} open={previewOpen} setOpen={setPreviewOpen} onDownload={download} />
            </div>
          </main>

          <button onClick={() => setPreviewOpen(true)} className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-white shadow-xl lg:hidden">
            <Eye size={18} /> Preview
          </button>
          <div className="fixed bottom-6 right-6 z-40 flex overflow-hidden rounded-md border border-rule bg-white">
            <button onClick={undo} disabled={!past.length} title="Undo (⌘Z)" className="grid h-10 w-11 place-items-center text-ink hover:bg-field disabled:opacity-30"><Undo2 size={17} /></button>
            <span className="w-px bg-rule" />
            <button onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)" className="grid h-10 w-11 place-items-center text-ink hover:bg-field disabled:opacity-30"><Redo2 size={17} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
