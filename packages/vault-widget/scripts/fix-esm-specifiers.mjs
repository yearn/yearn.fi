import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(packageRoot, 'dist')

function getFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? getFiles(path) : [path]
  })
}

function resolveSpecifier(file, specifier) {
  if (!specifier.startsWith('.') || extname(specifier)) return specifier
  const base = resolve(dirname(file), specifier)
  if (existsSync(`${base}.js`) || existsSync(`${base}.d.ts`)) return `${specifier}.js`
  if (existsSync(join(base, 'index.js')) || existsSync(join(base, 'index.d.ts'))) return `${specifier}/index.js`
  throw new Error(`Unable to resolve ESM specifier "${specifier}" from ${file}`)
}

function rewriteFile(file) {
  const source = readFileSync(file, 'utf8')
  const rewrite = (_match, prefix, specifier, suffix) => `${prefix}${resolveSpecifier(file, specifier)}${suffix}`
  const output = source
    .replace(/(\bfrom\s+['"])(\.[^'"]+)(['"])/g, rewrite)
    .replace(/(\bimport\s*\(\s*['"])(\.[^'"]+)(['"]\s*\))/g, rewrite)
    .replace(/(\bimport\s+['"])(\.[^'"]+)(['"])/g, rewrite)

  if (output !== source) writeFileSync(file, output)
}

for (const file of getFiles(distRoot)) {
  if (file.endsWith('.js') || file.endsWith('.d.ts')) rewriteFile(file)
}
