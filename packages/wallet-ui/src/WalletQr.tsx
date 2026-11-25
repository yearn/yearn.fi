'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export function WalletQr({ uri, icon }: { uri: string; icon?: ReactNode }) {
  const { data, isError } = useQuery({
    queryKey: ['wallet-qr', uri],
    queryFn: async () => {
      const { default: encodeQR } = await import('qr')
      // A small center logo needs extra correction and a four-module quiet zone.
      const svg = encodeQR(uri, 'svg', { ecc: 'high', border: 4 }).replace(
        '<svg ',
        '<svg shape-rendering="crispEdges" '
      )
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false
  })

  return data ? (
    <div className="relative mx-auto aspect-square w-72 max-w-full">
      <img src={data} alt="WalletConnect QR code" width={288} height={288} className="size-full rounded-xl bg-white" />
      {icon && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-1 text-primary [&>img]:size-full [&>svg]:size-7"
        >
          {icon}
        </span>
      )}
    </div>
  ) : (
    <p role="status" className="py-8 text-center text-sm text-text-secondary">
      {isError ? 'The QR code could not be displayed. Copy the connection link instead.' : 'Preparing QR code…'}
    </p>
  )
}
