import { registerConfig, retrieveConfig } from '@shared/utils/wagmi/config'
import { expect, it } from 'vitest'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

it('reuses the registered app config on the server without building a second wallet stack', () => {
  const config = createConfig({
    chains: [mainnet],
    transports: { [mainnet.id]: http() },
    ssr: true
  })
  registerConfig(config)
  expect(retrieveConfig()).toBe(config)
  expect(retrieveConfig()).toBe(config)
})
