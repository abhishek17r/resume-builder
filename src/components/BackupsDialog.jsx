import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, Loader2, X } from 'lucide-react'
import { listBackups, restoreBackup } from '../lib/storage'

const KEY = 'resume-builder'
const when = at => new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Automatic backups (a copy every 10 minutes of editing, the last 20 kept in this browser).
// Restoring puts back every resume and the vault as they were; what's there now is backed up first.
export default function BackupsDialog({ onClose }) {
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { listBackups(KEY).then(setList, e => setError(e.message)) }, [])

  const restore = async b => {
    if (!confirm(`Restore everything as it was on ${when(b.at)}? What you have now is backed up first, so you can come back to it.`)) return
    setBusy(b.at)
    try { await restoreBackup(KEY, b.at); onClose() } catch (e) { setError(e.message); setBusy(null) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[140] grid place-items-center bg-ink/40 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-lg bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <History size={18} className="text-brand" />
          <h2 className="display text-[24px] text-ink">Earlier versions</h2>
          <button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-field hover:text-ink" title="Close"><X size={17} /></button>
        </div>
        <p className="mb-4 text-[13px] text-muted">A copy of all your resumes and your vault is kept every 10 minutes while you edit (the last 20, in this browser). Restoring backs up what you have now first.</p>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        {!list ? <p className="text-muted">Loading…</p> : !list.length ? <p className="text-[14px] text-muted">No backups yet. The first one is made the next time you edit.</p> : (
          <ul className="max-h-[50vh] divide-y divide-rule overflow-auto rounded-md border border-rule">
            {list.map(b => (
              <li key={b.at} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">{when(b.at)}</p>
                  <p className="truncate text-[12.5px] text-muted">{b.resumes.length} resume{b.resumes.length === 1 ? '' : 's'}: {b.resumes.map(r => r.name).join(', ')}</p>
                </div>
                <button onClick={() => restore(b)} disabled={busy != null}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-rule bg-white px-3 py-1.5 text-[13px] font-medium text-ink hover:border-ink/40 disabled:opacity-50">
                  {busy === b.at && <Loader2 size={13} className="animate-spin" />} Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}
