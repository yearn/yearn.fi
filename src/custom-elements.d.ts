import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type CustomElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'portfolio-activity': CustomElementProps
      'portfolio-activity-tab': CustomElementProps
      'portfolio-claim-rewards-tab': CustomElementProps
      'portfolio-content': CustomElementProps
      'portfolio-holdings': CustomElementProps
      'portfolio-holdings-table': CustomElementProps
      'portfolio-layout': CustomElementProps
      'portfolio-metric': CustomElementProps
      'portfolio-overview': CustomElementProps
      'portfolio-page': CustomElementProps
      'portfolio-rewards': CustomElementProps
      'portfolio-suggestions': CustomElementProps
      'portfolio-tab': CustomElementProps
      'portfolio-tab-button': CustomElementProps
      'portfolio-tab-list': CustomElementProps
      'portfolio-tabs': CustomElementProps
      'reward-row': CustomElementProps
      'rewards-claim-action': CustomElementProps
      'rewards-open-action': CustomElementProps
      'transaction-state': CustomElementProps
      'transaction-status': CustomElementProps
      'vault-chain-filter': CustomElementProps
      'vault-chain-selector': CustomElementProps
      'vault-compact-stat': CustomElementProps
      'vault-compare-toggle': CustomElementProps
      'vault-detail-content': CustomElementProps
      'vault-detail-desktop': CustomElementProps
      'vault-detail-est-apy': CustomElementProps
      'vault-detail-header': CustomElementProps
      'vault-detail-mobile': CustomElementProps
      'vault-detail-page': CustomElementProps
      'vault-detail-section': CustomElementProps
      'vault-est-apy': CustomElementProps
      'vault-filter-button': CustomElementProps
      'vault-holdings': CustomElementProps
      'vault-interaction-widget': CustomElementProps
      'vault-list': CustomElementProps
      'vault-list-body': CustomElementProps
      'vault-list-controls': CustomElementProps
      'vault-list-page': CustomElementProps
      'vault-list-section': CustomElementProps
      'vault-name': CustomElementProps
      'vault-row': CustomElementProps
      'vault-row-expand': CustomElementProps
      'vault-row-link': CustomElementProps
      'vault-row-metrics': CustomElementProps
      'vault-row-summary': CustomElementProps
      'vault-search-toggle': CustomElementProps
      'vault-sort-control': CustomElementProps
      'vault-submit-action': CustomElementProps
      'vault-rewards': CustomElementProps
      'vault-token-amount-input': CustomElementProps
      'vault-token-selector': CustomElementProps
      'vault-tvl': CustomElementProps
      'vault-widget': CustomElementProps
      'vault-widget-tab': CustomElementProps
      'vault-widget-tabs': CustomElementProps
      'vaults-compare-bar': CustomElementProps
      'wallet-connect-action': CustomElementProps
    }
  }
}
