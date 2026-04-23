import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  archiveAllocationHistoryArtifactSchema,
  type TArchiveAllocationHistoryArtifact
} from '../../../src/components/shared/utils/schemas/archiveAllocationHistorySchema'

const ARCHIVE_ALLOCATION_HISTORY_DIR = join(process.cwd(), 'scratch', 'archive-allocation-history')

export function getArchiveAllocationHistoryArtifactPath(chainId: number, vaultAddress: `0x${string}`): string {
  return join(ARCHIVE_ALLOCATION_HISTORY_DIR, `${chainId}-${vaultAddress.toLowerCase()}.json`)
}

export async function readLocalArchiveAllocationHistoryArtifact(params: {
  chainId: number
  vaultAddress: `0x${string}`
}): Promise<TArchiveAllocationHistoryArtifact | null> {
  const artifactPath = getArchiveAllocationHistoryArtifactPath(params.chainId, params.vaultAddress)

  try {
    const artifactContent = await readFile(artifactPath, 'utf8')
    const parsedArtifact = archiveAllocationHistoryArtifactSchema.safeParse(JSON.parse(artifactContent))

    if (!parsedArtifact.success) {
      throw new Error(
        `Invalid archive allocation history artifact: ${parsedArtifact.error.issues[0]?.message ?? 'unknown'}`
      )
    }

    return parsedArtifact.data
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

export async function writeLocalArchiveAllocationHistoryArtifact(
  artifact: TArchiveAllocationHistoryArtifact
): Promise<string> {
  const artifactPath = getArchiveAllocationHistoryArtifactPath(artifact.chainId, artifact.vaultAddress)
  await mkdir(dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  return artifactPath
}
