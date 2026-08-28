import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, 'packages', 'vault-widget')
const SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src')
const HEADLESS_ROOT = path.join(SOURCE_ROOT, 'headless')
const APPS_ROOT = path.join(REPOSITORY_ROOT, 'apps')
const SOURCE_EXTENSIONS = new Set(['.cts', '.js', '.jsx', '.mts', '.ts', '.tsx'])

type TImportReference = {
  line: number
  specifier: string
}

type TViolation = TImportReference & {
  file: string
  reason: string
}

const FORBIDDEN_APP_ALIAS_PREFIXES = ['@/', '@shared', '@pages', '@hooks', '@components', '/src'] as const
const FORBIDDEN_HEADLESS_DEPENDENCY_PREFIXES = [
  '@rainbow-me/rainbowkit',
  '@tanstack/react-query',
  '@wagmi/core',
  'next',
  'react',
  'react-dom',
  'react-rewards',
  'wagmi'
] as const

function toDisplayPath(filePath: string): string {
  return path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join('/')
}

function isInsideDirectory(filePath: string, directory: string): boolean {
  return filePath === directory || filePath.startsWith(`${directory}${path.sep}`)
}

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(entryPath)
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [entryPath]
    return []
  })
}

function readPackageName(packagePath: string): string | undefined {
  if (!fs.existsSync(packagePath)) return undefined

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { name?: unknown }
    return typeof packageJson.name === 'string' && packageJson.name.length > 0 ? packageJson.name : undefined
  } catch {
    return undefined
  }
}

function collectAppPackageNames(): ReadonlySet<string> {
  if (!fs.existsSync(APPS_ROOT)) return new Set()

  return new Set(
    fs
      .readdirSync(APPS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readPackageName(path.join(APPS_ROOT, entry.name, 'package.json')))
      .filter((name): name is string => Boolean(name))
  )
}

function getStringLiteralValue(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined
}

function getNodeModuleSpecifier(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return getStringLiteralValue(node.moduleSpecifier)
  }

  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return getStringLiteralValue(node.argument.literal)
  }

  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return getStringLiteralValue(node.moduleReference.expression)
  }

  if (ts.isCallExpression(node)) {
    const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
    return isDynamicImport || isRequire ? getStringLiteralValue(node.arguments[0]) : undefined
  }

  return undefined
}

function collectImportReferences(sourceFile: ts.SourceFile): TImportReference[] {
  function visit(node: ts.Node): TImportReference[] {
    const specifier = getNodeModuleSpecifier(node)
    const ownReference = specifier
      ? [
          {
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            specifier
          }
        ]
      : []
    const children: ts.Node[] = []
    ts.forEachChild(node, (child) => {
      children.push(child)
    })
    return [...ownReference, ...children.flatMap(visit)]
  }

  return visit(sourceFile)
}

function matchesForbiddenAlias(specifier: string, prefix: (typeof FORBIDDEN_APP_ALIAS_PREFIXES)[number]): boolean {
  if (prefix.endsWith('/')) return specifier.startsWith(prefix)
  return specifier === prefix || specifier.startsWith(`${prefix}/`)
}

function matchesPackageImport(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`)
}

function getViolationReason({
  filePath,
  specifier,
  appPackageNames
}: {
  filePath: string
  specifier: string
  appPackageNames: ReadonlySet<string>
}): string | undefined {
  if (isInsideDirectory(filePath, HEADLESS_ROOT)) {
    const forbiddenDependency = FORBIDDEN_HEADLESS_DEPENDENCY_PREFIXES.find((packageName) =>
      matchesPackageImport(specifier, packageName)
    )
    if (forbiddenDependency) {
      return `imports framework dependency "${forbiddenDependency}" from the headless entrypoint`
    }
  }

  const forbiddenAlias = FORBIDDEN_APP_ALIAS_PREFIXES.find((prefix) => matchesForbiddenAlias(specifier, prefix))
  if (forbiddenAlias) {
    return `uses host-app alias "${forbiddenAlias}"`
  }

  if (
    specifier === 'apps' ||
    specifier === '/apps' ||
    specifier.startsWith('apps/') ||
    specifier.startsWith('/apps/')
  ) {
    return 'imports from the apps directory'
  }

  const appPackageName = [...appPackageNames].find(
    (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`)
  )
  if (appPackageName) {
    return `imports app package "${appPackageName}"`
  }

  if (specifier.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(filePath), specifier)
    if (!isInsideDirectory(resolvedPath, PACKAGE_ROOT)) {
      return `escapes package root to "${toDisplayPath(resolvedPath)}"`
    }
  }

  return undefined
}

function inspectFile(filePath: string, appPackageNames: ReadonlySet<string>): TViolation[] {
  const source = fs.readFileSync(filePath, 'utf8')
  const scriptKind = filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)

  return collectImportReferences(sourceFile).flatMap(({ line, specifier }) => {
    const reason = getViolationReason({ filePath, specifier, appPackageNames })
    return reason ? [{ file: toDisplayPath(filePath), line, reason, specifier }] : []
  })
}

const sourceFiles = collectSourceFiles(SOURCE_ROOT).sort((left, right) => left.localeCompare(right))
const appPackageNames = collectAppPackageNames()
const violations = sourceFiles
  .flatMap((filePath) => inspectFile(filePath, appPackageNames))
  .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)

if (sourceFiles.length === 0) {
  console.error(`Vault widget boundary check failed: no source files found under ${toDisplayPath(SOURCE_ROOT)}.`)
  process.exitCode = 1
} else if (violations.length > 0) {
  console.error('Vault widget boundary check failed.')
  console.error('packages/vault-widget must not depend on a host app or files outside its package boundary.')
  console.error('')
  violations.forEach((violation) => {
    console.error(`${violation.file}:${violation.line} imports "${violation.specifier}": ${violation.reason}`)
  })
  process.exitCode = 1
} else {
  console.log(`Vault widget boundary check passed (${sourceFiles.length} source files scanned).`)
}
