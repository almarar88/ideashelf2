import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * جسر PowerShell — الطريقة التي يلمس بها المساعد ويندوز فعلًا.
 *
 * لماذا PowerShell لا وحدات Node أصلية؟ الوحدات الأصلية (robotjs وأمثالها)
 * تحتاج ترجمة على ويندوز نفسه بأدوات بناء ثقيلة، وتنكسر مع كل ترقية Electron.
 * PowerShell موجود في كل نسخة ويندوز حديثة، ويصل إلى ‎.NET‎ وWin32 كاملة،
 * فنحصل على قدرة أوسع بلا وحدة أصلية واحدة.
 *
 * الأمان: لا نبني أوامر بلصق نصوص المستخدم داخلها. المعطيات تُمرَّر عبر
 * متغيّرات بيئة، والسكربت يقرأها بـ ‎$env:‎ — فلا يستطيع نصّ مثل
 * ‎"; Remove-Item C:\ -Recurse"‎ أن يتحوّل إلى أمر.
 */

export interface PsResult {
  ok: boolean
  stdout: string
  stderr: string
}

/** ويندوز فقط. على غيره نعيد فشلًا واضحًا بدل أن ننهار. */
export const isWindows = process.platform === 'win32'

const PWSH_CANDIDATES = [
  'powershell.exe',
  'pwsh.exe',
]

let resolvedShell: string | null = null

async function shell(): Promise<string> {
  if (resolvedShell) return resolvedShell
  resolvedShell = PWSH_CANDIDATES[0]
  return resolvedShell
}

/**
 * ينفّذ سكربت PowerShell ويعيد مخرجاته.
 *
 * [vars] تُمرَّر كمتغيّرات بيئة باسم ‎ALC_<KEY>‎ ليقرأها السكربت،
 * وهذا هو ما يمنع حقن الأوامر.
 */
export async function runPs(
  script: string,
  vars: Record<string, string | number | boolean> = {},
  timeoutMs = 25_000,
): Promise<PsResult> {
  if (!isWindows) {
    return { ok: false, stdout: '', stderr: 'هذا الأمر يعمل على ويندوز فقط.' }
  }

  const env: Record<string, string> = { ...process.env } as Record<string, string>
  for (const [key, value] of Object.entries(vars)) {
    env[`ALC_${key.toUpperCase()}`] = String(value)
  }

  // نكتب السكربت في ملف مؤقت: تمريره على سطر الأوامر يصطدم بحدود الطول
  // ويكسر الاقتباس مع النصوص العربية.
  const file = join(tmpdir(), `alcode-${randomUUID()}.ps1`)
  const prelude = [
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '$OutputEncoding = [System.Text.Encoding]::UTF8',
  ].join('\n')

  await fs.writeFile(file, '\ufeff' + prelude + '\n' + script, 'utf8')

  try {
    return await new Promise<PsResult>((resolve) => {
      execFile(
        PWSH_CANDIDATES[0],
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
        { env, timeout: timeoutMs, maxBuffer: 12 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            stdout: (stdout || '').trim(),
            stderr: (stderr || String(error?.message || '')).trim(),
          })
        },
      )
    })
  } finally {
    fs.unlink(file).catch(() => {})
  }
}

/** ينفّذ سكربتًا يُخرج JSON ويعيده كائنًا. */
export async function runPsJson<T>(
  script: string,
  vars: Record<string, string | number | boolean> = {},
  timeoutMs = 25_000,
): Promise<{ ok: boolean; data: T | null; error: string }> {
  const wrapped = `${script}\n`
  const result = await runPs(wrapped, vars, timeoutMs)
  if (!result.ok) return { ok: false, data: null, error: result.stderr }
  if (!result.stdout) return { ok: true, data: null, error: '' }
  try {
    return { ok: true, data: JSON.parse(result.stdout) as T, error: '' }
  } catch {
    return { ok: false, data: null, error: `مخرجات غير متوقّعة: ${result.stdout.slice(0, 200)}` }
  }
}

/** يحوّل قيمة إلى JSON مضغوط — نستعمله في كل سكربت يعيد بيانات. */
export const asJson = '| ConvertTo-Json -Depth 4 -Compress'

export async function shellName(): Promise<string> {
  return shell()
}
