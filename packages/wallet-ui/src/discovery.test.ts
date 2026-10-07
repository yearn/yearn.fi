import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { afterEach, expect, it } from 'vitest'
import { createConfig, createStorage, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

const cleanup: (() => void)[] = []
const wallet = (rdns: string, uuid: string) => ({
  info: { rdns, uuid, name: rdns, icon: 'data:image/svg+xml,<svg />' },
  provider: { request: async () => '0x1', on: () => undefined, removeListener: () => undefined }
})
const announce = (detail: ReturnType<typeof wallet>) =>
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }))

afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((stop) => {
      stop()
    })
})

it('deduplicates WalletChan before real Wagmi discovery while retaining Rabby and fresh discovery stores', () => {
  const stop = deduplicateWalletAnnouncements()
  if (stop) cleanup.push(stop)
  const first = wallet('com.walletchan', '00000000-0000-4000-8000-000000000001')
  const duplicate = wallet('com.walletchan', '00000000-0000-4000-8000-000000000002')
  const rabby = wallet('io.rabby', '00000000-0000-4000-8000-000000000003')
  const onRequest = () => [first, duplicate, rabby].forEach(announce)
  window.addEventListener('eip6963:requestProvider', onRequest)
  cleanup.push(() => window.removeEventListener('eip6963:requestProvider', onRequest))

  const createWalletConfig = () =>
    createConfig({
      chains: [mainnet],
      transports: { [mainnet.id]: http() },
      storage: createStorage({ storage: window.localStorage })
    })
  const config = createWalletConfig()
  expect(config.connectors.map(({ id }) => id)).toEqual(['com.walletchan', 'io.rabby'])
  announce(duplicate)
  expect(config.connectors.filter(({ id }) => id === 'com.walletchan')).toHaveLength(1)
  expect(createWalletConfig().connectors.map(({ id }) => id)).toEqual(['com.walletchan', 'io.rabby'])
})

it('replays the original provider for another discovery request and installs only one listener', () => {
  const stop = deduplicateWalletAnnouncements()
  if (stop) cleanup.push(stop)
  expect(deduplicateWalletAnnouncements()).toBe(stop)
  const first = wallet('com.walletchan', '00000000-0000-4000-8000-000000000001')
  announce(first)
  const received: unknown[] = []
  const listen = (event: Event) => received.push((event as CustomEvent).detail)
  window.addEventListener('eip6963:announceProvider', listen)
  cleanup.push(() => window.removeEventListener('eip6963:announceProvider', listen))
  announce(wallet('com.walletchan', '00000000-0000-4000-8000-000000000002'))
  expect(received).toEqual([first])
})
