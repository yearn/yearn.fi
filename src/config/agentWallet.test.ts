// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAgentWalletEnabled, resolveAgentWalletAddress, shouldAutoConnectAgentWallet } from './agentWallet'

const mockedEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_AGENT_WALLET: undefined as string | undefined,
  NEXT_PUBLIC_AGENT_WALLET_ADDRESS: undefined as string | undefined,
  NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED: undefined as string | undefined,
  PROD: false
}))

vi.mock('@/env', () => ({ env: mockedEnv }))

beforeEach(() => {
  mockedEnv.NEXT_PUBLIC_AGENT_WALLET = undefined
  mockedEnv.NEXT_PUBLIC_AGENT_WALLET_ADDRESS = undefined
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

  it('allows a runtime account fixture during parity QA', () => {
    mockedEnv.PROD = true
    mockedEnv.NEXT_PUBLIC_AGENT_WALLET = 'true'
    mockedEnv.NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED = 'true'
    window.history.replaceState(
      null,
      '',
      '/?agentWallet=true&agentWalletAddress=0xC4080c19DE69c2362d01B20F071D4046364A0226'
    )

    expect(resolveAgentWalletAddress()).toBe('0xC4080c19DE69c2362d01B20F071D4046364A0226')
  })

  it('ignores a runtime account fixture outside an authorized production QA build', () => {
    mockedEnv.PROD = true
    mockedEnv.NEXT_PUBLIC_AGENT_WALLET_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    window.history.replaceState(null, '', '/?agentWalletAddress=0xC4080c19DE69c2362d01B20F071D4046364A0226')

    expect(resolveAgentWalletAddress()).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
  })
})
