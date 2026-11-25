import { VaultApp } from '@erc4626/components/VaultApp'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <VaultApp
      initialChain={typeof params.chain === 'string' ? params.chain : undefined}
      initialAddress={typeof params.vault === 'string' ? params.vault : undefined}
    />
  )
}
