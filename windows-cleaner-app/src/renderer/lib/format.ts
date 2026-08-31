export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 بايت'
  const units = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت', 'تيرابايت']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const formatted = unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1)
  return `${formatted} ${units[unitIndex]}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
