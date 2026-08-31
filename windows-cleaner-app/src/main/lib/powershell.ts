import { execFile } from 'node:child_process'

const UTF8_PREAMBLE = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;'

/**
 * ينفّذ سكربت PowerShell ويعيد stdout كنص UTF-8.
 * نجبر ترميز الخرج على UTF-8 داخل السكربت نفسه لأن الترميز الافتراضي
 * لطرفية PowerShell على ويندوز يفسد النصوص العربية/الرموز.
 */
export function runPowerShell(script: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_PREAMBLE + script],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.toString() || error.message))
          return
        }
        resolve(stdout.toString())
      }
    )
  })
}

export async function runPowerShellJson<T>(script: string, timeoutMs = 30_000): Promise<T> {
  const out = await runPowerShell(script, timeoutMs)
  const trimmed = out.trim()
  if (!trimmed) return [] as unknown as T
  try {
    return JSON.parse(trimmed) as T
  } catch {
    throw new Error('تعذّر تحليل نتيجة PowerShell: ' + trimmed.slice(0, 500))
  }
}

/** يهرب نصًا ليكون آمنًا كسلسلة نصية داخل أمر PowerShell (بين علامتي اقتباس مفردة). */
export function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
