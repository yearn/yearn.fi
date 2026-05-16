import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit'
import {
  type Address,
  type Chain,
  createWalletClient,
  custom,
  fromHex,
  getAddress,
  type Hex,
  http,
  numberToHex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
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
  const privateKeyAccount = resolveCodexWalletPrivateKeyAccount()
  if (privateKeyAccount) {
    return privateKeyAccount.address
  }

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

function resolveCodexWalletPrivateKey(): Hex | undefined {
  const configuredPrivateKey = (import.meta.env.VITE_CODEX_WALLET_PRIVATE_KEY as string | undefined)?.trim()
  if (!configuredPrivateKey) {
    return undefined
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(configuredPrivateKey)) {
    console.warn('Invalid VITE_CODEX_WALLET_PRIVATE_KEY, falling back to mock Codex wallet')
    return undefined
  }

  return configuredPrivateKey as Hex
}

function resolveCodexWalletPrivateKeyAccount(): ReturnType<typeof privateKeyToAccount> | undefined {
  const privateKey = resolveCodexWalletPrivateKey()
  return privateKey ? privateKeyToAccount(privateKey) : undefined
}

async function requestRpc(rpcUrl: string, method: string, params?: unknown): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params: params ?? [] })
  })
  const payload = (await response.json()) as {
    result?: unknown
    error?: { message: string; code: number; data?: unknown }
  }
  if (payload.error) {
    throw new Error(`${payload.error.message} (code ${payload.error.code})`)
  }
  return payload.result
}

function getConnectorChain(chains: readonly Chain[], chainId: number): Chain {
  return chains.find((chain) => chain.id === chainId) ?? chains[0]
}

function codexPrivateKeyConnector(walletDetails: WalletDetailsParams) {
  const account = resolveCodexWalletPrivateKeyAccount()
  if (!account) {
    return undefined
  }

  return createConnector((config) => {
    let connected = true
    let connectedChainId = config.chains[0].id

    const getWalletClient = (chainId = connectedChainId) => {
      const chain = getConnectorChain(config.chains, chainId)
      const rpcUrl = chain.rpcUrls.default.http[0]
      return createWalletClient({ account, chain, transport: http(rpcUrl) })
    }

    const request = async ({ method, params }: { method: string; params?: unknown }): Promise<unknown> => {
      if (method === 'eth_chainId') {
        return numberToHex(connectedChainId)
      }

      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return connected ? [account.address] : []
      }

      if (method === 'wallet_switchEthereumChain') {
        const [requestedChain] = params as [{ chainId: Hex }]
        connectedChainId = fromHex(requestedChain.chainId, 'number')
        config.emitter.emit('change', { chainId: connectedChainId })
        return null
      }

      if (method === 'wallet_addEthereumChain') {
        return null
      }

      if (method === 'personal_sign') {
        const [message] = params as [Hex, Address]
        return getWalletClient().signMessage({ message: { raw: message } })
      }

      if (method === 'eth_sign') {
        const [, message] = params as [Address, Hex]
        return getWalletClient().signMessage({ message: { raw: message } })
      }

      if (method === 'eth_signTypedData_v4') {
        const [, typedDataPayload] = params as [Address, string | Record<string, unknown>]
        const typedData = typeof typedDataPayload === 'string' ? JSON.parse(typedDataPayload) : typedDataPayload
        const { domain, message, primaryType, types } = typedData as {
          domain: Record<string, unknown>
          message: Record<string, unknown>
          primaryType: string
          types: Record<string, unknown>
        }
        const { EIP712Domain: _domainType, ...typedDataTypes } = types
        return getWalletClient().signTypedData({
          account,
          domain,
          message,
          primaryType,
          types: typedDataTypes
        } as never)
      }

      if (method === 'eth_sendTransaction') {
        const [transaction] = params as [Record<string, unknown>]
        const { from: _from, ...transactionRequest } = transaction
        return getWalletClient().sendTransaction({
          ...transactionRequest,
          account,
          chain: getConnectorChain(config.chains, connectedChainId)
        } as never)
      }

      const chain = getConnectorChain(config.chains, connectedChainId)
      return requestRpc(chain.rpcUrls.default.http[0], method, params)
    }

    return {
      ...walletDetails,
      id: CODEX_WALLET_ID,
      name: CODEX_WALLET_NAME,
      type: 'codex',
      async connect<withCapabilities extends boolean = false>(parameters?: { chainId?: number }) {
        const chainId = parameters?.chainId
        if (chainId) {
          connectedChainId = chainId
        }
        connected = true
        return { accounts: [account.address], chainId: connectedChainId } as unknown as {
          accounts: withCapabilities extends true
            ? readonly { address: Address; capabilities: Record<string, unknown> }[]
            : readonly Address[]
          chainId: number
        }
      },
      async disconnect() {
        connected = false
      },
      async getAccounts() {
        return connected ? [account.address] : []
      },
      async getChainId() {
        return connectedChainId
      },
      async getProvider() {
        return custom({ request })({ retryCount: 0 })
      },
      async isAuthorized() {
        return connected
      },
      async switchChain({ chainId }) {
        connectedChainId = chainId
        config.emitter.emit('change', { chainId })
        return getConnectorChain(config.chains, chainId)
      },
      onAccountsChanged(accounts) {
        config.emitter.emit('change', { accounts: accounts.map((item) => getAddress(item)) })
      },
      onChainChanged(chainId) {
        config.emitter.emit('change', { chainId: Number(chainId) })
      },
      async onDisconnect() {
        connected = false
        config.emitter.emit('disconnect')
      }
    }
  })
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
      codexPrivateKeyConnector(walletDetails) ??
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
