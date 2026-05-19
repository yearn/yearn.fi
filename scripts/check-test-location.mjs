#!/usr/bin/env bun

const testFilePattern = /(^|\/).+\.(test|spec)\.(ts|tsx|js|jsx)$/
const allowedPatterns = [/^src\/test\//, /^api\//, /^scripts\//, /^e2e\//]

const result = Bun.spawnSync(['git', 'diff', '--cached', '--name-status', '--diff-filter=ACMR'], {
  stdout: 'pipe',
  stderr: 'pipe'
})

if (result.exitCode !== 0) {
  process.stderr.write(result.stderr.toString())
  process.exit(result.exitCode)
}

const stagedFiles = result.stdout
  .toString()
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [, ...paths] = line.split(/\s+/)
    return paths.at(-1) ?? ''
  })

const disallowedTests = stagedFiles.filter(
  (path) =>
    path.startsWith('src/') && testFilePattern.test(path) && !allowedPatterns.some((pattern) => pattern.test(path))
)

if (disallowedTests.length > 0) {
  console.error('husky: colocated frontend/domain tests are not allowed at commit time.')
  console.error('')
  console.error('Move durable tests into src/test/{math,transactions,api-contracts,formatting,vaults},')
  console.error('convert user-visible behavior to e2e/, or delete temporary implementation tests.')
  console.error('')
  console.error('Blocked staged test files:')
  disallowedTests.forEach((path) => {
    console.error(`- ${path}`)
  })
  process.exit(1)
}
