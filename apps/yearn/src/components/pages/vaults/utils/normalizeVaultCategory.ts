export function normalizeVaultCategory(category?: string | null): string {
  const normalized = String(category ?? '').trim()
  if (!normalized) {
    return ''
  }

  if (normalized.toLowerCase() === 'auto') {
    return 'Volatile'
  }

  return normalized
}
