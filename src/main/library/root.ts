import { app } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'

export function defaultRoot(): string {
  return path.join(app.getPath('documents'), 'FolderDock')
}

export function resolveRoot(prefsRoot: string | null): string {
  const envRoot = process.env.FOLDERDOCK_ROOT
  if (envRoot && envRoot.trim()) return path.resolve(envRoot.trim())
  if (prefsRoot && prefsRoot.trim()) return path.resolve(prefsRoot.trim())
  return defaultRoot()
}

export async function ensureRoot(root: string): Promise<void> {
  await fsp.mkdir(root, { recursive: true })
}

const WELCOME = `# Welcome to FolderDock

This folder is your library. Everything you see in FolderDock is a **real file on disk**, right here.

## Quick tips

- Click a frosted folder front to open it in place.
- Grab a visible paper sheet and drag it straight into Explorer or any app that accepts files.
- Drop files from Explorer onto a collection or the drop zone to move them into your library; the source copy is removed.
- Drag a file between collections to move it for real.
- Click the star on a file row or a collection card to add it to Favorites.
- Hover any sheet for a quick summary; click it for the full preview modal.
- Press **Ctrl+F** to search, **Ctrl+N** for a quick note, **Ctrl+S** to save while editing.
`

export async function seedWelcome(root: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(root)
    if (entries.length > 0) return false
    const notesDir = path.join(root, 'Notes')
    await fsp.mkdir(notesDir, { recursive: true })
    await fsp.writeFile(path.join(notesDir, 'Welcome.md'), WELCOME, 'utf8')
    return true
  } catch {
    return false
  }
}
