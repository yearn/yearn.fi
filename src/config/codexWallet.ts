import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit'
import { type Address, getAddress } from 'viem'
import { createConnector } from 'wagmi'
import { mock } from 'wagmi/connectors'

export const CODEX_WALLET_ID = 'codex'
const CODEX_WALLET_NAME = 'Codex Wallet'
const CODEX_WALLET_QUERY_PARAM = 'codexWallet'
const CODEX_WALLET_ADDRESS_QUERY_PARAM = 'codexWalletAddress'
const CODEX_WALLET_STORAGE_KEY = 'dev-codex-wallet-enabled'
const CODEX_WALLET_ADDRESS_STORAGE_KEY = 'dev-codex-wallet-address'
const DEFAULT_CODEX_WALLET_ADDRESS = '0x000000000000000000000000000000000000c0DE'
const CODEX_WALLET_ICON =
  'data:image/svg+xml,%3Csvg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="48" height="48" rx="12" fill="%23065CF9"/%3E%3Cpath d="M15 15.5C15 13.57 16.57 12 18.5 12H31V17H20V31H31V36H18.5C16.57 36 15 34.43 15 32.5V15.5Z" fill="white"/%3E%3Cpath d="M25 21H34V27H25V21Z" fill="white"/%3E%3C/svg%3E'

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
    const queryFlag = readBooleanFlag(url.searchParams.get(CODEX_WALLET_QUERY_PARAM) ?? undefined)
    if (queryFlag !== undefined) {
      window.localStorage.setItem(CODEX_WALLET_STORAGE_KEY, queryFlag ? 'true' : 'false')
      return queryFlag
    }

    return readBooleanFlag(window.localStorage.getItem(CODEX_WALLET_STORAGE_KEY) ?? undefined)
  } catch {
    return undefined
  }
}

function resolveCodexWalletAddress(): Address {
  const runtimeAddress = readRuntimeAddress()
  if (runtimeAddress) {
    return runtimeAddress
  }

  const configuredAddress = (import.meta.env.VITE_CODEX_WALLET_ADDRESS as string | undefined)?.trim()
  if (!configuredAddress) {
    return DEFAULT_CODEX_WALLET_ADDRESS
  }

  try {
    return getAddress(configuredAddress)
  } catch {
    console.warn(`Invalid VITE_CODEX_WALLET_ADDRESS "${configuredAddress}", using ${DEFAULT_CODEX_WALLET_ADDRESS}`)
    return DEFAULT_CODEX_WALLET_ADDRESS
  }
}

function parseCodexWalletAddress(value: string | null | undefined): Address | undefined {
  const rawAddress = value?.trim()
  if (!rawAddress) {
    return undefined
  }

  try {
    return getAddress(rawAddress)
  } catch {
    console.warn(`Invalid ${CODEX_WALLET_ADDRESS_QUERY_PARAM} "${rawAddress}"`)
    return undefined
  }
}

function readRuntimeAddress(): Address | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const url = new URL(window.location.href)
    const queryAddress = parseCodexWalletAddress(url.searchParams.get(CODEX_WALLET_ADDRESS_QUERY_PARAM))
    if (queryAddress) {
      window.localStorage.setItem(CODEX_WALLET_ADDRESS_STORAGE_KEY, queryAddress)
      return queryAddress
    }

    return parseCodexWalletAddress(window.localStorage.getItem(CODEX_WALLET_ADDRESS_STORAGE_KEY))
  } catch {
    return undefined
  }
}

export function isCodexWalletEnabled(): boolean {
  const configuredFlag = readBooleanFlag(import.meta.env.VITE_CODEX_WALLET)
  if (import.meta.env.PROD) {
    return configuredFlag === true
  }

  return configuredFlag ?? readRuntimeFlag() ?? false
}

export function codexWallet(): Wallet {
  const account = resolveCodexWalletAddress()

  return {
    id: CODEX_WALLET_ID,
    name: CODEX_WALLET_NAME,
    iconUrl: CODEX_WALLET_ICON,
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
        id: CODEX_WALLET_ID,
        name: CODEX_WALLET_NAME
      }))
  }
}
