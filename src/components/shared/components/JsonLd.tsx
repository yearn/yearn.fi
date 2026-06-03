import type { ReactElement } from 'react'

type TJsonLdProps = {
  schema: Record<string, unknown>
}

export function JsonLd({ schema }: TJsonLdProps): ReactElement {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data — values are typed, not user input
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>')
      }}
    />
  )
}
