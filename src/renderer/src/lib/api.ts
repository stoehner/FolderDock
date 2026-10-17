import type { IPCResult } from '../../../shared/types'

export class DockError extends Error {}

export async function call<T>(p: Promise<IPCResult<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new DockError(r.error)
  return r.data
}

export const api = window.folderdock

export function fdfileUrl(root: string, relPath: string): string {
  const abs = `${root.replace(/[\\/]+$/, '')}/${relPath}`
  return `fdfile://local/${encodeURIComponent(abs)}`
}

export function formatSize(s: number): string {
  if (!s) return '0 B'
  if (s < 1024) return `${s} B`
  if (s < 1048576) return `${(s / 1024).toFixed(1)} KB`
  return `${(s / 1048576).toFixed(1)} MB`
}

export function tailPath(p: string): string {
  const norm = p.replace(/[\\/]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  return i >= 0 ? `…${norm.slice(i)}` : norm
}

export function pathInsideRoot(root: string, p: string): boolean {
  const norm = (s: string): string => s.replace(/\//g, '\\').toLowerCase()
  const r = `${norm(root).replace(/[\\/]+$/, '')}\\`
  return norm(p).startsWith(r)
}

export function folderOfRel(relPath: string): string {
  const i = relPath.indexOf('/')
  return i < 0 ? 'Unsorted' : relPath.slice(0, i)
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
