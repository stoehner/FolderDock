import { useEffect, useRef, useState } from 'react'

export function PdfViewer({ data, name }: { data: ArrayBuffer; name: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('Rendering PDF…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    async function render(): Promise<void> {
      try {
        const pdfjs = await import('pdfjs-dist')
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        cleanup = () => void task.destroy()
        const host = hostRef.current
        if (!host) return
        const maxPages = Math.min(doc.numPages, 40)
        for (let i = 1; i <= maxPages; i++) {
          if (cancelled) return
          const page = await doc.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const available = Math.max(220, (host.clientWidth || 340) - 8)
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const scale = (available / base.width) * dpr
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          if (cancelled) return
          host.append(canvas)
        }
        if (!cancelled) {
          setMessage(
            doc.numPages > 40 ? `Showing first 40 of ${doc.numPages} pages.` : ''
          )
        }
      } catch (e) {
        if (!cancelled) {
          setFailed(true)
          setMessage(e instanceof Error ? e.message : 'Could not render this PDF.')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [data, name])

  return (
    <div>
      {failed ? <div className="side-empty">{message}</div> : null}
      <div className="pdf-pages" ref={hostRef} />
      {!failed && message ? <div className="pdf-note">{message}</div> : null}
    </div>
  )
}
