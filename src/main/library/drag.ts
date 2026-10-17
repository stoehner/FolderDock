import { app } from 'electron'
import fsSync from 'node:fs'
import path from 'node:path'
import type { FileKind } from '../../shared/types'

export function resourcesDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(app.getAppPath(), 'resources')
}

export function dragIconFor(kind: FileKind): string {
  const name =
    kind === 'markdown'
      ? 'md'
      : kind === 'text'
        ? 'txt'
        : kind === 'image'
          ? 'image'
          : kind === 'pdf'
            ? 'pdf'
            : 'file'
  const p = path.join(resourcesDir(), 'drag', `${name}.png`)
  if (fsSync.existsSync(p)) return p
  return path.join(resourcesDir(), 'drag', 'file.png')
}
