import { execFile } from 'node:child_process'
import si from 'systeminformation'
import type { ProcessEntry } from '../../shared/types'
import { isWindows } from './platform'

export async function listProcesses(): Promise<ProcessEntry[]> {
  const data = await si.processes()
  return data.list
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpuPercent: Math.round((p.cpu ?? 0) * 10) / 10,
      memoryBytes: Math.round(p.memRss ?? 0) * 1024,
      user: p.user || '',
      path: p.path || '',
      started: p.started || ''
    }))
    .sort((a, b) => b.memoryBytes - a.memoryBytes)
}

/**
 * ينهي عملية. على ويندوز نستخدم taskkill لأنه يتعامل مع شجرة العمليات
 * والعمليات المحمية بشكل أفضل من process.kill.
 */
export function killProcess(pid: number): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (!Number.isInteger(pid) || pid <= 0) {
      resolve({ success: false, message: 'معرّف عملية غير صالح' })
      return
    }

    if (!isWindows) {
      try {
        process.kill(pid)
        resolve({ success: true, message: 'تم إنهاء العملية' })
      } catch (err) {
        resolve({ success: false, message: (err as Error).message })
      }
      return
    }

    execFile(
      'taskkill',
      ['/PID', String(pid), '/T', '/F'],
      { windowsHide: true, timeout: 15_000 },
      (error, _stdout, stderr) => {
        if (error) {
          const message = stderr?.toString().trim() || error.message
          resolve({
            success: false,
            message: message.includes('Access is denied')
              ? 'رُفض الوصول — تحتاج تشغيل التطبيق كمسؤول لإنهاء هذه العملية'
              : message
          })
          return
        }
        resolve({ success: true, message: 'تم إنهاء العملية' })
      }
    )
  })
}
