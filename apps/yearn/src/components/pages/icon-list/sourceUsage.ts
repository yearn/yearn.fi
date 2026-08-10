import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ICON_ENTRIES, normalizePath, PUBLIC_ICON_ASSETS, type TUsageMap } from './data'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css'])
const SOURCE_ROOT = path.join(process.cwd(), 'src')
const ICON_LIST_SOURCE_PREFIX = '/src/components/pages/icon-list/'

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath)
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        return [entryPath]
      }
      return []
    })
  )

  return nestedFiles.flat()
}

function toSourcePath(filePath: string): string {
  return `/${path.relative(process.cwd(), filePath).split(path.sep).join('/')}`
}

async function loadSources(): Promise<Record<string, string>> {
  const files = await collectSourceFiles(SOURCE_ROOT)
  const entries = await Promise.all(
    files.map(async (filePath) => [toSourcePath(filePath), await readFile(filePath, 'utf8')] as const)
  )

  return Object.fromEntries(entries.filter(([sourcePath]) => !sourcePath.startsWith(ICON_LIST_SOURCE_PREFIX)))
}

function findMatches(sources: Record<string, string>, matchers: string[], excludePaths: string[]): string[] {
  const excludedPaths = new Set(excludePaths)

  return Object.entries(sources)
    .filter(([sourcePath]) => !excludedPaths.has(sourcePath))
    .filter(([, content]) => matchers.some((matcher) => content.includes(matcher)))
    .map(([sourcePath]) => normalizePath(sourcePath))
    .sort((a, b) => a.localeCompare(b))
}

export async function buildIconUsageMap(): Promise<TUsageMap> {
  const sources = await loadSources()
  const usageMap: TUsageMap = {}

  ICON_ENTRIES.forEach((icon) => {
    usageMap[`icon:${icon.key}`] = findMatches(
      sources,
      [icon.name, `@shared/icons/${icon.name}`, `icons/${icon.name}`],
      [icon.path]
    )
  })

  PUBLIC_ICON_ASSETS.forEach((asset) => {
    usageMap[`asset:${asset.path}`] = findMatches(sources, [asset.name, asset.src, asset.src.replace(/^\//, '')], [])
  })

  return usageMap
}
