export const CHANNELS = {
  appInfo: 'app:info',
  scan: 'library:scan',
  searchContent: 'search:content',
  createFolder: 'folder:create',
  renameFolder: 'folder:rename',
  deleteFolder: 'folder:delete',
  readTextFile: 'file:readText',
  writeTextFile: 'file:writeText',
  readBytes: 'file:readBytes',
  excerpt: 'file:excerpt',
  fileMeta: 'file:meta',
  renameFile: 'file:rename',
  moveFile: 'file:move',
  deleteFile: 'file:delete',
  dropFiles: 'files:drop',
  chooseAndImport: 'files:choose',
  revealFile: 'file:reveal',
  openFileExternal: 'file:openExternal',
  openRoot: 'root:open',
  chooseRoot: 'root:choose',
  backupLibrary: 'library:backup',
  chooseBackupFolder: 'backup:choose',
  getPrefs: 'prefs:get',
  setPrefs: 'prefs:set',
  createNote: 'file:createNote'
} as const

export const SEND = {
  startDrag: 'drag:start',
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggleMaximize',
  close: 'window:close'
} as const

export const EVENTS = {
  libraryChanged: 'library:changed',
  windowMaximized: 'window:maximized'
} as const
