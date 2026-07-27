import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'yearn-vault-widget-artifact-'))

function getFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? getFiles(path) : [path]
  })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', temporaryRoot], {
    cwd: packageRoot,
    encoding: 'utf8'
  })
  const [packResult] = JSON.parse(packOutput)
  assert(packResult?.filename, 'npm pack did not produce a tarball')

  const tarball = join(temporaryRoot, packResult.filename)
  const extractedRoot = join(temporaryRoot, 'extracted')
  mkdirSync(extractedRoot)
  execFileSync('tar', ['-xzf', tarball, '-C', extractedRoot])

  const packedPackageRoot = join(extractedRoot, 'package')
  const manifest = JSON.parse(readFileSync(join(packedPackageRoot, 'package.json'), 'utf8'))
  const requiredPeers = ['@tanstack/react-query', 'react', 'react-dom', 'viem', 'wagmi']
  assert(
    !manifest.dependencies || Object.keys(manifest.dependencies).length === 0,
    'Runtime peers were bundled as dependencies'
  )
  for (const peer of requiredPeers) {
    assert(manifest.peerDependencies?.[peer], `Missing peer dependency: ${peer}`)
  }

  for (const [entry, conditions] of Object.entries(manifest.exports)) {
    if (typeof conditions === 'string') {
      assert(existsSync(join(packedPackageRoot, conditions)), `Missing export ${entry}: ${conditions}`)
      continue
    }
    for (const target of Object.values(conditions)) {
      assert(existsSync(join(packedPackageRoot, target)), `Missing export ${entry}: ${target}`)
    }
  }

  const forbiddenImport =
    /(?:from\s+|import\s*\(\s*)['"](?:@\/|@pages\/|@shared\/|next(?:\/|['"])|@rainbow-me\/|tailwindcss)/
  for (const file of getFiles(join(packedPackageRoot, 'dist')).filter((path) => path.endsWith('.js'))) {
    assert(!forbiddenImport.test(readFileSync(file, 'utf8')), `Repository or framework import leaked into ${file}`)
  }

  const consumerRoot = join(temporaryRoot, 'consumer')
  mkdirSync(consumerRoot)
  writeFileSync(
    join(consumerRoot, 'package.json'),
    JSON.stringify({ name: 'vault-widget-artifact-consumer', private: true, type: 'module' })
  )
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarball,
      '@tanstack/react-query@5.90.21',
      'react@19.2.6',
      'react-dom@19.2.6',
      'viem@2.46.1',
      'wagmi@2.18.2'
    ],
    { cwd: consumerRoot, stdio: 'pipe' }
  )

  const verifyModule = join(consumerRoot, 'verify.mjs')
  writeFileSync(
    verifyModule,
    `
      import { existsSync } from 'node:fs'
      import { fileURLToPath } from 'node:url'
      import { VAULT_WIDGET_VERSION, VaultWidget, createYBoldPreset } from '@yearn/vault-widget'
      import { buildTransactionPlan } from '@yearn/vault-widget/headless'
      import { createBrowserActivityStore } from '@yearn/vault-widget/services'
      import { createEnsoRouteHandler } from '@yearn/vault-widget/server'

      const stylesPath = fileURLToPath(import.meta.resolve('@yearn/vault-widget/styles.css'))
      if (typeof VaultWidget !== 'function') throw new Error('Main component export is unavailable')
      if (VAULT_WIDGET_VERSION !== ${JSON.stringify(manifest.version)}) {
        throw new Error('Package version export does not match the manifest')
      }
      if (typeof createYBoldPreset !== 'function') throw new Error('Preset export is unavailable')
      if (typeof buildTransactionPlan !== 'function') throw new Error('Headless export is unavailable')
      if (typeof createBrowserActivityStore !== 'function') throw new Error('Service export is unavailable')
      if (typeof createEnsoRouteHandler !== 'function') throw new Error('Server export is unavailable')
      if (!existsSync(stylesPath)) throw new Error('Styles export is unavailable')
    `
  )
  execFileSync(process.execPath, [verifyModule], { cwd: consumerRoot, stdio: 'pipe' })

  console.log(`Verified ${manifest.name}@${manifest.version} as an isolated ESM consumer`)
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
