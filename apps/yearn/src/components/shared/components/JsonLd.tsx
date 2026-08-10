import type { ReactElement } from 'react'

type TJsonLdProps = {
  schema: Record<string, unknown>
}

const JSON_LD_ESCAPE_MAP = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
} as const

export function serializeJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(
    /[<>&\u2028\u2029]/g,
    (character) => JSON_LD_ESCAPE_MAP[character as keyof typeof JSON_LD_ESCAPE_MAP]
  )
}

export function JsonLd({ schema }: TJsonLdProps): ReactElement {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is escaped for inline script context
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(schema)
      }}
    />
  )
}
