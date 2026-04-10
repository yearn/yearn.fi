import { describe, expect, it } from 'vitest'
import { resolveDevLauncherStrategy } from './dev.mjs'

describe('resolveDevLauncherStrategy', () => {
  it('starts a new API server on the default port when the port is free', () => {
    expect(
      resolveDevLauncherStrategy({
        defaultApiPort: 3001,
        portAvailable: true,
        healthyExistingApi: false,
        ownerWorkspaceMatches: false,
        hasApiChanges: false,
        nextAvailablePort: 3002
      })
    ).toEqual({
      kind: 'start-new',
      apiPort: 3001,
      reuseExistingApi: false,
      shouldPrompt: false
    })
  })

  it('reuses the existing API server when it belongs to this workspace and there are no API changes', () => {
    expect(
      resolveDevLauncherStrategy({
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

  it('prompts for a new port when the default port is occupied by another workspace', () => {
    expect(
      resolveDevLauncherStrategy({
        defaultApiPort: 3001,
        portAvailable: false,
        healthyExistingApi: true,
        ownerWorkspaceMatches: false,
        hasApiChanges: false,
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

  it('prompts for a new port when this workspace has API-related changes', () => {
    expect(
      resolveDevLauncherStrategy({
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
