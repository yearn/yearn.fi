import { WidgetPlayground } from '@erc4626/components/WidgetPlayground'

export default async function DemoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <div data-demo-style="main" className="flex min-h-screen flex-col">
      <WidgetPlayground
        initialChain={typeof params.chain === 'string' ? params.chain : undefined}
        initialAddress={typeof params.vault === 'string' ? params.vault : undefined}
      />
    </div>
  )
}
