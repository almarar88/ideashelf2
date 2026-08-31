import si from 'systeminformation'
import type { NetworkAdapter, NetworkConnection, PingResult } from '../../shared/types'
import { runPowerShell, psQuote } from './powershell'
import { isWindows } from './platform'

export async function listAdapters(): Promise<NetworkAdapter[]> {
  const [interfaces, stats] = await Promise.all([si.networkInterfaces(), si.networkStats()])
  const list = Array.isArray(interfaces) ? interfaces : [interfaces]
  const statsByIface = new Map(stats.map((s) => [s.iface, s]))

  return list
    .filter((i) => !i.internal)
    .map((i) => {
      const s = statsByIface.get(i.iface)
      return {
        name: i.ifaceName || i.iface,
        type: i.type || '',
        ip4: i.ip4 || '',
        ip6: i.ip6 || '',
        mac: i.mac || '',
        speedMbps: i.speed ?? 0,
        isUp: i.operstate === 'up',
        rxBytes: s?.rx_bytes ?? 0,
        txBytes: s?.tx_bytes ?? 0
      }
    })
}

export async function listConnections(): Promise<NetworkConnection[]> {
  const connections = await si.networkConnections()
  return connections
    .filter((c) => c.state === 'ESTABLISHED' || c.state === 'LISTEN')
    .map((c) => ({
      protocol: c.protocol || '',
      localAddress: `${c.localAddress}:${c.localPort}`,
      remoteAddress: c.peerAddress ? `${c.peerAddress}:${c.peerPort}` : '',
      state: c.state || '',
      pid: Number(c.pid) || 0,
      processName: c.process || ''
    }))
    .sort((a, b) => a.processName.localeCompare(b.processName))
}

/** اختبار اتصال بسيط. المضيف يُمرَّر مقتبسًا لتفادي حقن أوامر PowerShell. */
export async function pingHost(host: string): Promise<PingResult> {
  const target = host.trim()
  if (!target || /[\s;|&`$]/.test(target)) {
    return { host, success: false, averageMs: 0, message: 'اسم مضيف غير صالح' }
  }

  if (!isWindows) {
    return { host: target, success: false, averageMs: 0, message: 'الاختبار متاح على ويندوز فقط' }
  }

  try {
    const out = await runPowerShell(
      `$r = Test-Connection -ComputerName ${psQuote(target)} -Count 4 -ErrorAction Stop;` +
        `($r | Measure-Object -Property ResponseTime -Average).Average`,
      30_000
    )
    const average = Number(out.trim())
    return {
      host: target,
      success: true,
      averageMs: Number.isFinite(average) ? Math.round(average) : 0,
      message: 'نجح الاتصال'
    }
  } catch (err) {
    return {
      host: target,
      success: false,
      averageMs: 0,
      message: (err as Error).message.trim().split('\n')[0] || 'تعذّر الوصول إلى المضيف'
    }
  }
}

export async function flushDns(): Promise<{ success: boolean; message: string }> {
  if (!isWindows) return { success: false, message: 'متاح على ويندوز فقط' }
  try {
    await runPowerShell('ipconfig /flushdns | Out-Null', 20_000)
    return { success: true, message: 'تم مسح ذاكرة DNS المؤقتة' }
  } catch (err) {
    return { success: false, message: (err as Error).message.trim().split('\n')[0] }
  }
}
