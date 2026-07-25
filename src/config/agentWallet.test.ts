// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAgentWalletEnabled, shouldAutoConnectAgentWallet } from './agentWallet'

const mockedEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_AGENT_WALLET: undefined as string | undefined,
  NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED: undefined as string | undefined,
  PROD: false
}))

vi.mock('@/env', () => ({ env: mockedEnv }))

beforeEach(() => {
  mockedEnv.NEXT_PUBLIC_AGENT_WALLET = undefined
  mockedEnv.NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED = undefined
  mockedEnv.PROD = false
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})

describe('agent wallet QA gating', () => {
  it('supports the runtime opt-in during development', () => {
    window.history.replaceState(null, '', '/?agentWallet=true')

    expect(isAgentWalletEnabled()).toBe(true)
    expect(shouldAutoConnectAgentWallet()).toBe(true)
  })

  it('stays disabled in production when only the agent flag is set', () => {
    mockedEnv.PROD = true
    mockedEnv.NEXT_PUBLIC_AGENT_WALLET = 'true'
    window.history.replaceState(null, '', '/?agentWallet=true')

    expect(isAgentWalletEnabled()).toBe(false)
    expect(shouldAutoConnectAgentWallet()).toBe(false)
  })

  it('allows an explicitly configured production parity build', () => {
    mockedEnv.PROD = true
    mockedEnv.NEXT_PUBLIC_AGENT_WALLET = 'true'
    mockedEnv.NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED = 'true'
    window.history.replaceState(null, '', '/?agentWallet=true')

    expect(isAgentWalletEnabled()).toBe(true)
    expect(shouldAutoConnectAgentWallet()).toBe(true)
  })
})
