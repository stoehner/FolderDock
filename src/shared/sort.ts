import type { FileMeta, FileSort } from './types'

export function compareFiles(a: FileMeta, b: FileMeta, sort: FileSort): number {
  if (sort === 'name') return a.name.localeCompare(b.name)
  if (sort === 'size') return b.size - a.size
  return b.mtimeMs - a.mtimeMs
}
