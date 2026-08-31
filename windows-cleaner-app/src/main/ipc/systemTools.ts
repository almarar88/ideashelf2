import { ipcMain } from 'electron'
import type {
  ProcessEntry,
  ServiceEntry,
  NetworkAdapter,
  NetworkConnection,
  PingResult,
  CleanHistoryEntry
} from '../../shared/types'
import { listProcesses, killProcess } from '../lib/processesLib'
import { listServices, controlService } from '../lib/servicesLib'
import { listAdapters, listConnections, pingHost, flushDns } from '../lib/networkLib'
import { readHistory, clearHistory, createRestorePoint } from '../lib/historyLib'

export function registerSystemToolsIpc(): void {
  ipcMain.handle('proc:list', async (): Promise<ProcessEntry[]> => listProcesses())
  ipcMain.handle('proc:kill', async (_event, pid: number) => killProcess(pid))

  ipcMain.handle('svc:list', async (): Promise<ServiceEntry[]> => listServices())
  ipcMain.handle('svc:control', async (_event, name: string, action: 'start' | 'stop' | 'restart') =>
    controlService(name, action)
  )

  ipcMain.handle('net:adapters', async (): Promise<NetworkAdapter[]> => listAdapters())
  ipcMain.handle('net:connections', async (): Promise<NetworkConnection[]> => listConnections())
  ipcMain.handle('net:ping', async (_event, host: string): Promise<PingResult> => pingHost(host))
  ipcMain.handle('net:flushDns', async () => flushDns())

  ipcMain.handle('history:list', async (): Promise<CleanHistoryEntry[]> => readHistory())
  ipcMain.handle('history:clear', async () => clearHistory())
  ipcMain.handle('history:restorePoint', async () => createRestorePoint())
}
