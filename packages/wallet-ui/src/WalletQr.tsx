'use client'

import { useQuery } from '@tanstack/react-query'

export function WalletQr({ uri }: { uri: string }) {
  const { data, isError } = useQuery({
    queryKey: ['wallet-qr', uri],
    queryFn: async () => {
      const { default: encodeQR } = await import('qr')
      return `data:image/svg+xml,${encodeURIComponent(encodeQR(uri, 'svg'))}`
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false
  })

  return data ? (
    <img
      src={data}
      alt="WalletConnect QR code"
      width={256}
      height={256}
      className="mx-auto size-64 max-w-full rounded-lg bg-white"
    />
  ) : (
    <p role="status" className="py-8 text-center text-sm text-text-secondary">
      {isError ? 'The QR code could not be displayed. Copy the connection link instead.' : 'Preparing QR code…'}
    </p>
  )
}
