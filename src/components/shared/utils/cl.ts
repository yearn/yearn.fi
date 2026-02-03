/**
 * Joins the given classes into a single string.
 * @example cl('foo', 'bar') // 'foo bar'
 * @example cl('foo', false && 'bar') // 'foo'
 *
 * @param classes the classes to be joined
 * @returns the joined classes
 */
type ClassValue = string | null | undefined | Record<string, boolean | undefined>

export function cl(...classes: ClassValue[]): string {
  const tokens: string[] = []

  for (const entry of classes) {
    if (!entry) {
      continue
    }

    if (typeof entry === 'string') {
      tokens.push(entry)
      continue
    }

    Object.entries(entry).forEach(([className, shouldInclude]) => {
      if (shouldInclude) {
        tokens.push(className)
      }
    })
  }

  return tokens.join(' ')
}
