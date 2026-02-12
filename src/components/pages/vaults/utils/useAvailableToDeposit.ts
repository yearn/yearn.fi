import { getNativeTokenWrapperContract } from '@pages/vaults/utils/nativeTokens'
import { getVaultChainID, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useYearnBalance } from '@shared/hooks/useYearnBalance'
import { toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'

/**
 * Returns the available amount to deposit for the given vault's asset.
 * For native wrappers (e.g., WETH, WFTM), combines native + wrapped balances.
 */
export function useAvailableToDeposit(currentVault: TKongVaultInput): bigint {
  const chainID = getVaultChainID(currentVault)
  const token = getVaultToken(currentVault)
  const balanceOfWant = useYearnBalance({
    chainID,
    address: token.address
  })

  const balanceOfCoin = useYearnBalance({
    chainID,
    address: ETH_TOKEN_ADDRESS
  })

  const nativeWrapper = getNativeTokenWrapperContract(chainID)
  const balanceOfWrappedCoin = useYearnBalance({
    chainID,
    address: nativeWrapper
  })

  if (toAddress(token.address) === toAddress(nativeWrapper)) {
    return balanceOfWrappedCoin.raw + balanceOfCoin.raw
  }
  return balanceOfWant.raw
}
