import { describe, expect, it } from 'vitest'
import { resolvePreviewLauncherStrategy } from './preview.mjs'

describe('resolvePreviewLauncherStrategy', () => {
  it('reuses the existing API server when it belongs to this workspace and there are no API changes', () => {
    expect(
      resolvePreviewLauncherStrategy({
        defaultApiPort: 3001,
        portAvailable: false,
        healthyExistingApi: true,
        ownerWorkspaceMatches: true,
        hasApiChanges: false,
        nextAvailablePort: 3002
      })
    ).toEqual({
      kind: 'reuse-existing',
      apiPort: 3001,
      reuseExistingApi: true,
      shouldPrompt: false
    })
  })

  it('prompts for a new port when this workspace has API-related changes', () => {
    expect(
      resolvePreviewLauncherStrategy({
        defaultApiPort: 3001,
        portAvailable: false,
        healthyExistingApi: true,
        ownerWorkspaceMatches: true,
        hasApiChanges: true,
        nextAvailablePort: 3002
      })
    ).toEqual({
      kind: 'prompt',
      apiPort: 3002,
      recommendedPort: 3002,
      reuseExistingApi: false,
      canReuseExistingApi: true,
      shouldPrompt: true
    })
  })
})
