import fsp from 'node:fs/promises'
import path from 'node:path'
import { looksBinary } from './binary'
import { extOf, kindForExt } from '../../shared/kinds'
import { UNSORTED, type FileMeta, type FolderSnapshot, type LibrarySnapshot } from '../../shared/types'
import { isTempName } from './validate'

function byNewest(a: FileMeta, b: FileMeta): number {
  return b.mtimeMs - a.mtimeMs
}

async function fileMetaFor(root: string, relPath: string, size: number, mtimeMs: number): Promise<FileMeta> {
  const name = path.basename(relPath)
  const ext = extOf(name)
  const kind = kindForExt(ext)
  let binary = false
  if (kind === 'text' || kind === 'markdown') {
    try {
      const fh = await fsp.open(path.join(root, relPath), 'r')
      try {
        const buf = Buffer.alloc(Math.min(size, 8192))
        await fh.read(buf, 0, buf.length, 0)
        binary = looksBinary(buf)
      } finally {
        await fh.close()
      }
    } catch {
      binary = false
    }
  }
  return {
    relPath: relPath.split(path.sep).join('/'),
    name,
    ext,
    kind,
    size,
    mtimeMs,
    binary
  }
}

export async function scanLibrary(root: string): Promise<LibrarySnapshot> {
  const warnings: string[] = []
  await fsp.mkdir(root, { recursive: true })
  const top = await fsp.readdir(root, { withFileTypes: true })
  const folders: FolderSnapshot[] = []
  const loose: FileMeta[] = []
  for (const entry of top) {
    if (entry.name.startsWith('.') || isTempName(entry.name)) continue
    const abs = path.join(root, entry.name)
    if (entry.isDirectory()) {
      const files: FileMeta[] = []
      let inner
      try {
        inner = await fsp.readdir(abs, { withFileTypes: true })
      } catch {
        warnings.push(`Could not read collection "${entry.name}".`)
        continue
      }
      for (const f of inner) {
        if (!f.isFile() || f.name.startsWith('.') || isTempName(f.name)) continue
        try {
          const st = await fsp.stat(path.join(abs, f.name))
          files.push(await fileMetaFor(root, path.join(entry.name, f.name), st.size, st.mtimeMs))
        } catch {
          warnings.push(`Could not read "${f.name}" in "${entry.name}".`)
        }
      }
      files.sort(byNewest)
      folders.push({ name: entry.name, virtual: false, files })
    } else if (entry.isFile()) {
      try {
        const st = await fsp.stat(abs)
        loose.push(await fileMetaFor(root, entry.name, st.size, st.mtimeMs))
      } catch {
        /* file vanished mid-scan */
      }
    }
  }
  if (loose.length > 0) {
    folders.unshift({ name: UNSORTED, virtual: true, files: loose.sort(byNewest) })
  }
  return { root, folders, warnings }
}
