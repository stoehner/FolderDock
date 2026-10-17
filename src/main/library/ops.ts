import { shell } from 'electron'
import fsSync from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { extractExcerpt } from '../../shared/excerpt'
import { looksBinary } from './binary'
import { extOf, isTextKind, kindForExt } from '../../shared/kinds'
import {
  UNSORTED,
  type DetailedFileMeta,
  type ImportResult,
  type LibrarySnapshot,
  type TextFileContent,
  type WriteTextRequest,
  type WriteTextResult
} from '../../shared/types'
import { parseImageDimensions } from '../imageMeta'
import { scanLibrary } from './scan'
import {
  checkFileName,
  checkFolderName,
  describeFsError,
  resolveWithinRoot,
  toRelPath,
  uniqueName
} from './validate'

const MAX_TEXT_BYTES = 2 * 1024 * 1024
const MAX_IMPORT_BYTES = 200 * 1024 * 1024

function requireWithin(root: string, relPath: string): string {
  const abs = resolveWithinRoot(root, relPath)
  if (!abs) throw new Error('That path is outside the library.')
  return abs
}

function fail(err: unknown): never {
  throw new Error(describeFsError(err))
}

function targetDirFor(root: string, folder: string): string {
  return folder === UNSORTED ? root : path.join(root, folder)
}

async function listNames(dir: string): Promise<Set<string>> {
  try {
    return new Set(await fsp.readdir(dir))
  } catch {
    return new Set()
  }
}

async function trashPath(abs: string): Promise<void> {
  try {
    await shell.trashItem(abs)
  } catch (err) {
    fail(err)
  }
}

export async function createFolder(root: string, rawName: string): Promise<LibrarySnapshot> {
  const snap = await scanLibrary(root)
  const existing = snap.folders.filter(f => !f.virtual).map(f => f.name)
  const check = checkFolderName(rawName, existing)
  if (!check.valid) throw new Error(check.reason)
  try {
    await fsp.mkdir(path.join(root, check.value))
  } catch (err) {
    fail(err)
  }
  return scanLibrary(root)
}

export async function renameFolder(root: string, oldName: string, newName: string): Promise<LibrarySnapshot> {
  if (oldName === UNSORTED) throw new Error('The Unsorted collection cannot be renamed.')
  if (oldName === newName) return scanLibrary(root)
  const snap = await scanLibrary(root)
  const others = snap.folders.filter(f => !f.virtual && f.name !== oldName).map(f => f.name)
  const check = checkFolderName(newName, others)
  if (!check.valid) throw new Error(check.reason)
  const from = path.join(root, oldName)
  if (!fsSync.existsSync(from)) throw new Error('That collection no longer exists on disk.')
  try {
    await fsp.rename(from, path.join(root, check.value))
  } catch (err) {
    fail(err)
  }
  return scanLibrary(root)
}

export async function deleteFolder(root: string, name: string): Promise<LibrarySnapshot> {
  if (name === UNSORTED) throw new Error('The Unsorted collection cannot be deleted.')
  const dir = requireWithin(root, name)
  if (!fsSync.existsSync(dir)) throw new Error('That collection no longer exists on disk.')
  await trashPath(dir)
  return scanLibrary(root)
}

export async function readTextFile(root: string, relPath: string): Promise<TextFileContent> {
  const abs = requireWithin(root, relPath)
  const st = await fsp.stat(abs)
  if (!st.isFile()) throw new Error('That path is not a file.')
  if (st.size > MAX_TEXT_BYTES) throw new Error('File is too large to open in the editor (over 2 MB).')
  const buf = await fsp.readFile(abs)
  const hadBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
  const body = hadBom ? buf.subarray(3) : buf
  return {
    relPath: toRelPath(root, abs),
    content: body.toString('utf8'),
    mtimeMs: st.mtimeMs,
    hadBom,
    binary: looksBinary(buf)
  }
}

