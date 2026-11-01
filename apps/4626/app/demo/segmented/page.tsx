import { WidgetPlayground } from '@erc4626/components/WidgetPlayground'

export default async function SegmentedDemoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <div data-selector-style="segmented" className="flex min-h-screen flex-col">
      <WidgetPlayground
        headerInsideCard
        initialChain={typeof params.chain === 'string' ? params.chain : undefined}
        initialAddress={typeof params.vault === 'string' ? params.vault : undefined}
      />
    </div>
  )
}
