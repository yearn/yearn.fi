import { getPublicClient, sendTransaction, waitForTransactionReceipt } from 'wagmi/actions'
import type { VaultWidgetExecutionService } from './types'

export function createWagmiExecutionService(): VaultWidgetExecutionService {
  return {
    async execute({ account, config, request }) {
      const publicClient = getPublicClient(config, { chainId: request.chainId })
      if (!publicClient) throw new Error(`No public client is configured for chain ${request.chainId}`)
      await publicClient.call({
        account,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
      return sendTransaction(config, {
        account,
        chainId: request.chainId,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
    },
    async waitForReceipt(config, chainId, hash): Promise<void> {
      const receipt = await waitForTransactionReceipt(config, { chainId, hash })
      if (receipt.status !== 'success') {
        throw new Error('Transaction reverted')
      }
    }
  }
}
