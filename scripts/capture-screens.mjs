import { _electron } from 'playwright-core'
import fsp from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const outDir = path.join(projectRoot, 'desktop-capture')
await fsp.mkdir(outDir, { recursive: true })
const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-shots-'))
const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-user-'))

await fsp.mkdir(path.join(root, 'Prompts'), { recursive: true })
await fsp.writeFile(
  path.join(root, 'Prompts', 'UI Critique Prompt.md'),
  '# UI Critique Prompt\n\nReview the visual hierarchy, spacing, typography and interaction states.\n\n## Deliverables\n- List three high-impact improvements\n- Preserve the existing controls',
  'utf8'
)
await fsp.writeFile(path.join(root, 'Prompts', 'Copywriting.txt'), 'Write in a focused, clear, professional tone.', 'utf8')
await fsp.writeFile(path.join(root, 'Prompts', 'Handoff.md'), '# Development Handoff\n\nSummarize the selected direction.', 'utf8')
await fsp.mkdir(path.join(root, 'Plugin Development'), { recursive: true })
await fsp.writeFile(
  path.join(root, 'Plugin Development', 'Boom Sauce UI.md'),
  '# Boom Sauce\n\nA modular drum-bus plug-in with seven processing sections.',
  'utf8'
)
await fsp.writeFile(path.join(root, 'Plugin Development', 'DSP Test Checklist.md'), '# DSP Test Checklist\n\n- [ ] Bypass accuracy', 'utf8')

const app = await _electron.launch({
  args: [projectRoot],
  env: { ...process.env, FOLDERDOCK_ROOT: root, FOLDERDOCK_USER_DATA: userData, FOLDERDOCK_SOFTWARE_GPU: '1' }
})
const page = await app.firstWindow()
await page.setViewportSize({ width: 660, height: 890 })
await page.waitForSelector('.folder-card', { timeout: 15000 })
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outDir, '01-dark-shelf.png') })

const prompts = page.locator('[data-folder="Prompts"]')
await prompts.locator('.folder-scene').hover()
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outDir, '02-dark-hover-sheets.png') })

await prompts.locator('.folder-scene').click()
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outDir, '03-dark-open-folder.png') })

await page.locator('.file-row', { hasText: 'UI Critique' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outDir, '04-dark-side-preview.png') })

await page.locator('.side-preview .primary-button', { hasText: 'Edit' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(outDir, '06-editor.png') })

await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

await page.locator('.footer [aria-label="Open settings"]').click()
await page.waitForTimeout(400)
await page.locator('.theme-choice', { hasText: 'Light' }).click()
await page.locator('.modal-foot .primary-button').click()
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(outDir, '05-light-preview.png') })

await page.locator('[data-folder="Prompts"] .folder-scene').click({ button: 'right' })
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(outDir, '08-light-context-menu.png') })

await app.close()
await fsp.rm(root, { recursive: true, force: true }).catch(() => undefined)
await fsp.rm(userData, { recursive: true, force: true }).catch(() => undefined)
console.log('screenshots written to', outDir)
void fsSync
