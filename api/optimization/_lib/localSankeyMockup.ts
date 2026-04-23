import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  sankeyMockupFeedsSchema,
  type TReallocationPanelRecord
} from '../../../src/components/shared/utils/schemas/reallocationPanelsSchema'

const LOCAL_SANKEY_MOCKUP_PATH = join(
  process.cwd(),
  'scratch',
  'archive-allocation-history',
  'sankey-mockup',
  'combined-feed.json'
)

function buildPanelAnnotation(
  annotation: string | null,
  inputSelector: string | undefined,
  changeSource: 'automatic' | 'selector' | undefined
): string | null {
  if (annotation) {
    return annotation
  }

  if (changeSource === 'automatic') {
    return 'Automatic (DOA)'
  }

  return inputSelector ? `Selector ${inputSelector}` : null
}

export async function readLocalSankeyMockupPanels(params: {
  vaultAddress: `0x${string}`
}): Promise<TReallocationPanelRecord[] | null> {
  try {
    const feedContent = await readFile(LOCAL_SANKEY_MOCKUP_PATH, 'utf8')
    const parsedFeeds = sankeyMockupFeedsSchema.safeParse(JSON.parse(feedContent))

    if (!parsedFeeds.success) {
      throw new Error(`Invalid sankey mockup feed: ${parsedFeeds.error.issues[0]?.message ?? 'unknown'}`)
    }

    const feed = parsedFeeds.data.find((item) => item.vaultAddress.toLowerCase() === params.vaultAddress.toLowerCase())
    if (!feed) {
      return null
    }

    return feed.panels.map((panel) => {
      const meta = feed.panelMeta[panel.id]

      return {
        ...panel,
        annotation: buildPanelAnnotation(panel.annotation, meta?.inputSelector, meta?.changeSource),
        annotationTone: meta?.annotationTone ?? null,
        reallocationType: meta ? (meta.changeSource === 'automatic' ? 'automatic' : 'manual') : null,
        inputSelector: meta?.inputSelector ?? null,
        txHash: meta?.txHash ?? null,
        createdBy: meta?.createdBy ?? null,
        to: meta?.to ?? null
      }
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }

    throw error
  }
}
