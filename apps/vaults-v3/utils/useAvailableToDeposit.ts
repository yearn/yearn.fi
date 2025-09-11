import { useYearnBalance } from '@lib/hooks/useYearnBalance';
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants';
import { toAddress } from '@lib/utils';
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas';
import { getNativeTokenWrapperContract } from '@vaults-v2/utils';

/**
 * Returns the available amount to deposit for the given vault's asset.
 * For native wrappers (e.g., WETH, WFTM), combines native + wrapped balances.
 */
export function useAvailableToDeposit(currentVault: TYDaemonVault): bigint {
  const balanceOfWant = useYearnBalance({
    chainID: currentVault.chainID,
    address: currentVault.token.address
  });

  const balanceOfCoin = useYearnBalance({
    chainID: currentVault.chainID,
    address: ETH_TOKEN_ADDRESS
  });

  const nativeWrapper = getNativeTokenWrapperContract(currentVault.chainID);
  const balanceOfWrappedCoin = useYearnBalance({
    chainID: currentVault.chainID,
    address: nativeWrapper
  });

  if (toAddress(currentVault.token.address) === toAddress(nativeWrapper)) {
    return balanceOfWrappedCoin.raw + balanceOfCoin.raw;
  }
  return balanceOfWant.raw;
}

