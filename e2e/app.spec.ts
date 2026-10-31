import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import fsSync from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()

interface World {
  app: ElectronApplication
  page: Page
  root: string
  userData: string
}

async function launch(seedFiles?: Record<string, string>): Promise<World> {
  const root = seedFiles
    ? await fsp.mkdtemp(path.join(os.tmpdir(), 'folderdock-lib-'))
    : path.join(os.tmpdir(), `folderdock-lib-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'folderdock-user-'))
  if (seedFiles) {
    for (const [rel, content] of Object.entries(seedFiles)) {
      const abs = path.join(root, rel)
      await fsp.mkdir(path.dirname(abs), { recursive: true })
      await fsp.writeFile(abs, content, 'utf8')
    }
  }
  const app = await _electron.launch({
    args: [projectRoot],
    env: {
      ...process.env,
      FOLDERDOCK_ROOT: root,
      FOLDERDOCK_USER_DATA: userData,
      FOLDERDOCK_SOFTWARE_GPU: '1',
      FOLDERDOCK_DEVTOOLS: '0'
    }
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 })
  return { app, page, root, userData }
}

async function close(world: World): Promise<void> {
  try {
    await world.app.close()
  } catch {
    /* already gone */
  }
  await fsp.rm(world.root, { recursive: true, force: true }).catch(() => undefined)
  await fsp.rm(world.userData, { recursive: true, force: true }).catch(() => undefined)
}

/**
 * Fires a synthetic HTML5 drag sequence synchronously: one shared DataTransfer across
 * dragstart → dragover → drop → dragend, all dispatched in a single script so dragend
 * lands before any re-render can unmount the drag source (as with a real mouse drag).
 */
async function runInternalScriptDrag(
  page: Page,
  srcSel: string,
  dstSel: string | null,
  opts: { dragover?: boolean; drop?: boolean; dragend?: boolean; forceEffect?: string } = {}
): Promise<void> {
  await page.evaluate(
    ({ opts, srcSel, dstSel }) => {
      const doc = (
        globalThis as unknown as {
          document: { querySelector: (s: string) => { dispatchEvent: (ev: unknown) => void } | null }
        }
      ).document
      const g = globalThis as unknown as {
        DataTransfer: new () => { dropEffect: string }
        DragEvent: new (
          type: string,
          init?: { dataTransfer?: unknown; bubbles?: boolean; cancelable?: boolean }
        ) => unknown
      }
      const dt = new g.DataTransfer()
      const fire = (el: { dispatchEvent: (ev: unknown) => void }, type: string): void =>
        el.dispatchEvent(new g.DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }))
      const src = doc.querySelector(srcSel)
      if (!src) throw new Error(`missing drag source: ${srcSel}`)
      fire(src, 'dragstart')
      if (opts.forceEffect) dt.dropEffect = opts.forceEffect
      const dst = dstSel ? doc.querySelector(dstSel) : null
      if (dst && opts.dragover) fire(dst, 'dragover')
      if (dst && opts.drop) fire(dst, 'drop')
      if (opts.dragend) fire(src, 'dragend')
    },
    { opts, srcSel, dstSel }
  )
}

test.describe('FolderDock app', () => {
  test('boots, seeds welcome library, and shows collections', async () => {
    const world = await launch()
    try {
      await expect(world.page.locator('.brand')).toHaveText('FolderDock')
      await expect(world.page.locator('.folder-card')).toHaveCount(1)
      await expect(world.page.locator('.folder-label .name')).toHaveText('Notes')
      expect(fsSync.existsSync(path.join(world.root, 'Notes', 'Welcome.md'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('shows pre-seeded folders and files with real disk content', async () => {
    const world = await launch({
      'Research/tape.md': '# Tape Character\n\nSaturation curves for drum processing.',
      'Research/licensing.txt': 'Confirm each typeface license.',
      'Screenshots/diagram.png': 'not really a png'
    })
    try {
      await expect(world.page.locator('.folder-card')).toHaveCount(2)
      const research = world.page.locator('[data-folder="Research"]')
      await research.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await expect(view.locator('.file-row')).toHaveCount(2)
      await expect(view.locator('.file-row', { hasText: 'tape.md' })).toBeVisible()
    } finally {
      await close(world)
    }
  })

  test('creates a collection through the modal', async () => {
    const world = await launch()
    try {
      await world.page.locator('.toolbar .primary-button', { hasText: 'New folder' }).click()
      await world.page.locator('#folderName').fill('Prompts')
      await world.page.locator('.modal-foot .primary-button').click()
      const createdView = world.page.locator('.collection-page')
      await expect(createdView).toBeVisible()
      await expect(createdView.locator('.page-name')).toHaveText('Prompts')
      await createdView.locator('.page-back').click()
      await expect(createdView).toHaveCount(0)
      await expect(world.page.locator('.folder-card')).toHaveCount(2)
      expect(fsSync.existsSync(path.join(world.root, 'Prompts'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('creates a quick note, edits and saves it to disk', async () => {
    const world = await launch()
    try {
      const notes = world.page.locator('[data-folder="Notes"]')
      await notes.locator('.folder-scene').click()
      const notesView = world.page.locator('.collection-page')
      await expect(notesView).toBeVisible()
      await notesView.locator('button[aria-label="New note"]').click()
      const editor = world.page.locator('.editor-modal')
      await expect(editor).toBeVisible()
      await editor.locator('.editor-textarea').fill('# Hello E2E\n\nReal file on disk.')
      await editor.locator('.primary-button', { hasText: 'Save changes' }).click()
      await expect(editor).toBeHidden()
      const files = fsSync.readdirSync(path.join(world.root, 'Notes'))
      expect(files.some(f => f.startsWith('Untitled Note'))).toBe(true)
      const saved = fsSync.readFileSync(path.join(world.root, 'Notes', 'Untitled Note.md'), 'utf8')
      expect(saved).toContain('Real file on disk.')
    } finally {
      await close(world)
    }
  })

  test('renames a file from the context menu', async () => {
    const world = await launch({ 'Research/old-name.md': 'content' })
    try {
      const research = world.page.locator('[data-folder="Research"]')
      await research.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      const row = view.locator('.file-row', { hasText: 'old-name.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Rename' }).click()
      await world.page.locator('#renameFileInput').fill('new-name.md')
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(view.locator('.file-row', { hasText: 'new-name.md' })).toBeVisible()
      expect(fsSync.existsSync(path.join(world.root, 'Research', 'new-name.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'Research', 'old-name.md'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('moves a file between collections on disk', async () => {
    const world = await launch({
      'A/doc.md': 'move me',
      'B/keep.md': 'stay'
    })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      const row = view.locator('.file-row', { hasText: 'doc.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Move to collection' }).click()
      await world.page.locator('.move-option', { hasText: 'B' }).click()
      await expect(view.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
      expect(fsSync.existsSync(path.join(world.root, 'B', 'doc.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'A', 'doc.md'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('deletes a file to the Recycle Bin after confirmation', async () => {
    const world = await launch({ 'A/gone.md': 'delete me' })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      const row = view.locator('.file-row', { hasText: 'gone.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Delete file' }).click()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(world.page.locator('.modal')).toHaveCount(0)
      await expect(view.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
      expect(fsSync.existsSync(path.join(world.root, 'A', 'gone.md'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('search filters folders and files', async () => {
    const world = await launch({
      'Alpha/one.md': 'x',
      'Beta/two-special.md': 'y'
    })
    try {
      await world.page.locator('#searchInput').fill('special')
      await expect(world.page.locator('.folder-card')).toHaveCount(1)
      await expect(world.page.locator('.folder-card', { hasText: 'Beta' })).toBeVisible()
      await world.page.locator('#searchInput').fill('zzz-none')
      await expect(world.page.locator('.empty')).toBeVisible()
    } finally {
      await close(world)
    }
  })

  test('search matches text inside files and shows a snippet', async () => {
    const world = await launch({
      'Alpha/plain.md': '# Nothing special here\n\nThe launch checklist lives elsewhere.',
      'Beta/unrelated.txt': 'grocery list\n\npick up oregano and lightbulbs\n'
    })
    try {
      await world.page.locator('#searchInput').fill('oregano')
      await expect(world.page.locator('.folder-card')).toHaveCount(1)
      const beta = world.page.locator('[data-folder="Beta"]')
      await expect(beta.locator('.file-row', { hasText: 'unrelated.txt' })).toBeVisible()
      await expect(beta.locator('.file-row .file-snippet')).toContainText('oregano')
      await world.page.locator('#searchInput').fill('')
      await expect(world.page.locator('.folder-card')).toHaveCount(2)
    } finally {
      await close(world)
    }
  })

  test('hover summaries turn on from settings, appear after delay, and preview opens on click', async () => {
    const world = await launch({ 'A/note.md': '# Titled\n\nBody text for the summary tooltip.' })
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Fast' }).click()
      await settings.locator('.modal-foot .primary-button').click()
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      const row = view.locator('.file-row', { hasText: 'note.md' })
      await row.hover()
      const tip = world.page.locator('.file-summary')
      await expect(tip).toBeVisible({ timeout: 5000 })
      await expect(tip.locator('.peek-name')).toHaveText('note.md')
      await expect(tip.locator('.peek-body')).toContainText('Body text for the summary tooltip')
      await row.click()
      const preview = world.page.locator('.preview-modal')
      await expect(preview).toBeVisible()
      await expect(preview.locator('.preview-title')).toHaveText('note.md')
      await expect(preview.locator('.markdown-preview')).toContainText('Titled')
      await preview.locator('.preview-close').click()
      await expect(preview).toBeHidden()
      await expect(view).toBeVisible()
    } finally {
      await close(world)
    }
  })

  test('detects loose root files as the Unsorted collection', async () => {
    const world = await launch({ 'loose-file.txt': 'at root' })
    try {
      await expect(world.page.locator('.folder-card', { hasText: 'Unsorted' })).toHaveCount(1)
    } finally {
      await close(world)
    }
  })

  test('watches external file changes and refreshes', async () => {
    const world = await launch({ 'A/first.md': 'one' })
    try {
      await expect(world.page.locator('.file-row', { hasText: 'first.md' })).toBeAttached()
      await fsp.writeFile(path.join(world.root, 'A', 'second.md'), 'two', 'utf8')
      await expect(world.page.locator('.file-row', { hasText: 'second.md' })).toBeAttached({ timeout: 10_000 })
    } finally {
      await close(world)
    }
  })

  test('theme changes from settings and persists to prefs', async () => {
    const world = await launch()
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Light' }).click()
      await expect(world.page.locator('body.light')).toHaveCount(1)
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"theme": "light"'), {
          timeout: 5000
        })
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('always on top setting pins the window and persists across restart', async () => {
    const world = await launch()
    let app2: ElectronApplication | null = null
    try {
      const isPinned = (app: ElectronApplication) =>
        app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows()[0]
          return win ? win.isAlwaysOnTop() : false
        })
      expect(await isPinned(world.app)).toBe(false)
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('[role="switch"][aria-label="Always on top"]').click()
      await expect.poll(() => isPinned(world.app), { timeout: 5000 }).toBe(true)
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"alwaysOnTop": true'), {
          timeout: 5000
        })
        .toBe(true)
      await world.app.close()
      app2 = await _electron.launch({
        args: [projectRoot],
        env: {
          ...process.env,
          FOLDERDOCK_ROOT: world.root,
          FOLDERDOCK_USER_DATA: world.userData,
          FOLDERDOCK_SOFTWARE_GPU: '1',
          FOLDERDOCK_DEVTOOLS: '0'
        }
      })
      await app2.firstWindow()
      expect(await isPinned(app2)).toBe(true)
    } finally {
      try {
        await app2?.close()
      } catch {
        /* already gone */
      }
      await close(world)
    }
  })

  test('window size and position are remembered across restarts', async () => {
    const world = await launch()
    let app2: ElectronApplication | null = null
    const boundsOf = (app: ElectronApplication) =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        return win ? win.getBounds() : null
      })
    try {
      await world.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.setBounds({ x: 20, y: 0, width: 520, height: 590 })
      })
      await expect
        .poll(async () => {
          const b = await boundsOf(world.app)
          if (!b) return false
          return (
            Math.abs(b.width - 520) <= 3 && Math.abs(b.height - 590) <= 3 && Math.abs(b.x - 20) <= 3 && Math.abs(b.y - 0) <= 3
          )
        }, { timeout: 5000 })
        .toBe(true)
      await world.app.close()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      const saved = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8')).windowBounds
      expect(Math.abs(saved.width - 520)).toBeLessThanOrEqual(3)
      expect(Math.abs(saved.height - 590)).toBeLessThanOrEqual(3)
      expect(Math.abs(saved.x - 20)).toBeLessThanOrEqual(3)
      expect(Math.abs(saved.y - 0)).toBeLessThanOrEqual(3)
      app2 = await _electron.launch({
        args: [projectRoot],
        env: {
          ...process.env,
          FOLDERDOCK_ROOT: world.root,
          FOLDERDOCK_USER_DATA: world.userData,
          FOLDERDOCK_SOFTWARE_GPU: '1',
          FOLDERDOCK_DEVTOOLS: '0'
        }
      })
      const page2 = await app2.firstWindow()
      await page2.waitForLoadState('domcontentloaded')
      const bounds = await boundsOf(app2)
      if (!bounds) throw new Error('window missing after restart')
      expect(Math.abs(bounds.width - saved.width)).toBeLessThanOrEqual(10)
      expect(Math.abs(bounds.height - saved.height)).toBeLessThanOrEqual(10)
      expect(Math.abs(bounds.x - saved.x)).toBeLessThanOrEqual(10)
      expect(Math.abs(bounds.y - saved.y)).toBeLessThanOrEqual(10)
    } finally {
      try {
        await app2?.close()
      } catch {
        /* already gone */
      }
      await close(world)
    }
  })

  test('system theme follows the OS color scheme and persists', async () => {
    const world = await launch()
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'System' }).click()
      const scheme = await world.page.evaluate<string>("matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'")
      await expect(world.page.locator(scheme === 'dark' ? 'body:not(.light)' : 'body.light')).toHaveCount(1)
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"theme": "system"'), {
          timeout: 5000
        })
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('card size setting switches to compact and persists', async () => {
    const world = await launch()
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Compact' }).click()
      await expect(world.page.locator('body.compact')).toHaveCount(1)
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"viewSize": "compact"'), {
          timeout: 5000
        })
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('file sort setting reorders files inside a collection', async () => {
    const world = await launch({ 'A/zzz-new.md': 'x', 'A/aaa-old.md': 'y' })
    try {
      const past = new Date(Date.now() - 86_400_000)
      await fsp.utimes(path.join(world.root, 'A', 'aaa-old.md'), past, past)
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const sortView = world.page.locator('.collection-page')
      await expect(sortView).toBeVisible()
      await expect(sortView.locator('.file-row').first()).toContainText('zzz-new.md')
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Name' }).click()
      await settings.locator('.modal-foot .primary-button').click()
      await expect(settings).toBeHidden()
      await expect(sortView.locator('.file-row').first()).toContainText('aaa-old.md')
    } finally {
      await close(world)
    }
  })

  test('close to tray hides the window and quitting stays available', async () => {
    const world = await launch()
    try {
      await world.page.locator('[aria-label="Close window"]').click()
      await expect
        .poll(
          () =>
            world.app.evaluate(({ BrowserWindow }) => {
              const win = BrowserWindow.getAllWindows()[0]
              return win ? win.isVisible() : true
            }),
          { timeout: 5000 }
        )
        .toBe(false)
      await world.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.show()
      })
      await expect(world.page.locator('.app')).toBeVisible()
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('[role="switch"][aria-label="Close to tray"]').click()
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"closeToTray": false'), {
          timeout: 5000
        })
        .toBe(true)
      await world.page.locator('[aria-label="Close window"]').click()
      await world.app.waitForEvent('close', { timeout: 5000 })
    } finally {
      await close(world)
    }
  })

  test('image files show a thumbnail on their paper sheet', async () => {
    const world = await launch()
    try {
      await fsp.mkdir(path.join(world.root, 'Pics'), { recursive: true })
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      )
      await fsp.writeFile(path.join(world.root, 'Pics', 'dot.png'), png)
      const thumb = world.page.locator('[data-folder="Pics"] .sheet-thumb img')
      await expect(thumb).toBeAttached({ timeout: 10_000 })
      await expect(thumb).toHaveJSProperty('naturalWidth', 1)
    } finally {
      await close(world)
    }
  })

  test('multi-select moves and deletes several files at once', async () => {
    const world = await launch({
      'A/one.md': '1',
      'A/two.md': '2',
      'A/three.md': '3',
      'B/keep.md': 'b'
    })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await view.locator('.file-row[data-file="A/one.md"]').click({ modifiers: ['Control'] })
      await view.locator('.file-row[data-file="A/two.md"]').click({ modifiers: ['Control'] })
      await expect(world.page.locator('.selection-bar')).toContainText('2 selected')
      await world.page.locator('.selection-bar button', { hasText: 'Move to collection' }).click()
      await world.page.locator('.move-option', { hasText: 'B' }).click()
      await expect(world.page.locator('.selection-bar')).toHaveCount(0, { timeout: 15_000 })
      await expect(view.locator('.file-row')).toHaveCount(1)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'one.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'two.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'A', 'one.md'))).toBe(false)

      await view.locator('.page-back').click()
      const b = world.page.locator('[data-folder="B"]')
      await b.locator('.folder-scene').click()
      const bView = world.page.locator('.collection-page')
      await expect(bView.locator('.page-name')).toHaveText('B')
      await bView.locator('.file-row[data-file="B/one.md"]').click({ modifiers: ['Control'] })
      await bView.locator('.file-row[data-file="B/two.md"]').click({ modifiers: ['Control'] })
      await expect(world.page.locator('.selection-bar')).toContainText('2 selected')
      await world.page.locator('.selection-bar button', { hasText: 'Delete' }).click()
      await expect(world.page.locator('.modal', { hasText: 'Delete 2 files?' })).toBeVisible()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(bView.locator('.file-row')).toHaveCount(1, { timeout: 15_000 })
      expect(fsSync.existsSync(path.join(world.root, 'B', 'one.md'))).toBe(false)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'two.md'))).toBe(false)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'keep.md'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('recent filter shows only recently modified files', async () => {
    const world = await launch({ 'A/fresh.md': 'now', 'A/stale.md': 'then' })
    try {
      const past = new Date(Date.now() - 30 * 86_400_000)
      await fsp.utimes(path.join(world.root, 'A', 'stale.md'), past, past)
      await world.page.locator('.filter-chip', { hasText: 'Recent' }).click()
      const a = world.page.locator('[data-folder="A"]')
      await expect(a.locator('.file-row')).toHaveCount(1)
      await expect(a.locator('.file-row')).toContainText('fresh.md')
      await world.page.locator('.filter-chip', { hasText: 'All' }).click()
      await expect(a.locator('.file-row')).toHaveCount(2)
    } finally {
      await close(world)
    }
  })

  test('confirm-delete can be skipped from settings', async () => {
    const world = await launch({ 'A/quick.md': 'x' })
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('[role="switch"][aria-label="Confirm before delete"]').click()
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"confirmDelete": false'), {
          timeout: 5000
        })
        .toBe(true)
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const quickView = world.page.locator('.collection-page')
      await expect(quickView).toBeVisible()
      const row = quickView.locator('.file-row', { hasText: 'quick.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Delete file' }).click()
      await expect(quickView.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
      expect(fsSync.existsSync(path.join(world.root, 'A', 'quick.md'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('editor guards unsaved changes on close', async () => {
    const world = await launch({ 'A/note.md': 'original' })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const guardView = world.page.locator('.collection-page')
      await expect(guardView).toBeVisible()
      await guardView.locator('.file-row', { hasText: 'note.md' }).dblclick()
      const editor = world.page.locator('.editor-modal')
      await expect(editor).toBeVisible()
      await editor.locator('.editor-textarea').fill('changed content')
      await editor.locator('.exit').click()
      const confirmModal = world.page.locator('.modal', { hasText: 'Discard unsaved changes?' })
      await expect(confirmModal).toBeVisible()
      await confirmModal.locator('.modal-foot .primary-button').click()
      await expect(editor).toBeHidden()
      expect(fsSync.readFileSync(path.join(world.root, 'A', 'note.md'), 'utf8')).toBe('original')
    } finally {
      await close(world)
    }
  })

  test('opening the preview shows a modal without resizing the window', async () => {
    const world = await launch({ 'A/note.md': '# T\n\nBody text.' })
    try {
      const widthOf = () =>
        world.app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows()[0]
          return win ? win.getBounds().width : 0
        })
      const before = await widthOf()
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const resizeView = world.page.locator('.collection-page')
      await expect(resizeView).toBeVisible()
      const row = resizeView.locator('.file-row', { hasText: 'note.md' })
      await row.click()
      const preview = world.page.locator('.preview-modal')
      await expect(preview).toBeVisible()
      expect(await widthOf()).toBe(before)
      await preview.locator('.preview-close').click()
      await expect(preview).toBeHidden()
      expect(await widthOf()).toBe(before)

      await row.click()
      await expect(preview).toBeVisible()
      await world.page.waitForTimeout(600)
      await world.page.locator('.modal-layer').click({ position: { x: 6, y: 6 } })
      await expect(preview).toBeHidden()

      await row.click()
      await expect(preview).toBeVisible()
      await world.page.keyboard.press('Escape')
      await expect(preview).toBeHidden()
      expect(await widthOf()).toBe(before)

      await row.click()
      await expect(preview).toBeVisible()
      await preview.locator('.primary-button', { hasText: 'Edit' }).click()
      const editor = world.page.locator('.editor-modal')
      await expect(editor).toBeVisible()
      await editor.locator('.exit').click()
      await expect(editor).toBeHidden()
      await expect(preview).toBeVisible()
      expect(await widthOf()).toBe(before)
    } finally {
      await close(world)
    }
  })

  test('cards per row setting switches grid columns and persists', async () => {
    const world = await launch({ 'A/a.md': 'x', 'B/b.md': 'x', 'C/c.md': 'x' })
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: '3' }).click()
      await expect(world.page.locator('body.cols-3')).toHaveCount(1)
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"cardColumns": 3'), {
          timeout: 5000
        })
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('cards per row is honored at every window width and cards shrink to fit', async () => {
    const world = await launch({ 'A/a.md': 'x', 'B/b.md': 'x', 'C/c.md': 'x' })
    try {
      const columnCount = () =>
        world.page.evaluate<number>(
          'getComputedStyle(document.querySelector(".library-grid")).gridTemplateColumns.split(" ").length'
        )
      const cardWidth = () =>
        world.page.evaluate<number>('document.querySelector(".folder-card").getBoundingClientRect().width')
      const setWidth = (width: number) =>
        world.app.evaluate(({ BrowserWindow }, w: number) => {
          const win = BrowserWindow.getAllWindows()[0]
          if (win) {
            const b = win.getBounds()
            win.setBounds({ ...b, width: w })
          }
        }, width)

      for (const width of [1300, 1000, 800, 650, 500, 430]) {
        await setWidth(width)
        await world.page.waitForTimeout(150)
        expect(await columnCount(), `default grid at width ${width}`).toBe(2)
      }

      for (const columns of [3, 4] as const) {
        await world.page.locator('.footer [aria-label="Open settings"]').click()
        const settings = world.page.locator('.modal')
        await expect(settings).toBeVisible()
        await settings.locator('.theme-choice', { hasText: String(columns) }).click()
        await settings.locator('.modal-foot .primary-button').click()
        await expect(world.page.locator(`body.cols-${columns}`)).toHaveCount(1)
        for (const width of [1000, 800, 600, 430]) {
          await setWidth(width)
          await world.page.waitForTimeout(150)
          expect(await columnCount(), `cols-${columns} grid at width ${width}`).toBe(columns)
        }
      }

      await setWidth(1000)
      await world.page.waitForTimeout(150)
      const wide = await cardWidth()
      await setWidth(430)
      await world.page.waitForTimeout(150)
      const narrow = await cardWidth()
      expect(narrow, 'cards shrink as the window narrows').toBeGreaterThan(0)
      expect(narrow).toBeLessThan(wide)
    } finally {
      await close(world)
    }
  })

  test('right-click on a folder opens its context menu with recolor and rename', async () => {
    const world = await launch({ 'A/doc.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click({ button: 'right' })
      const menu = world.page.locator('.context-menu')
      await expect(menu).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Change color' })).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Rename collection' })).toBeVisible()
      await menu.locator('button', { hasText: 'Change color' }).click()
      const modal = world.page.locator('.modal')
      await expect(modal).toBeVisible()
      await modal.locator('.swatch[aria-label="Art style dusk"]').click()
      await modal.locator('.modal-foot .primary-button').click()
      await expect(modal).toBeHidden()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () =>
            fsSync.existsSync(prefsFile) &&
            /"folderArt"[\s\S]*?"A"\s*:\s*"[a-z]+"/.test(fsSync.readFileSync(prefsFile, 'utf8')),
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('deleting a collection prunes its saved preferences', async () => {
    const world = await launch({ 'A/doomed.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
      const modal = world.page.locator('.modal')
      await modal.locator('.swatch[aria-label="Art style dusk"]').click()
      await modal.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && /"folderArt"[\s\S]*"A"\s*:/.test(fsSync.readFileSync(prefsFile, 'utf8')), {
          timeout: 5000
        })
        .toBe(true)
      await card.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Delete collection' }).click()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect
        .poll(
          () =>
            fsSync.existsSync(prefsFile)
              ? !/"folderArt"[\s\S]*"A"\s*:/.test(fsSync.readFileSync(prefsFile, 'utf8'))
              : true,
          { timeout: 15_000 }
        )
        .toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'A'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('right-click on a file row opens the file context menu', async () => {
    const world = await launch({ 'A/doc.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await view.locator('.file-row', { hasText: 'doc.md' }).click({ button: 'right' })
      const menu = world.page.locator('.context-menu')
      await expect(menu).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Open with default app' })).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Rename' })).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Preview' })).toHaveCount(0)
      await expect(menu.locator('button', { hasText: 'favorites' })).toHaveCount(0)
    } finally {
      await close(world)
    }
  })

  test('custom color picker persists a hex art value for a collection', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
      const modal = world.page.locator('.modal')
      await expect(modal).toBeVisible()
      await world.page.locator('.modal .swatch[aria-label="Custom color"]').click()
      await world.page.locator('.cp-panel .hex-input').fill('#ff8800')
      await world.page.locator('.cp-panel .hex-apply').click()
      await expect(card.locator('.folder-scene')).toHaveAttribute('style', /#ff8800/)
      await modal.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(() => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"A": "#ff8800"'), {
          timeout: 5000
        })
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('auto swatch clears a pinned collection color', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      const openRecolor = async (): Promise<void> => {
        await card.locator('.folder-scene').click({ button: 'right' })
        await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
        await expect(world.page.locator('.modal')).toBeVisible()
      }
      await openRecolor()
      await world.page.locator('.modal .swatch[aria-label="Art style dusk"]').click()
      await world.page.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () =>
            fsSync.existsSync(prefsFile) && JSON.parse(fsSync.readFileSync(prefsFile, 'utf8')).folderArt?.A === 'dusk',
          { timeout: 5000 }
        )
        .toBe(true)
      await openRecolor()
      await world.page.locator('.modal .swatch[aria-label="Auto color"]').click()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            return Object.keys(JSON.parse(fsSync.readFileSync(prefsFile, 'utf8')).folderArt ?? {}).length === 0
          },
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('restore defaults reverts settings and clears pinned colors', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
      await world.page.locator('.modal .swatch[aria-label="Art style ember"]').click()
      await world.page.locator('.modal-foot .primary-button').click()

      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Light' }).click()
      await expect(world.page.locator('body.light')).toHaveCount(1)
      await settings.locator('.secondary-button', { hasText: 'Restore…' }).click()
      const confirm = world.page.locator('.modal', { hasText: 'Restore defaults?' })
      await expect(confirm).toBeVisible()
      await confirm.locator('.modal-foot .primary-button').click()
      await expect(world.page.locator('body.light')).toHaveCount(0)
      await expect(world.page.locator('.modal', { hasText: 'Settings' })).toBeVisible()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            const p = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8'))
            return (
              p.theme === 'dark' &&
              p.cardColumns === 2 &&
              p.newFolderArt === 'varied' &&
              Object.keys(p.folderArt ?? {}).length === 0
            )
          },
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('new collection colors setting pins the default for created collections', async () => {
    const world = await launch()
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.swatch[aria-label="Default style ocean"]').click()
      await settings.locator('.modal-foot .primary-button').click()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () => fsSync.existsSync(prefsFile) && fsSync.readFileSync(prefsFile, 'utf8').includes('"newFolderArt": "ocean"'),
          { timeout: 5000 }
        )
        .toBe(true)
      await world.page.locator('.toolbar .primary-button', { hasText: 'New folder' }).click()
      await world.page.locator('#folderName').fill('Voyage')
      await world.page.locator('.modal-foot .primary-button').click()
      const voyageView = world.page.locator('.collection-page')
      await expect(voyageView).toBeVisible()
      await voyageView.locator('.page-back').click()
      await expect(world.page.locator('[data-folder="Voyage"] .folder-scene')).toHaveAttribute('style', /#3d8ec9/)
    } finally {
      await close(world)
    }
  })

  test('drag hint bar clears after a drop lands on a collection', async () => {
    const world = await launch({ 'A/one.md': 'x', 'B/b.md': 'y' })
    try {
      const dt = await world.page.evaluateHandle(() => {
        const g = globalThis as unknown as { DataTransfer: new () => { items: { add: (f: File) => void } } }
        const d = new g.DataTransfer()
        d.items.add(new File(['x'], 'note.txt'))
        return d
      })
      await world.page.dispatchEvent('.app', 'dragenter', { dataTransfer: dt })
      await expect(world.page.locator('.drop-hint-bar')).toBeVisible()
      await world.page.dispatchEvent('[data-folder="A"]', 'drop', { dataTransfer: dt })
      await expect(world.page.locator('.drop-hint-bar')).toHaveCount(0)

      await world.page.dispatchEvent('.dropzone', 'dragenter', { dataTransfer: dt })
      await world.page.dispatchEvent('.dropzone', 'dragover', { dataTransfer: dt })
      await expect(world.page.locator('.dropzone.drag-over')).toHaveCount(1)
      await expect(world.page.locator('.drop-hint-bar')).toBeVisible()
      await world.page.dispatchEvent('.dropzone', 'drop', { dataTransfer: dt })
      await expect(world.page.locator('.dropzone.drag-over')).toHaveCount(0)
      await expect(world.page.locator('.drop-hint-bar')).toHaveCount(0)
    } finally {
      await close(world)
    }
  })

  test('importing an external file moves it into the collection', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      const src = path.join(world.userData, 'From-Desktop.md')
      await fsp.writeFile(src, 'moved from outside', 'utf8')
      const r = (await world.page.evaluate(
        p => {
          const b = (globalThis as unknown as { folderdock: { dropFiles: (ps: string[], t: string) => Promise<unknown> } })
            .folderdock
          return b.dropFiles([p], 'A')
        },
        src
      )) as { ok: boolean; data: { moved: { name: string; relPath: string }[] } }
      expect(r.ok).toBe(true)
      expect(r.data.moved).toHaveLength(1)
      expect(fsSync.existsSync(src)).toBe(false)
      expect(fsSync.readFileSync(path.join(world.root, 'A', 'From-Desktop.md'), 'utf8')).toBe('moved from outside')
    } finally {
      await close(world)
    }
  })

  test('back up now copies the library into a timestamped backup folder', async () => {
    const world = await launch({ 'A/one.md': 'x', 'B/b.md': 'y' })
    let backupBase = ''
    try {
      backupBase = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-backup-'))
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await expect(settings.locator('.settings-row', { hasText: 'Backup' })).toContainText('Z:\\REA-Backups')
      const set = (await world.page.evaluate(
        b => {
          const bridge = (globalThis as unknown as {
            folderdock: { setPrefs: (patch: { backupLocation: string }) => Promise<unknown> }
          }).folderdock
          return bridge.setPrefs({ backupLocation: b })
        },
        backupBase
      )) as { ok: boolean }
      expect(set.ok).toBe(true)
      await settings.locator('.settings-row', { hasText: 'Backup' }).locator('.primary-button').click()
      await expect(world.page.locator('.toast')).toContainText('Backed up 2 files to')
      const base = path.join(backupBase, 'FolderDock')
      const entries = await fsp.readdir(base)
      expect(entries).toHaveLength(1)
      const backupDir = path.join(base, entries[0] ?? '')
      expect(await fsp.readFile(path.join(backupDir, 'A', 'one.md'), 'utf8')).toBe('x')
      expect(await fsp.readFile(path.join(backupDir, 'B', 'b.md'), 'utf8')).toBe('y')
      expect(fsSync.existsSync(path.join(world.root, 'A', 'one.md'))).toBe(true)
    } finally {
      if (backupBase) await fsp.rm(backupBase, { recursive: true, force: true }).catch(() => undefined)
      await close(world)
    }
  })

  test('favorites: starring files and collections shows them under the Favorites filter', async () => {
    const world = await launch({ 'A/one.md': 'x', 'B/b.md': 'y' })
    try {
      const cardA = world.page.locator('.folder-card[data-folder="A"]')
      await cardA.locator('.star-btn').click()
      await cardA.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view.locator('.page-name')).toHaveText('A')
      await view.locator('.file-row[data-file="A/one.md"] .file-star').click()
      await world.page.locator('.filter-chip', { hasText: 'Favorites' }).click()
      await expect(view.locator('.file-row[data-file="A/one.md"]')).toBeVisible()
      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            const s = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8')).starred ?? []
            return s.includes('A') && s.includes('A/one.md')
          },
          { timeout: 5000 }
        )
        .toBe(true)
      await view.locator('.file-row[data-file="A/one.md"] .file-star').click()
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            const s = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8')).starred ?? []
            return s.includes('A') && !s.includes('A/one.md')
          },
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('saved custom colors persist, are reusable, and deleting one never changes collections', async () => {
    const world = await launch({ 'A/one.md': 'x', 'B/b.md': 'y' })
    try {
      const cardA = world.page.locator('.folder-card[data-folder="A"]')
      const cardB = world.page.locator('.folder-card[data-folder="B"]')

      // pick a custom color for A through the visual picker; it is auto-saved
      await cardA.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
      await world.page.locator('.modal .swatch[aria-label="Custom color"]').click()
      const hexField = world.page.locator('.cp-panel .hex-input')
      await expect(hexField).toHaveValue('#ffffff')
      await world.page.locator('.cp-panel .cp-square').click({ position: { x: 150, y: 20 } })
      await expect(hexField).not.toHaveValue('#ffffff')
      await hexField.fill('#ff8800')
      await world.page.locator('.cp-panel .hex-apply').click()
      await expect(world.page.locator('.modal .swatch[aria-label="Saved color #ff8800"]')).toBeVisible()
      await world.page.locator('.modal .modal-foot .primary-button').click()
      await expect(cardA.locator('.folder-scene')).toHaveAttribute('style', /#ff8800/)

      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            const p = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8'))
            return (p.customColors ?? []).includes('#ff8800') && p.folderArt?.A === '#ff8800'
          },
          { timeout: 5000 }
        )
        .toBe(true)

      // reuse the saved swatch for B, then delete it from the palette
      await cardB.locator('.folder-scene').click({ button: 'right' })
      await world.page.locator('.context-menu button', { hasText: 'Change color' }).click()
      await world.page.locator('.modal .swatch[aria-label="Saved color #ff8800"]').click()
      await expect(world.page.locator('.modal .swatch[aria-label="Saved color #ff8800"]')).toHaveCount(1)
      await expect(cardB.locator('.folder-scene')).toHaveAttribute('style', /#ff8800/)
      await world.page.locator('.saved-swatch .saved-delete').click()
      await expect(world.page.locator('.modal .swatch[aria-label="Saved color #ff8800"]')).toHaveCount(0)
      await world.page.locator('.modal .modal-foot .primary-button').click()

      // deleting the palette entry leaves both collections untouched
      await expect(cardA.locator('.folder-scene')).toHaveAttribute('style', /#ff8800/)
      await expect(cardB.locator('.folder-scene')).toHaveAttribute('style', /#ff8800/)
      await expect
        .poll(
          () => {
            if (!fsSync.existsSync(prefsFile)) return false
            const p = JSON.parse(fsSync.readFileSync(prefsFile, 'utf8'))
            return (p.customColors ?? []).length === 0 && p.folderArt?.A === '#ff8800' && p.folderArt?.B === '#ff8800'
          },
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await close(world)
    }
  })

  test('clicking a folder card opens the collection page and back or Escape returns to the shelf', async () => {
    const world = await launch({ 'A/one.md': 'x', 'A/two.md': 'y', 'B/b.md': 'z' })
    try {
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await expect(view.locator('.page-name')).toHaveText('A')
      await expect(view.locator('.page-count')).toContainText('2 files')
      await expect(view.locator('.file-row')).toHaveCount(2)
      await world.page.locator('#searchInput').fill('two')
      await expect(view.locator('.file-row')).toHaveCount(1)
      await expect(view.locator('.file-row', { hasText: 'two.md' })).toBeVisible()
      await world.page.locator('#searchInput').fill('')
      await expect(view.locator('.file-row')).toHaveCount(2)
      await view.locator('.page-back').click()
      await expect(view).toHaveCount(0)
      await expect(world.page.locator('.folder-card')).toHaveCount(2)
      await world.page.locator('[data-folder="B"] .folder-scene').click()
      await expect(world.page.locator('.collection-page .page-name')).toHaveText('B')
      await world.page.keyboard.press('Escape')
      await expect(world.page.locator('.collection-page')).toHaveCount(0)
      await expect(world.page.locator('.folder-card')).toHaveCount(2)
    } finally {
      await close(world)
    }
  })

  test('deleting from the live preview moves the file to the Recycle Bin and closes the preview', async () => {
    const world = await launch({ 'A/doomed.md': 'delete me from the preview' })
    try {
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await view.locator('.file-row', { hasText: 'doomed.md' }).click()
      const preview = world.page.locator('.preview-modal')
      await expect(preview).toBeVisible()
      await preview.locator('.danger-button', { hasText: 'Delete' }).click()
      const confirm = world.page.locator('.modal', { hasText: 'Delete document?' })
      await expect(confirm).toBeVisible()
      await confirm.locator('.modal-foot .primary-button').click()
      await expect(preview).toBeHidden()
      await expect(view.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
      expect(fsSync.existsSync(path.join(world.root, 'A', 'doomed.md'))).toBe(false)
    } finally {
      await close(world)
    }
  })

  test('manage backups lists, creates, and deletes backups', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    let backupBase = ''
    try {
      backupBase = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-manage-backup-'))
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      const set = (await world.page.evaluate(
        b => {
          const bridge = (globalThis as unknown as {
            folderdock: { setPrefs: (patch: { backupLocation: string }) => Promise<unknown> }
          }).folderdock
          return bridge.setPrefs({ backupLocation: b })
        },
        backupBase
      )) as { ok: boolean }
      expect(set.ok).toBe(true)
      await settings
        .locator('.settings-row', { hasText: 'Backup' })
        .locator('.secondary-button', { hasText: 'Manage…' })
        .click()
      const manage = world.page.locator('.modal[aria-label="Backups"]')
      await expect(manage).toBeVisible()
      await expect(manage.locator('.helper')).toContainText('No backups yet')
      await manage.locator('.primary-button', { hasText: 'Back up now' }).click()
      await expect(world.page.locator('.toast')).toContainText('Backed up 1 file to')
      await expect(manage.locator('.settings-row', { hasText: 'backup-' })).toHaveCount(1)
      await manage.locator('.primary-button', { hasText: 'Back up now' }).click()
      await expect(manage.locator('.settings-row', { hasText: 'backup-' })).toHaveCount(2, { timeout: 10_000 })
      await manage.locator('.settings-row', { hasText: 'backup-' }).first().locator('.danger-button').click()
      const confirm = world.page.locator('.modal', { hasText: 'Delete backup?' })
      await expect(confirm).toBeVisible()
      await confirm.locator('.modal-foot .primary-button').click()
      await expect(world.page.locator('.modal[aria-label="Backups"]')).toBeVisible()
      await expect(
        world.page.locator('.modal[aria-label="Backups"] .settings-row', { hasText: 'backup-' })
      ).toHaveCount(1, { timeout: 10_000 })
      const base = path.join(backupBase, 'FolderDock')
      expect(await fsp.readdir(base)).toHaveLength(1)
    } finally {
      if (backupBase) await fsp.rm(backupBase, { recursive: true, force: true }).catch(() => undefined)
      await close(world)
    }
  })

  test('font size setting scales the collection page and compact view does not shrink it', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      const rowHeight = () =>
        world.page.evaluate<number>('document.querySelector(".collection-page .file-row").getBoundingClientRect().height')
      const medium = await rowHeight()

      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Compact' }).click()
      await settings.locator('.modal-foot .primary-button').click()
      expect(await rowHeight()).toBeGreaterThanOrEqual(medium)

      const prefsFile = path.join(world.userData, 'ui-prefs.json')
      const pick = async (size: string): Promise<void> => {
        await world.page.locator('.footer [aria-label="Open settings"]').click()
        await expect(settings).toBeVisible()
        await settings.locator('.theme-choice', { hasText: size }).click()
        await settings.locator('.modal-foot .primary-button').click()
        await expect
          .poll(
            () =>
              fsSync.existsSync(prefsFile) &&
              fsSync.readFileSync(prefsFile, 'utf8').includes(`"fontSize": "${size.toLowerCase()}"`),
            { timeout: 5000 }
          )
          .toBe(true)
      }

      await pick('Large')
      expect(await rowHeight()).toBeGreaterThan(medium)
      await pick('Small')
      expect(await rowHeight()).toBeLessThan(medium)
      await pick('Medium')
      expect(Math.abs((await rowHeight()) - medium)).toBeLessThanOrEqual(1)
    } finally {
      await close(world)
    }
  })

  test('moves a file out of the library to a chosen destination', async () => {
    const world = await launch({ 'A/bounce.md': 'move me out' })
    let dest = ''
    try {
      dest = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-moveout-'))
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await expect(view.locator('.file-row', { hasText: 'bounce.md' })).toBeVisible()
      const r = (await world.page.evaluate(
        ([rel, target]) => {
          const b = (
            globalThis as unknown as {
              folderdock: { moveFileOut: (rp: string, destination: string) => Promise<unknown> }
            }
          ).folderdock
          return b.moveFileOut(String(rel), String(target))
        },
        ['A/bounce.md', dest]
      )) as { ok: boolean; data: { result: { mode: string; sourceKept: boolean; name: string; destination: string } } }
      expect(r.ok).toBe(true)
      expect(r.data.result.mode).toBe('rename')
      expect(r.data.result.sourceKept).toBe(false)
      expect(fsSync.existsSync(path.join(world.root, 'A', 'bounce.md'))).toBe(false)
      expect(fsSync.readFileSync(path.join(dest, 'bounce.md'), 'utf8')).toBe('move me out')
      await expect(view.locator('.file-row', { hasText: 'bounce.md' })).toHaveCount(0)
    } finally {
      if (dest) await fsp.rm(dest, { recursive: true, force: true }).catch(() => undefined)
      await close(world)
    }
  })

  test('skips importing a byte-identical copy of a file already in the collection', async () => {
    const world = await launch({ 'A/keep.md': 'identical bytes' })
    try {
      const src = path.join(world.userData, 'from-desktop.md')
      await fsp.writeFile(src, 'identical bytes', 'utf8')
      const r = (await world.page.evaluate(
        p => {
          const b = (globalThis as unknown as { folderdock: { dropFiles: (ps: string[], t: string) => Promise<unknown> } })
            .folderdock
          return b.dropFiles([p], 'A')
        },
        src
      )) as { ok: boolean; data: { moved: unknown[]; imported: unknown[]; skipped: { name: string; reason: string }[] } }
      expect(r.ok).toBe(true)
      expect(r.data.moved).toHaveLength(0)
      expect(r.data.imported).toHaveLength(0)
      expect(r.data.skipped).toHaveLength(1)
      expect(r.data.skipped[0]?.reason).toContain('identical content')
      expect(fsSync.existsSync(src)).toBe(true)
      expect(fsSync.readdirSync(path.join(world.root, 'A'))).toEqual(['keep.md'])
    } finally {
      await close(world)
    }
  })

  test('dedupe is scoped to the target collection: identical content in another collection still imports', async () => {
    const world = await launch({ 'A/keep.md': 'twin content', 'B/filler.md': 'x' })
    try {
      const src = path.join(world.userData, 'twin.md')
      await fsp.writeFile(src, 'twin content', 'utf8')
      const r = (await world.page.evaluate(
        p => {
          const b = (globalThis as unknown as { folderdock: { dropFiles: (ps: string[], t: string) => Promise<unknown> } })
            .folderdock
          return b.dropFiles([p], 'B')
        },
        src
      )) as { ok: boolean; data: { moved: unknown[]; skipped: unknown[] } }
      expect(r.ok).toBe(true)
      expect(r.data.moved).toHaveLength(1)
      expect(r.data.skipped).toHaveLength(0)
      expect(fsSync.existsSync(src)).toBe(false)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'twin.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'A', 'keep.md'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('an internal file drag dropped onto another collection moves the file there', async () => {
    const world = await launch({ 'A/one.md': 'x', 'B/keep.md': 'y' })
    try {
      const src = world.page.locator('[data-folder="A"] .sheet[data-file="A/one.md"]')
      await expect(src).toBeVisible()
      await runInternalScriptDrag(world.page, '[data-folder="A"] .sheet[data-file="A/one.md"]', '[data-folder="B"]', {
        dragover: true,
        drop: true,
        dragend: true
      })
      await expect.poll(() => fsSync.existsSync(path.join(world.root, 'A', 'one.md')), { timeout: 10_000 }).toBe(false)
      expect(fsSync.readFileSync(path.join(world.root, 'B', 'one.md'), 'utf8')).toBe('x')
      await expect(world.page.locator('.toast')).toContainText('1 file moved into B')
      // the drop was consumed internally: a later dragend must not move or delete anything.
      // (synthetic dragend always reports effect 'none' — accepted-effect handling is unit-tested)
      await world.page.waitForTimeout(2000)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'one.md'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('an internal file drag dropped back onto its own collection changes nothing', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      await world.page.locator('[data-folder="A"] .folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await expect(view.locator('.file-row[data-file="A/one.md"]')).toBeVisible()
      await runInternalScriptDrag(world.page, '.collection-page .file-row[data-file="A/one.md"]', '.dropzone', {
        dragover: true,
        drop: true,
        dragend: true
      })
      await expect(world.page.locator('.toast')).toContainText('Already in this collection.')
      expect(fsSync.existsSync(path.join(world.root, 'A', 'one.md'))).toBe(true)
      await expect(view.locator('.file-row[data-file="A/one.md"]')).toBeVisible()
    } finally {
      await close(world)
    }
  })

  test('a cancelled drag out of the window keeps the library file', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      await expect(world.page.locator('[data-folder="A"] .sheet[data-file="A/one.md"]')).toBeVisible()
      // no drop — the dragend falls through the rejected-effect guard, the settle timer never fires
      // (synthetic dragend always reports effect 'none'; accepted effects are unit-tested in dragOut.test.ts)
      await runInternalScriptDrag(world.page, '[data-folder="A"] .sheet[data-file="A/one.md"]', null, { dragend: true })
      await world.page.waitForTimeout(2000)
      await expect(world.page.locator('.toast')).toHaveCount(0)
      await expect(world.page.locator('[data-folder="A"] .sheet[data-file="A/one.md"]')).toBeVisible()
      expect(fsSync.existsSync(path.join(world.root, 'A', 'one.md'))).toBe(true)
    } finally {
      await close(world)
    }
  })

  test('settings updates card is minimal and updates run behind the scenes', async () => {
    const world = await launch({ 'A/one.md': 'x' })
    try {
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await expect(settings.locator('.settings-label', { hasText: 'Updates' })).toBeVisible()
      // no permanent explainer text and no automatic-checks toggle: the row is just a label and a button
      await expect(settings.locator('[role="switch"][aria-label="Automatic update checks"]')).toHaveCount(0)
      await expect(settings.locator('.settings-sub', { hasText: 'Development build' })).toHaveCount(0)
      await expect(settings.locator('.primary-button', { hasText: 'Restart & update' })).toHaveCount(0)
      // failures surface as a small red marker, never as raw error text in the row
      await expect(settings.locator('.update-error')).toHaveCount(0)
      await settings.locator('button', { hasText: 'Check for updates' }).click()
      await expect(world.page.locator('.toast')).toHaveCount(0)
      await expect(settings.locator('.primary-button', { hasText: 'Restart & update' })).toHaveCount(0)
    } finally {
      await close(world)
    }
  })

  test('hover summaries stay off by default until enabled in settings', async () => {
    const world = await launch({ 'A/note.md': '# Quiet\n\nThe shelf stays silent.' })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const view = world.page.locator('.collection-page')
      await expect(view).toBeVisible()
      await view.locator('.file-row', { hasText: 'note.md' }).hover()
      await world.page.waitForTimeout(600)
      await expect(world.page.locator('.file-summary')).toHaveCount(0)
      // opening the preview on click still works with tooltips off
      await view.locator('.file-row', { hasText: 'note.md' }).click()
      await expect(world.page.locator('.preview-modal')).toBeVisible()
    } finally {
      await close(world)
    }
  })
})
