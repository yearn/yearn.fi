import fs from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'

const PROJECT_ROOT = process.cwd()
const SOURCE_ROOTS = ['app', 'src', 'pages']
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const SERVER_ONLY_ROOTS = ['src/server', 'app/api'].map((root) => path.join(PROJECT_ROOT, root))

type TImportEdge = {
  importer: string
  specifier: string
  resolvedPath: string
}

type TViolation = {
  clientRoot: string
  serverPath: string
  importSpecifier: string
  chain: string[]
}

const aliasPrefixes = [
  ['@/', 'src/'],
  ['@shared/', 'src/components/shared/'],
  ['@pages/', 'src/components/pages/'],
  ['@components/', 'src/components/'],
  ['@hooks/', 'src/hooks/'],
  ['/src/', 'src/'],
  ['src/', 'src/']
] as const

function toDisplayPath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/')
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))
}

function isServerOnlyPath(filePath: string): boolean {
  return SERVER_ONLY_ROOTS.some((root) => filePath === root || filePath.startsWith(`${root}${path.sep}`))
}

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath)
    }
    if (entry.isFile() && isSourceFile(entryPath)) {
      return [entryPath]
    }
    return []
  })
}

function resolveCandidate(candidatePath: string): string | undefined {
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile() && isSourceFile(candidatePath)) {
    return candidatePath
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const filePath = `${candidatePath}${extension}`
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath
    }
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const filePath = path.join(candidatePath, `index${extension}`)
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath
      }
    }
  }

  return undefined
}

function resolveImport(importer: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) {
    return resolveCandidate(path.resolve(path.dirname(importer), specifier))
  }

  const matchingAlias = aliasPrefixes.find(([prefix]) => specifier.startsWith(prefix))
  if (!matchingAlias) return undefined

  const [prefix, target] = matchingAlias
  return resolveCandidate(path.join(PROJECT_ROOT, target, specifier.slice(prefix.length)))
}

function hasUseClientDirective(sourceFile: ts.SourceFile): boolean {
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      if (statement.expression.text === 'use client') return true
      continue
    }

    return false
  }

  return false
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const importClause = node.importClause
  if (!importClause) return false
  if (importClause.isTypeOnly) return true
  if (importClause.name) return false
  if (!importClause.namedBindings || ts.isNamespaceImport(importClause.namedBindings)) return false

  return importClause.namedBindings.elements.every((element) => element.isTypeOnly)
}

function isTypeOnlyExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true
  if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return false

  return node.exportClause.elements.every((element) => element.isTypeOnly)
}

function collectImports(filePath: string, sourceFile: ts.SourceFile): TImportEdge[] {
  const edges: TImportEdge[] = []

  function addEdge(specifier: string): void {
    const resolvedPath = resolveImport(filePath, specifier)
    if (!resolvedPath) return
    edges.push({ importer: filePath, specifier, resolvedPath })
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnlyImport(node)) {
      addEdge(node.moduleSpecifier.text)
      return
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyExport(node)) {
        addEdge(node.moduleSpecifier.text)
      }
      return
    }

    if (ts.isCallExpression(node)) {
      const firstArgument = node.arguments[0]
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'

      if ((isDynamicImport || isRequire) && firstArgument && ts.isStringLiteral(firstArgument)) {
        addEdge(firstArgument.text)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return edges
}

const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(PROJECT_ROOT, root))).sort((a, b) =>
  a.localeCompare(b)
)

const sourceFileByPath = new Map(
  sourceFiles.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8')
    return [filePath, ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)] as const
  })
)

const importsByPath = new Map(
  Array.from(sourceFileByPath.entries()).map(([filePath, sourceFile]) => [
    filePath,
    collectImports(filePath, sourceFile)
  ])
)

const clientRoots = Array.from(sourceFileByPath.entries())
  .filter(([, sourceFile]) => hasUseClientDirective(sourceFile))
  .map(([filePath]) => filePath)

const violations: TViolation[] = []

function walkClientGraph(clientRoot: string, filePath: string, chain: string[], visited: Set<string>): void {
  if (visited.has(filePath)) return
  visited.add(filePath)

  for (const edge of importsByPath.get(filePath) ?? []) {
    if (isServerOnlyPath(edge.resolvedPath)) {
      violations.push({
        clientRoot,
        serverPath: edge.resolvedPath,
        importSpecifier: edge.specifier,
        chain: [...chain, edge.resolvedPath]
      })
      continue
    }

    if (sourceFileByPath.has(edge.resolvedPath)) {
      walkClientGraph(clientRoot, edge.resolvedPath, [...chain, edge.resolvedPath], visited)
    }
  }
}

for (const clientRoot of clientRoots) {
  walkClientGraph(clientRoot, clientRoot, [clientRoot], new Set())
}

if (violations.length > 0) {
  console.error('Client/server boundary check failed.')
  console.error(
    'A client component import graph reaches server-only code. Move the import behind an API route or a server component.'
  )
  console.error('')

  violations.forEach((violation, index) => {
    console.error(`${index + 1}. ${toDisplayPath(violation.clientRoot)} reaches ${toDisplayPath(violation.serverPath)}`)
    console.error(`   via import "${violation.importSpecifier}"`)
    violation.chain.forEach((filePath, chainIndex) => {
      console.error(`   ${chainIndex === 0 ? 'root' : '->'} ${toDisplayPath(filePath)}`)
    })
    console.error('')
  })

  process.exit(1)
}

console.log(`client/server boundary check passed (${clientRoots.length} client roots scanned)`)
