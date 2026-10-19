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
      await expect(research.locator('.file-row')).toHaveCount(2)
      await expect(research.locator('.file-row', { hasText: 'tape.md' })).toBeVisible()
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
      await notes.locator('.folder-topbtn[title="New note"]').click()
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
      const row = research.locator('.file-row', { hasText: 'old-name.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Rename' }).click()
      await world.page.locator('#renameFileInput').fill('new-name.md')
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(research.locator('.file-row', { hasText: 'new-name.md' })).toBeVisible()
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
      const row = a.locator('.file-row', { hasText: 'doc.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Move to collection' }).click()
      await world.page.locator('.move-option', { hasText: 'B' }).click()
      await expect(a.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
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
      const row = a.locator('.file-row', { hasText: 'gone.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Delete file' }).click()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(a.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
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

  test('hover summary appears after delay and side preview opens on click', async () => {
    const world = await launch({ 'A/note.md': '# Titled\n\nBody text for the summary tooltip.' })
    try {
      const a = world.page.locator('[data-folder="A"]')
      await a.locator('.folder-scene').click()
      const row = a.locator('.file-row', { hasText: 'note.md' })
      await row.hover()
      const tip = world.page.locator('.file-summary')
      await expect(tip).toBeVisible({ timeout: 5000 })
      await expect(tip.locator('.peek-name')).toHaveText('note.md')
      await expect(tip.locator('.peek-body')).toContainText('Body text for the summary tooltip')
      await row.click()
      const side = world.page.locator('.side-preview')
      await expect(side).toBeVisible()
      await expect(side.locator('.side-title')).toHaveText('note.md')
      await expect(side.locator('.markdown-preview')).toContainText('Titled')
      await side.locator('.side-close').click()
      await expect(side).toBeHidden()
      await expect(a.locator('.folder-scene')).toBeVisible()
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
      const scheme = await world.page.evaluate<string>("() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'")
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
      const firstRow = world.page.locator('[data-folder="A"] .file-row').first()
      await expect(firstRow).toContainText('zzz-new.md')
      await world.page.locator('.footer [aria-label="Open settings"]').click()
      const settings = world.page.locator('.modal')
      await expect(settings).toBeVisible()
      await settings.locator('.theme-choice', { hasText: 'Name' }).click()
      await settings.locator('.modal-foot .primary-button').click()
      await expect(settings).toBeHidden()
      await expect(world.page.locator('[data-folder="A"] .file-row').first()).toContainText('aaa-old.md')
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
      await a.locator('.file-row[data-file="A/one.md"]').click({ modifiers: ['Control'] })
      await a.locator('.file-row[data-file="A/two.md"]').click({ modifiers: ['Control'] })
      await expect(world.page.locator('.selection-bar')).toContainText('2 selected')
      await world.page.locator('.selection-bar button', { hasText: 'Move to collection' }).click()
      await world.page.locator('.move-option', { hasText: 'B' }).click()
      await expect(world.page.locator('.selection-bar')).toHaveCount(0, { timeout: 15_000 })
      await expect(a.locator('.file-row')).toHaveCount(1)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'one.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'B', 'two.md'))).toBe(true)
      expect(fsSync.existsSync(path.join(world.root, 'A', 'one.md'))).toBe(false)

      const b = world.page.locator('[data-folder="B"]')
      await b.locator('.folder-scene').click()
      await b.locator('.file-row[data-file="B/one.md"]').click({ modifiers: ['Control'] })
      await b.locator('.file-row[data-file="B/two.md"]').click({ modifiers: ['Control'] })
      await expect(world.page.locator('.selection-bar')).toContainText('2 selected')
      await world.page.locator('.selection-bar button', { hasText: 'Delete' }).click()
      await expect(world.page.locator('.modal', { hasText: 'Delete 2 files?' })).toBeVisible()
      await world.page.locator('.modal-foot .primary-button').click()
      await expect(b.locator('.file-row')).toHaveCount(1, { timeout: 15_000 })
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
      const row = a.locator('.file-row', { hasText: 'quick.md' })
      await row.hover()
      await row.locator('.file-more').click()
      await world.page.locator('.context-menu button', { hasText: 'Delete file' }).click()
      await expect(a.locator('.file-row')).toHaveCount(0, { timeout: 15_000 })
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
      await a.locator('.file-row', { hasText: 'note.md' }).dblclick()
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
      await modal.locator('.swatch').nth(1).click()
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

  test('right-click on a file row opens the file context menu', async () => {
    const world = await launch({ 'A/doc.md': 'x' })
    try {
      const card = world.page.locator('[data-folder="A"]')
      await card.locator('.folder-scene').click()
      await card.locator('.file-row', { hasText: 'doc.md' }).click({ button: 'right' })
      const menu = world.page.locator('.context-menu')
      await expect(menu).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Preview' })).toBeVisible()
      await expect(menu.locator('button', { hasText: 'Rename' })).toBeVisible()
    } finally {
      await close(world)
    }
  })
})
