import type { ServiceEntry } from '../../shared/types'
import { runPowerShell, runPowerShellJson, psQuote } from './powershell'
import { isWindows } from './platform'

interface RawService {
  Name: string
  DisplayName: string
  Status: string | number
  StartType: string | number
}

// Get-Service يعيد التعدادات كأرقام أحيانًا، فنحوّلها لنص مفهوم
const STATUS_LABEL: Record<string, ServiceEntry['status']> = {
  '1': 'stopped',
  '4': 'running',
  '7': 'paused',
  Stopped: 'stopped',
  Running: 'running',
  Paused: 'paused'
}

const START_TYPE_LABEL: Record<string, ServiceEntry['startType']> = {
  '0': 'boot',
  '1': 'system',
  '2': 'automatic',
  '3': 'manual',
  '4': 'disabled',
  Boot: 'boot',
  System: 'system',
  Automatic: 'automatic',
  Manual: 'manual',
  Disabled: 'disabled'
}

export async function listServices(): Promise<ServiceEntry[]> {
  if (!isWindows) return []

  const script = `
    Get-Service | Select-Object Name, DisplayName, Status, StartType |
      ConvertTo-Json -Compress -Depth 2
  `
  const raw = await runPowerShellJson<RawService[] | RawService>(script, 45_000)
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []

  return arr
    .map((s) => ({
      name: s.Name,
      displayName: s.DisplayName || s.Name,
      status: STATUS_LABEL[String(s.Status)] ?? 'unknown',
      startType: START_TYPE_LABEL[String(s.StartType)] ?? 'unknown'
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'))
}

export async function controlService(
  name: string,
  action: 'start' | 'stop' | 'restart'
): Promise<{ success: boolean; message: string }> {
  const cmd =
    action === 'start' ? 'Start-Service' : action === 'stop' ? 'Stop-Service' : 'Restart-Service'
  try {
    await runPowerShell(`${cmd} -Name ${psQuote(name)} -ErrorAction Stop`, 60_000)
    return { success: true, message: 'تم تنفيذ الأمر' }
  } catch (err) {
    const message = (err as Error).message
    return {
      success: false,
      message: /access is denied|PermissionDenied|رُفض/i.test(message)
        ? 'رُفض الوصول — التحكم بخدمات النظام يتطلب تشغيل التطبيق كمسؤول'
        : message.trim().split('\n')[0]
    }
  }
}
