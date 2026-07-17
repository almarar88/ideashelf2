import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { registerCleanerIpc } from './ipc/cleaner'
import { registerUninstallerIpc } from './ipc/uninstaller'
import { registerFileManagerIpc } from './ipc/fileManager'
import { registerTagEditorIpc } from './ipc/tagEditor'
import { registerStartupIpc } from './ipc/startup'
import { registerSystemInfoIpc } from './ipc/systemInfo'
import { registerDialogIpc } from './ipc/dialogs'

const isDev = !app.isPackaged

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'CleanShelf',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerCleanerIpc()
  registerUninstallerIpc()
  registerFileManagerIpc()
  registerTagEditorIpc()
  registerStartupIpc()
  registerSystemInfoIpc()
  registerDialogIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
