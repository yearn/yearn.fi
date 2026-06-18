import { describe, expect, it } from 'vitest'
import { serializeJsonLd } from './JsonLd'

describe('serializeJsonLd', () => {
  it('escapes HTML-sensitive characters for inline script context', () => {
    const serialized = serializeJsonLd({
      name: '</script ><script>alert(1)</script>',
      description: 'Tom & Jerry > Mallory',
      separators: '\u2028\u2029'
    })

    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('>')
    expect(serialized).not.toContain('&')
    expect(serialized).toContain('\\u003c/script \\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e')
    expect(serialized).toContain('Tom \\u0026 Jerry \\u003e Mallory')
    expect(serialized).toContain('\\u2028\\u2029')
  })
})
