import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit'
import { type Address, getAddress } from 'viem'
import { createConnector } from 'wagmi'
import { mock } from 'wagmi/connectors'
import { env } from '@/env'

export const AGENT_WALLET_ID = 'agent'
const AGENT_WALLET_NAME = 'Agent Wallet'
const AGENT_WALLET_QUERY_PARAM = 'agentWallet'
const AGENT_WALLET_STORAGE_KEY = 'dev-agent-wallet-enabled'
const DEFAULT_AGENT_WALLET_ADDRESS = '0x000000000000000000000000000000000000c0DE'
const AGENT_WALLET_ICON =
  'data:image/svg+xml,%3Csvg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="48" height="48" rx="12" fill="%23065CF9"/%3E%3Cpath d="M24 10L36 38H30.5L28.1 32H19.9L17.5 38H12L24 10ZM21.8 27H26.2L24 21.2L21.8 27Z" fill="white"/%3E%3C/svg%3E'

function readBooleanFlag(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  const normalizedValue = value?.trim().toLowerCase()
  if (!normalizedValue) {
    return undefined
  }

  if (['1', 'on', 'true', 'yes'].includes(normalizedValue)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false
  }

  return undefined
}

function readRuntimeFlag(): boolean | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const url = new URL(window.location.href)
    const queryFlag = readBooleanFlag(url.searchParams.get(AGENT_WALLET_QUERY_PARAM) ?? undefined)
    if (queryFlag !== undefined) {
      window.localStorage.setItem(AGENT_WALLET_STORAGE_KEY, queryFlag ? 'true' : 'false')
      return queryFlag
    }

    return readBooleanFlag(window.localStorage.getItem(AGENT_WALLET_STORAGE_KEY) ?? undefined)
  } catch {
    return undefined
  }
}

function resolveAgentWalletAddress(): Address {
  const configuredAddress = env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS?.trim()
  if (!configuredAddress) {
    return DEFAULT_AGENT_WALLET_ADDRESS
  }

  try {
    return getAddress(configuredAddress)
  } catch {
    console.warn(
      `Invalid NEXT_PUBLIC_AGENT_WALLET_ADDRESS "${configuredAddress}", using ${DEFAULT_AGENT_WALLET_ADDRESS}`
    )
    return DEFAULT_AGENT_WALLET_ADDRESS
  }
}

export function isAgentWalletEnabled(): boolean {
  if (env.PROD) {
    return false
  }

  return readBooleanFlag(env.NEXT_PUBLIC_AGENT_WALLET) ?? readRuntimeFlag() ?? false
}

export function shouldAutoConnectAgentWallet(): boolean {
  if (env.PROD) {
    return false
  }

  return readRuntimeFlag() === true
}

export function agentWallet(): Wallet {
  const account = resolveAgentWalletAddress()

  return {
    id: AGENT_WALLET_ID,
    name: AGENT_WALLET_NAME,
    iconUrl: AGENT_WALLET_ICON,
    iconBackground: '#065CF9',
    installed: true,
    createConnector: (walletDetails: WalletDetailsParams) =>
      createConnector((config) => ({
        ...mock({
          accounts: [account],
          features: {
            defaultConnected: true,
            reconnect: true
          }
        })(config),
        ...walletDetails,
        id: AGENT_WALLET_ID,
        name: AGENT_WALLET_NAME
      }))
  }
}
