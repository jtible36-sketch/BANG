import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { closeDb, getDb } from './db'
import { attachDevHarness } from './devharness'
import { resumeJobs } from './generation'
import { registerIpc } from './ipc'
import { handleStudioProtocol, registerSchemes } from './protocol'
import { warmUpEncryption } from './secrets'
import { shutdownCodexProcesses } from './providers/codex'
import { getSettings } from './settings'
import { ensureFlowRuntime, shutdownFlowRuntime } from './flow-runtime'

/**
 * Naraflow retains the Bang Story data directory so existing projects, saved settings, and media
 * stay available. Only the older Studio Cerita directory is migrated, as in previous releases.
 */
function useDataFolder(): void {
  if (!app.isPackaged && process.env.STUDIO_USER_DATA) return app.setPath('userData', process.env.STUDIO_USER_DATA)
  const appData = app.getPath('appData')
  const current = join(appData, 'Bang Story')
  const legacy = join(appData, 'Studio Cerita')
  if (!existsSync(current) && existsSync(join(legacy, 'studio.db'))) {
    try {
      renameSync(legacy, current)
    } catch {
      return app.setPath('userData', legacy)
    }
  }
  app.setPath('userData', current)
}

import { startNaraflowMcp, stopNaraflowMcp } from './naraflow-mcp'

useDataFolder()
app.setName('Naraflow')

registerSchemes()

function showWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createWindow(): void {
  const theme = getSettings().theme
  const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: dark ? '#16181c' : '#faf7f2',
    autoHideMenuBar: true,
    title: 'Naraflow',
    icon: join(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), 'branding', 'naraflow.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => showWindow(win))
  // A background/hidden launch must not leave an invisible single-instance lock.
  // did-finish-load also covers startup paths where ready-to-show is delayed.
  win.webContents.once('did-finish-load', () => showWindow(win))
  attachDevHarness(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? 'file://')) e.preventDefault()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const single = app.requestSingleInstanceLock()
if (!single) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) showWindow(w)
    else if (app.isReady()) createWindow()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('id.bangtutorial.bangstory')
    warmUpEncryption()
    getDb()
    handleStudioProtocol()
    registerIpc()
    createWindow()
    void startNaraflowMcp().catch(error => console.error('Naraflow MCP:', error.message))
    resumeJobs()
    if (getSettings().visualWorkflow === 'flow-mcp') void ensureFlowRuntime().catch(() => {})

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showWindow(BrowserWindow.getAllWindows()[0])
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => { void stopNaraflowMcp(); shutdownCodexProcesses(); shutdownFlowRuntime() })
  app.on('will-quit', () => closeDb())
}
