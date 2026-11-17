// @vitest-environment jsdom

import { useSwitchChain as useYearnSwitchChain } from '@shared/hooks/useAppWagmi'
import { cleanup, renderHook } from '@testing-library/react'
import { useSwitchChain as useWidgetSwitchChain } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  resolveExecutionChainId: (chainId: number | undefined) => (chainId === 4663 ? 14663 : undefined)
}))

vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useSwitchChain: () => ({ mutate: mocks.mutate, mutateAsync: mocks.mutateAsync })
}))
vi.mock('@/config/tenderly', () => ({
  resolveExecutionChainId: mocks.resolveExecutionChainId
}))
vi.mock('@yearn/vault-widget/runtime', () => ({
  useVaultWidgetRuntime: () => ({ chains: { resolveExecutionChainId: mocks.resolveExecutionChainId } })
}))

const hooks = [
  ['Yearn', useYearnSwitchChain],
  ['vault widget', useWidgetSwitchChain]
] as const

afterEach(cleanup)
beforeEach(() => {
  mocks.mutate.mockReset()
  mocks.mutateAsync.mockReset().mockResolvedValue({ id: 14663 })
})

it.each(hooks)(
  '%s maps v3 mutations and legacy aliases to the execution chain with callbacks intact',
  async (_, hook) => {
    const { result } = renderHook(hook)
    const callbacks = { onSuccess: vi.fn() }
    result.current.mutate({ chainId: 4663 }, callbacks)
    expect(mocks.mutate).toHaveBeenCalledWith({ chainId: 14663 }, callbacks)
    await expect(result.current.mutateAsync({ chainId: 4663 }, callbacks)).resolves.toEqual({ id: 14663 })
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ chainId: 14663 }, callbacks)
    expect(result.current.switchChain).toBe(result.current.mutate)
    expect(result.current.switchChainAsync).toBe(result.current.mutateAsync)
  }
)

it.each(hooks)('%s blocks unsupported execution chains through the v3 mutation API', async (_, hook) => {
  const { result } = renderHook(hook)
  expect(() => result.current.mutate({ chainId: 1 })).toThrow('Chain 1 is not enabled for execution')
  await expect(result.current.mutateAsync({ chainId: 1 })).rejects.toThrow('Chain 1 is not enabled for execution')
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.mutateAsync).not.toHaveBeenCalled()
})
