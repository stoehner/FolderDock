import { useUI } from '../state/ui'
import { ico } from '../lib/icons'

export function Toast() {
  const toast = useUI(s => s.toast)
  if (!toast) return null
  return (
    <div key={toast.id} className={`toast${toast.kind === 'error' ? ' error' : ''}`} role="status">
      {toast.kind === 'error' ? ico('info') : null}
      {toast.text}
    </div>
  )
}

export function DropHint() {
  const depth = useUI(s => s.dragDepth)
  if (depth <= 0) return null
  return (
    <div className="drop-hint-bar">
      {ico('upload')}
      <span>Drop onto a collection to copy or move · release anywhere else to cancel</span>
    </div>
  )
}
