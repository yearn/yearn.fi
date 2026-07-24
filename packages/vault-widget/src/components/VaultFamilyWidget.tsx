'use client'

import { type ReactElement, useState } from 'react'
import type { VaultFamilyWidgetProps, VaultWidgetVariant } from '../types'
import { VaultWidget } from './VaultWidget'

function VariantIcon({ id }: { id: string }): ReactElement {
  if (id === 'locked') {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" />
      <path d="M10.5 7V5a2.5 2.5 0 0 0-4.6-1.35" fill="none" stroke="currentColor" />
    </svg>
  )
}

function UnavailableVariant({ variant }: { variant: VaultWidgetVariant }): ReactElement {
  return (
    <div className="yv-widget-family__unavailable" role="status">
      <strong>{variant.unavailableMessage ?? `${variant.label} is unavailable.`}</strong>
      {variant.description ? <p>{variant.description}</p> : null}
    </div>
  )
}

export function VaultFamilyWidget({
  family,
  variant: controlledVariant,
  defaultVariant,
  onVariantChange,
  ...widgetProps
}: VaultFamilyWidgetProps): ReactElement {
  const [internalVariant, setInternalVariant] = useState(() => defaultVariant ?? family.defaultVariant)
  const variantId = controlledVariant ?? internalVariant
  const selectedVariant =
    family.variants.find(({ id }) => id === variantId) ??
    family.variants.find(({ id }) => id === family.defaultVariant) ??
    family.variants[0]

  if (!selectedVariant) throw new Error('Vault family has no variants')

  const setVariant = (nextVariant: string): void => {
    if (controlledVariant === undefined) setInternalVariant(nextVariant)
    onVariantChange?.(nextVariant)
  }

  const selector = (
    <fieldset className="yv-widget-family__selector" aria-label="Vault variant">
      {family.variants.map((candidate) => (
        <button
          aria-pressed={candidate.id === selectedVariant.id}
          data-active={candidate.id === selectedVariant.id}
          key={candidate.id}
          onClick={() => setVariant(candidate.id)}
          type="button"
        >
          <VariantIcon id={candidate.id} />
          {candidate.label}
        </button>
      ))}
    </fieldset>
  )

  return (
    <section className="yv-widget-family" aria-label={`${family.name} vault variants`}>
      {selectedVariant.available && selectedVariant.config ? (
        <VaultWidget
          {...widgetProps}
          key={selectedVariant.id}
          chainId={selectedVariant.config.chainId}
          config={selectedVariant.config}
          headerActions={selector}
          vaultAddress={selectedVariant.config.vaultAddress}
        />
      ) : (
        <>
          {selector}
          <UnavailableVariant variant={selectedVariant} />
        </>
      )}
    </section>
  )
}
