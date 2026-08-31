export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'cleanshelf.theme'

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // التخزين المحلي قد يكون معطّلًا — نعود للوضع الافتراضي
  }
  return 'system'
}

/** يطبّق السمة على عنصر الجذر؛ "system" تزيل السمة ليعمل prefers-color-scheme. */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // تجاهل — التبديل يبقى فعّالًا لهذه الجلسة
  }
}

export function nextTheme(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light'
  if (current === 'light') return 'dark'
  return 'system'
}

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: '🖥️ حسب النظام',
  light: '☀️ فاتح',
  dark: '🌙 داكن'
}
