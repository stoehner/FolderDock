import { _electron } from 'playwright-core'
import fsp from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const exe = path.join(projectRoot, 'dist', 'win-unpacked', 'FolderDock.exe')
const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-pack-'))
const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'fd-packu-'))
await fsp.mkdir(path.join(root, 'Notes'), { recursive: true })
await fsp.writeFile(path.join(root, 'Notes', 'Packaged.md'), '# Packaged\n\nWorks from the installer build.', 'utf8')

const app = await _electron.launch({
  executablePath: exe,
  args: [],
  env: { ...process.env, FOLDERDOCK_ROOT: root, FOLDERDOCK_USER_DATA: userData, FOLDERDOCK_SOFTWARE_GPU: '1' }
})
const page = await app.firstWindow()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 500)))
await page.waitForSelector('.folder-card', { timeout: 20000 })
console.log('packaged app OK — folder cards:', await page.locator('.folder-card').count())
await page.click('[data-folder="Notes"] .folder-scene')
await page.click('.file-row', { hasText: 'Packaged.md' })
  await page.waitForSelector('.preview-modal')
await page.waitForTimeout(600)
  const body = await page.locator('.preview-modal .preview-body').innerText()
console.log('preview content:', body.replace(/\s+/g, ' ').slice(0, 80))
await page.screenshot({ path: path.join(projectRoot, 'desktop-capture', '07-packaged.png') })
await app.close()
await fsp.rm(root, { recursive: true, force: true }).catch(() => undefined)
await fsp.rm(userData, { recursive: true, force: true }).catch(() => undefined)
console.log('packaged smoke test passed')
void fsSync