export async function writeTextFile(root: string, req: WriteTextRequest): Promise<WriteTextResult> {
  const abs = requireWithin(root, req.relPath)
  let current: fsSync.Stats | null = null
  try {
    current = await fsp.stat(abs)
  } catch {
    current = null
  }
  if (req.expectedMtimeMs !== null && current && Math.abs(current.mtimeMs - req.expectedMtimeMs) > 2) {
    return { saved: false, conflict: true, currentMtimeMs: current.mtimeMs }
  }
  const data = Buffer.from((req.hadBom ? '\ufeff' : '') + req.content, 'utf8')
  const tmp = `${abs}.fdtmp${process.pid}`
  try {
    await fsp.writeFile(tmp, data)
    await fsp.rename(tmp, abs)
  } catch (err) {
    try {
      await fsp.unlink(tmp)
    } catch {
      /* nothing to clean */
    }
    fail(err)
  }
  const st = await fsp.stat(abs)
  return { saved: true, mtimeMs: st.mtimeMs }
}

export async function readBytes(root: string, relPath: string, maxBytes: number): Promise<ArrayBuffer> {
  const abs = requireWithin(root, relPath)
  const st = await fsp.stat(abs)
  if (!st.isFile()) throw new Error('That path is not a file.')
  if (st.size > maxBytes) {
    throw new Error(`File is too large to preview (over ${Math.round(maxBytes / (1024 * 1024))} MB).`)
  }
  const buf = await fsp.readFile(abs)
  const out = new ArrayBuffer(buf.byteLength)
  new Uint8Array(out).set(buf)
  return out
}

