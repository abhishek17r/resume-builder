import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import clsx from 'clsx'
import { sanitize } from '../lib/format'

const TOOLS = [
  { cmd: 'bold', icon: Bold, title: 'Bold (⌘B)' },
  { cmd: 'italic', icon: Italic, title: 'Italic (⌘I)' },
  { cmd: 'underline', icon: Underline, title: 'Underline (⌘U)' },
  { cmd: 'insertUnorderedList', icon: List, title: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, title: 'Numbered list' },
  { cmd: 'createLink', icon: LinkIcon, title: 'Link' },
  'sep',
  { cmd: 'justifyLeft', icon: AlignLeft, title: 'Align left' },
  { cmd: 'justifyCenter', icon: AlignCenter, title: 'Align center' },
  { cmd: 'justifyRight', icon: AlignRight, title: 'Align right' },
  { cmd: 'justifyFull', icon: AlignJustify, title: 'Justify' },
]

// contentEditable editor that stores sanitized HTML.
export default function RichText({ value, onChange, placeholder }) {
  const ref = useRef(null)
  const [active, setActive] = useState({})

  // Only push outside values into the DOM (undo, another tab, a suggestion accepted). Our own edits come
  // back sanitised and may differ slightly from the live HTML; rewriting the DOM then would move the
  // caret mid-typing and could drop what was typed in between.
  const emitted = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || value === emitted.current) return
    if (el.innerHTML !== (value || '')) el.innerHTML = value || ''
  }, [value])

  const refreshActive = () => {
    const next = {}
    for (const t of TOOLS) if (t !== 'sep' && t.cmd !== 'createLink') next[t.cmd] = document.queryCommandState(t.cmd)
    setActive(next)
  }

  const run = cmd => {
    ref.current.focus()
    if (cmd === 'createLink') {
      const url = window.prompt('Link URL', 'https://')
      if (!url) return
      document.execCommand('createLink', false, url)
    } else {
      document.execCommand(cmd)
    }
    emit()
    refreshActive()
  }

  const emit = () => {
    emitted.current = sanitize(ref.current.innerHTML)
    onChange(emitted.current)
  }

  const onPaste = e => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) document.execCommand('insertHTML', false, sanitize(html))
    else document.execCommand('insertText', false, text)
  }

  return (
    <div className="overflow-hidden rounded-lg bg-field focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/40">
      <div className="flex flex-wrap items-center gap-1 border-b border-black/5 px-2 py-1.5">
        {TOOLS.map((t, i) =>
          t === 'sep' ? (
            <span key={i} className="mx-1 h-5 w-px bg-black/10" />
          ) : (
            <button
              key={t.cmd}
              type="button"
              title={t.title}
              onMouseDown={e => { e.preventDefault(); run(t.cmd) }}
              className={clsx('grid h-8 w-8 place-items-center rounded-md text-ink transition hover:bg-black/5', active[t.cmd] && 'bg-brand text-white hover:bg-brand')}
            >
              <t.icon size={17} strokeWidth={2.2} />
            </button>
          ),
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={onPaste}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        className="rte min-h-[140px] px-4 py-3 text-[15px] leading-relaxed text-ink outline-none"
      />
    </div>
  )
}
