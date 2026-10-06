import { AlertTriangle, Plug } from 'lucide-react'
import { useAi } from '../lib/useAi'

// Shown wherever an AI feature can't run: says why, and where to fix it.
export default function AiNotice({ what = 'use AI features', className = '' }) {
  const ai = useAi()
  if (ai.ready || ai.state === 'checking') return null
  const offline = ai.state === 'offline'
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 ${className}`}>
      <AlertTriangle size={16} className="shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1">
        {offline
          ? <>The local AI server isn’t running, so you can’t {what}. Start it with <code className="meta rounded bg-white/70 px-1">npm run dev</code> in the app folder.</>
          : <>AI isn’t connected, so you can’t {what}. Connect OpenAI, Anthropic or Gemini with your own API key.</>}
      </p>
      {!offline && (
        <a href="#integrations" className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-deep">
          <Plug size={14} /> Connect AI
        </a>
      )}
    </div>
  )
}