export async function excerptFor(root: string, relPath: string): Promise<string> {
  const abs = requireWithin(root, relPath)
  const st = await fsp.stat(abs)
  if (st.size === 0) return ''
  const fh = await fsp.open(abs, 'r')
  try {
    const len = Math.min(st.size, 8192)
    const buf = Buffer.alloc(len)
    await fh.read(buf, 0, len, 0)
    if (looksBinary(buf)) return ''
    let text = buf.toString('utf8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    return extractExcerpt(text)
  } finally {
    await fh.close()
  }
}

export async function detailedMeta(root: string, relPath: string): Promise<DetailedFileMeta> {
  const abs = requireWithin(root, relPath)
  const st = await fsp.stat(abs)
  const name = path.basename(abs)
  const ext = extOf(name)
  const kind = kindForExt(ext)
  let width: number | null = null
  let height: number | null = null
  if (kind === 'image') {
    try {
      const fh = await fsp.open(abs, 'r')
      try {
        const len = Math.min(st.size, 65536)
        const buf = Buffer.alloc(len)
        await fh.read(buf, 0, len, 0)
        const dims = parseImageDimensions(buf, ext)
        if (dims) {
          width = dims.width
          height = dims.height
        }
      } finally {
        await fh.close()
      }
    } catch {
      /* metadata is best-effort */
    }
  }
  let binary = false
  if (isTextKind(kind)) {
    try {
      const fh = await fsp.open(abs, 'r')
      try {
        const len = Math.min(st.size, 8192)
        const buf = Buffer.alloc(len)
        await fh.read(buf, 0, len, 0)
        binary = looksBinary(buf)
      } finally {
        await fh.close()
      }
    } catch {
      binary = false
    }
  }
  return {
    relPath: toRelPath(root, abs),
    name,
    ext,
    kind,
    size: st.size,
    mtimeMs: st.mtimeMs,
    binary,
    width,
    height
  }
}

export async function renameFile(root: string, relPath: string, rawNewName: string): Promise<LibrarySnapshot> {
  const abs = requireWithin(root, relPath)
  const check = checkFileName(rawNewName)
  if (!check.valid) throw new Error(check.reason)
  const oldKind = kindForExt(extOf(path.basename(abs)))
  const newKind = kindForExt(extOf(check.value))
  if (oldKind !== newKind && !isTextKind(oldKind)) {
    throw new Error('Non-text files must keep their original extension.')
  }
  const target = path.join(path.dirname(abs), check.value)
  if (path.resolve(target) !== path.resolve(abs) && fsSync.existsSync(target)) {
    throw new Error('A file with that name already exists here.')
  }
  try {
    await fsp.rename(abs, target)
  } catch (err) {
    fail(err)
  }
  return scanLibrary(root)
}

export async function moveFile(root: string, relPath: string, targetFolder: string): Promise<LibrarySnapshot> {
  const abs = requireWithin(root, relPath)
  const targetDir = targetDirFor(root, targetFolder)
  if (targetFolder !== UNSORTED && !fsSync.existsSync(targetDir)) {
    throw new Error('The target collection no longer exists.')
  }
  if (path.resolve(path.dirname(abs)) === path.resolve(targetDir)) return scanLibrary(root)
  const target = path.join(targetDir, path.basename(abs))
  if (fsSync.existsSync(target)) {
    throw new Error(`"${path.basename(abs)}" already exists in ${targetFolder}.`)
  }
  try {
    await fsp.rename(abs, target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      try {
        await fsp.copyFile(abs, target)
        await fsp.unlink(abs)
      } catch (err2) {
        try {
          await fsp.unlink(target)
        } catch {
          /* nothing to clean */
        }
        fail(err2)
      }
    } else {
      fail(err)
    }
  }
  return scanLibrary(root)
}

export async function deleteFile(root: string, relPath: string): Promise<LibrarySnapshot> {
  const abs = requireWithin(root, relPath)
  if (!fsSync.existsSync(abs)) throw new Error('That file no longer exists on disk.')
  await trashPath(abs)
  return scanLibrary(root)
}

export async function importPaths(root: string, absPaths: string[], targetFolder: string): Promise<ImportResult> {
  const targetDir = targetDirFor(root, targetFolder)
  if (targetFolder !== UNSORTED && !fsSync.existsSync(targetDir)) {
    throw new Error('The target collection no longer exists.')
  }
  const result: ImportResult = { imported: [], moved: [], skipped: [] }
  for (const p of absPaths) {
    const display = path.basename(path.resolve(p))
    try {
      const resolved = path.resolve(p)
      const st = await fsp.stat(resolved)
      if (!st.isFile()) {
        result.skipped.push({ name: display, reason: 'Not a file.' })
        continue
      }
      if (st.size > MAX_IMPORT_BYTES) {
        result.skipped.push({ name: display, reason: 'Larger than 200 MB.' })
        continue
      }
      const inside = resolveWithinRoot(root, resolved)
      if (inside) {
        if (path.resolve(path.dirname(inside)) === path.resolve(targetDir)) {
          result.skipped.push({ name: display, reason: 'Already in this collection.' })
          continue
        }
        const target = uniqueName(await listNames(targetDir), path.basename(resolved))
        try {
          await fsp.rename(inside, path.join(targetDir, target))
          result.moved.push({ name: target, relPath: toRelPath(root, path.join(targetDir, target)) })
        } catch (err) {
          result.skipped.push({ name: display, reason: describeFsError(err) })
        }
        continue
      }
      const target = uniqueName(await listNames(targetDir), path.basename(resolved))
      try {
        await fsp.copyFile(resolved, path.join(targetDir, target))
        result.imported.push({ name: target, relPath: toRelPath(root, path.join(targetDir, target)) })
      } catch (err) {
        result.skipped.push({ name: display, reason: describeFsError(err) })
      }
    } catch (err) {
      result.skipped.push({ name: display, reason: describeFsError(err) })
    }
  }
  return result
}

export async function createNote(
  root: string,
  folderName: string,
  baseName = 'Untitled Note'
): Promise<{ relPath: string; mtimeMs: number }> {
  if (folderName === UNSORTED) throw new Error('Pick a collection for new notes.')
  const dir = targetDirFor(root, folderName)
  if (!fsSync.existsSync(dir)) throw new Error('The target collection no longer exists.')
  const name = uniqueName(await listNames(dir), `${baseName}.md`)
  const abs = path.join(dir, name)
  const content = `# ${name.replace(/\.md$/, '')}\n\n`
  const tmp = `${abs}.fdtmp${process.pid}`
  try {
    await fsp.writeFile(tmp, content, 'utf8')
    await fsp.rename(tmp, abs)
  } catch (err) {
    try {
      await fsp.unlink(tmp)
    } catch {
      /* nothing to clean */
    }
    fail(err)
  }
  const st = await fsp.stat(abs)
  return { relPath: toRelPath(root, abs), mtimeMs: st.mtimeMs }
}
