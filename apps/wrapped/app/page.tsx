import { WrappedApp } from '@wrapped/components/WrappedApp'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <WrappedApp
      address={typeof params.address === 'string' ? params.address : undefined}
      name={typeof params.name === 'string' ? params.name.slice(0, 255) : undefined}
      isDemo={params.demo === '1'}
    />
  )
}
