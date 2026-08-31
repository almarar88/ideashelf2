import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerDialogIpc(): void {
  ipcMain.handle('dialog:pickFolder', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:pickImageFile', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'dialog:confirm',
    async (event, message: string, detail?: string): Promise<boolean> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showMessageBox(win ?? undefined!, {
        type: 'warning',
        buttons: ['إلغاء', 'تأكيد'],
        defaultId: 0,
        cancelId: 0,
        message,
        detail
      })
      return result.response === 1
    }
  )
}
