import si from 'systeminformation'
import type { SystemSummary } from '../../shared/types'

export async function getSystemSummary(): Promise<SystemSummary> {
  const [osInfo, cpu, currentLoad, mem, fsSize, time] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time()
  ])

  return {
    osName: osInfo.distro || osInfo.platform,
    osVersion: osInfo.release || '',
    hostname: osInfo.hostname || '',
    cpuModel: [cpu.manufacturer, cpu.brand].filter(Boolean).join(' '),
    cpuLoadPercent: Math.round(currentLoad.currentLoad || 0),
    totalMemBytes: mem.total,
    usedMemBytes: mem.active,
    uptimeSec: time.uptime || 0,
    disks: fsSize.map((d) => ({
      mount: d.mount,
      totalBytes: d.size,
      usedBytes: d.used,
      freeBytes: Math.max(d.size - d.used, 0)
    }))
  }
}
