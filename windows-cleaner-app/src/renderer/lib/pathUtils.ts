export function basename(fullPath: string): string {
  const parts = fullPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || fullPath
}
