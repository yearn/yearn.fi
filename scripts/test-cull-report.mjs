#!/usr/bin/env bun

const durablePatterns = [
  /vaultApy/i,
  /useVaultApyData/i,
  /valuation/i,
  /yvUsd/i,
  /YvUsdWithdraw\.helpers/i,
  /cooldown/i,
  /kongVaultSelectors/i,
  /useVaultFilterUtils/i,
  /TransactionOverlay/i,
  /curveUrlUtils/i,
  /routes/i,
  /vaultWarnings/i,
  /validation|schema/i,
  /safety|warning/i,
  /slippage/i,
  /^api\//i,
  /redis|rpc|handler/i
]

const lowSignalPatterns = [
  /component/i,
  /card/i,
  /row/i,
  /empty/i,
  /header/i,
  /tooltip/i,
  /toggle/i,
  /copy|label/i,
  /style|sizing|layout/i,
  /config|chains|transports/i,
  /selector|filter/i
]

const testFilePattern = /(^|\/)(e2e\/.+\.spec|.+\.(test|spec))\.(ts|tsx|js|jsx)$/
const args = process.argv.slice(2)

function runGit(args) {
  const result = Bun.spawnSync(['git', ...args], {
    stdout: 'pipe',
    stderr: 'pipe'
  })

  return result.exitCode === 0 ? result.stdout.toString().trim() : ''
}

function changedFilesFrom(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\s+/)
      return { status, path: pathParts.at(-1) ?? '' }
    })
    .filter(({ path }) => testFilePattern.test(path))
}

function uniqueFiles(files) {
  return [...new Map(files.map((file) => [file.path, file])).values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  )
}

function resolveBaseRef() {
  const baseIndex = args.indexOf('--base')
  if (baseIndex >= 0 && args[baseIndex + 1]) {
    return args[baseIndex + 1]
  }

  const configuredBase = process.env.TEST_CULL_BASE
  if (configuredBase) {
    return configuredBase
  }

  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  return upstream || 'origin/release/26-04-17'
}

function getArgValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function buildChangeSet(baseRef) {
  if (args.includes('--all')) {
    return {
      files: runGit(['ls-files'])
        .split('\n')
        .map((path) => path.trim())
        .filter((path) => testFilePattern.test(path))
        .map((path) => ({ status: 'tracked', path })),
      source: 'all tracked tests'
    }
  }

  const commitRef = getArgValue('--commit')
  if (commitRef) {
    return {
      files: changedFilesFrom(runGit(['show', '--name-status', '--format=', commitRef])),
      source: `commit ${commitRef}`
    }
  }

  const range = getArgValue('--range')
  if (range) {
    return {
      files: changedFilesFrom(runGit(['diff', '--name-status', range])),
      source: `range ${range}`
    }
  }

  const branchChanges = changedFilesFrom(runGit(['diff', '--name-status', `${baseRef}...HEAD`]))
  const workingTreeChanges = changedFilesFrom(runGit(['diff', '--name-status']))
  const stagedChanges = changedFilesFrom(runGit(['diff', '--cached', '--name-status']))
  const untrackedChanges = runGit(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => testFilePattern.test(path))
    .map((path) => ({ status: '??', path }))

  return {
    files: [...branchChanges, ...workingTreeChanges, ...stagedChanges, ...untrackedChanges],
    source: 'current branch, index, worktree, and untracked files'
  }
}

function classify(path) {
  if (path.startsWith('e2e/')) {
    return {
      label: 'e2e-smoke',
      reason: 'E2E coverage should stay small and assert user-visible flows.'
    }
  }

  if (path.startsWith('src/test/')) {
    return {
      label: 'candidate-keep',
      reason: 'Lives in the curated durable test tree; keep unless the protected behavior is no longer durable.'
    }
  }

  if (durablePatterns.some((pattern) => pattern.test(path))) {
    return {
      label: 'candidate-keep',
      reason: 'Looks like math, state, API, validation, or safety coverage.'
    }
  }

  if (lowSignalPatterns.some((pattern) => pattern.test(path))) {
    return {
      label: 'candidate-cull',
      reason: 'Looks like component/config/copy/layout coverage that often becomes low-signal.'
    }
  }

  return {
    label: 'needs-review',
    reason: 'Needs a human/agent judgment call.'
  }
}

function formatSection(title, files) {
  if (files.length === 0) {
    return [`## ${title}`, '', 'None.', '']
  }

  return [
    `## ${title}`,
    '',
    ...files.map(({ path, status }) => {
      const { label, reason } = classify(path)
      return `- ${label}: ${path} (${status}) - ${reason}`
    }),
    ''
  ]
}

const baseRef = resolveBaseRef()
const changeSet = buildChangeSet(baseRef)
const files = uniqueFiles(changeSet.files)
const cullCandidates = files.filter(({ path }) => classify(path).label === 'candidate-cull')
const keepCandidates = files.filter(({ path }) => classify(path).label === 'candidate-keep')
const e2eCandidates = files.filter(({ path }) => classify(path).label === 'e2e-smoke')
const reviewCandidates = files.filter(({ path }) => classify(path).label === 'needs-review')

const output = [
  '# Test Cull Report',
  '',
  `Base: ${baseRef}`,
  `Source: ${changeSet.source}`,
  '',
  'Use this at the end of an agent turn before handoff. Use --all sparingly for whole-repo audits. This is a heuristic report, not a delete button. Keep tests only when they protect durable behavior with independently meaningful expected values. Delete temporary scaffolding tests once the implementation is stable. Durable frontend/domain tests should live under src/test/{math,transactions,api-contracts,formatting,vaults}; colocated tests are allowed while building but should be deleted or moved before commit.',
  '',
  ...formatSection('Keep Candidates', keepCandidates),
  ...formatSection('E2E Smoke Candidates', e2eCandidates),
  ...formatSection('Cull Candidates', cullCandidates),
  ...formatSection('Needs Review', reviewCandidates),
  '## End-of-Turn Prompt',
  '',
  'For each touched test above, decide: keep in src/test, convert to E2E smoke, or delete before handoff. If keeping, state the durable behavior it protects. If deleting, rely on git history or the PR branch while the code is still being built.',
  ''
]

console.log(output.join('\n'))
