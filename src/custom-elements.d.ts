import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type CustomElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'portfolio-activity': CustomElementProps
      'portfolio-content': CustomElementProps
      'portfolio-holdings': CustomElementProps
      'portfolio-layout': CustomElementProps
      'portfolio-overview': CustomElementProps
      'portfolio-page': CustomElementProps
      'portfolio-rewards': CustomElementProps
      'portfolio-suggestions': CustomElementProps
      'portfolio-tabs': CustomElementProps
      'vault-detail-content': CustomElementProps
      'vault-detail-desktop': CustomElementProps
      'vault-detail-header': CustomElementProps
      'vault-detail-mobile': CustomElementProps
      'vault-detail-page': CustomElementProps
      'vault-detail-section': CustomElementProps
      'vault-interaction-widget': CustomElementProps
      'vault-list': CustomElementProps
      'vault-list-body': CustomElementProps
      'vault-list-controls': CustomElementProps
      'vault-list-page': CustomElementProps
      'vault-list-section': CustomElementProps
      'vault-row': CustomElementProps
      'vault-row-metrics': CustomElementProps
      'vault-row-summary': CustomElementProps
      'vaults-compare-bar': CustomElementProps
    }
  }
}
