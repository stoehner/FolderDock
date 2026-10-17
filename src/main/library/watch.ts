import chokidar from 'chokidar'

export function startWatcher(
  root: string,
  onChange: () => void,
  onError: (message: string) => void
): () => void {
  let timer: NodeJS.Timeout | null = null
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, 300)
  }
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    depth: 2,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  })
  watcher.on('add', schedule)
  watcher.on('unlink', schedule)
  watcher.on('addDir', schedule)
  watcher.on('unlinkDir', schedule)
  watcher.on('change', schedule)
  watcher.on('error', err => onError(String(err)))
  return () => {
    if (timer) clearTimeout(timer)
    void watcher.close()
  }
}
