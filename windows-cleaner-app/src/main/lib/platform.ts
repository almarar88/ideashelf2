import os from 'node:os'

export const isWindows = process.platform === 'win32'

export function assertWindows(feature: string): void {
  if (!isWindows) {
    throw new Error(
      `الميزة "${feature}" تعمل فقط على ويندوز. أنت الآن على ${os.platform()} (وضع تطوير/معاينة).`
    )
  }
}

export function env(name: string): string {
  return process.env[name] ?? ''
}
