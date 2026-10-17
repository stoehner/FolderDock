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

  test('theme toggle persists to prefs', async () => {
    const world = await launch()
    try {
      await world.page.locator('.toolbar-round[aria-label="Switch light/dark appearance"]').click()
      await expect(world.page.locator('body.light')).toHaveCount(1)
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
})
