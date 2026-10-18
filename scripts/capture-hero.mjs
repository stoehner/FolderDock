import { _electron } from 'playwright-core'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const outDir = path.join(projectRoot, 'docs', 'screenshots')
await fsp.mkdir(outDir, { recursive: true })
const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-hero-'))
const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-herou-'))

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

const app = await _electron.launch({
  args: [projectRoot],
  env: { ...process.env, FOLDERDOCK_ROOT: root, FOLDERDOCK_USER_DATA: userData, FOLDERDOCK_SOFTWARE_GPU: '1' }
})
const page = await app.firstWindow()
await page.setViewportSize({ width: 1040, height: 860 })
await page.waitForSelector('.folder-card', { timeout: 15000 })
await page.waitForTimeout(900)
await page.click('[data-folder="Prompts"] .folder-scene')
await page.waitForTimeout(700)
await page.locator('.file-row', { hasText: 'UI Critique' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(outDir, 'side-preview.png') })
await app.close()
await fsp.rm(root, { recursive: true, force: true }).catch(() => undefined)
await fsp.rm(userData, { recursive: true, force: true }).catch(() => undefined)
console.log('hero screenshot written')
