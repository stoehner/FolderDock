import { useEffect, useRef, useState } from 'react'
import { extOf, isImageKind, isTextKind, kindForExt, kindLabel } from '../../../shared/kinds'
import { folderOfRel, formatSize } from '../lib/api'
import { useExcerpts } from '../state/excerpts'
import { usePrefs } from '../state/prefs'
import type { HoverDelay } from '../../../shared/types'

interface HoverTarget {
  relPath: string
  x: number
  y: number
}

const HOVER_DELAY_MS: Record<HoverDelay, number> = { fast: 100, normal: 250, slow: 600 }

export function HoverSummary() {
  const [target, setTarget] = useState<HoverTarget | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = useRef<string | null>(null)
  const visibleRef = useRef(false)

  useEffect(() => {
    function clearTimer() {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
    function hide() {
      clearTimer()
      current.current = null
      visibleRef.current = false
      setVisible(false)
      setTarget(null)
    }
    function onOver(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.('.document-sheet, .file-row') as HTMLElement | null
      const relPath = el?.dataset.file
      if (!el || !relPath) return
      if (current.current === relPath) return
      hide()
      current.current = relPath
      timer.current = setTimeout(() => {
        const r = el.getBoundingClientRect()
        visibleRef.current = true
        setTarget({ relPath, x: r.right, y: r.top })
        setVisible(true)
      }, HOVER_DELAY_MS[usePrefs.getState().prefs.hoverDelay])
    }
    function onOut(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.('.document-sheet, .file-row') as HTMLElement | null
      if (el?.dataset.file && e.relatedTarget && el.contains(e.relatedTarget as Node)) return
      hide()
    }
    const onDrag = (): void => hide()
    const onScroll = (): void => {
      if (visibleRef.current) hide()
    }
    window.addEventListener('mouseover', onOver)
    window.addEventListener('mouseout', onOut)
    window.addEventListener('dragstart', onDrag, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mouseout', onOut)
      window.removeEventListener('dragstart', onDrag, true)
      window.removeEventListener('scroll', onScroll, true)
      clearTimer()
    }
  }, [])

  if (!target || !visible) return null

  const ext = extOf(target.relPath)
  const kind = kindForExt(ext)
  const text = useExcerpts.getState().texts[target.relPath]
  const meta = useExcerpts.getState().metas[target.relPath]
  if (isImageKind(kind)) useExcerpts.getState().ensureMeta(target.relPath)

  let body: string
  if (isTextKind(kind)) {
    body = text ? text : 'Empty or unreadable text file.'
  } else if (isImageKind(kind)) {
    body = meta?.width
      ? `${meta.width} × ${meta.height} pixels · ${formatSize(meta.size)}`
      : `${kindLabel(kind)} · ${formatSize(meta?.size ?? 0)}`
  } else if (kind === 'pdf') {
    body = `PDF document · ${formatSize(meta?.size ?? 0)}`
  } else {
    body = `${kindLabel(kind)} · ${formatSize(meta?.size ?? 0)} · no inline preview`
  }

  const width = 278
  const height = 150
  const x = Math.min(Math.max(10, target.x + 14), window.innerWidth - width - 12)
  const y = Math.min(Math.max(10, target.y - 5), window.innerHeight - height - 12)

  return (
    <div className="file-summary visible" role="tooltip" style={{ left: x, top: y }}>
      <div className="peek-kicker">
        {kindLabel(kind)} · {folderOfRel(target.relPath)}
      </div>
      <div className="peek-name">{target.relPath.split('/').pop()}</div>
      <div className="peek-body">{body}</div>
      <div className="peek-foot">Click for the full side preview · Drag to take the file</div>
    </div>
  )
}
