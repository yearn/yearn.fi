import {useState} from 'react';
import {useAsync} from '@react-hookz/web';
import {VEYFI_OPTIONS_ADDRESS, VEYFI_OYFI_ADDRESS} from '@veYFI/constants';
import {useOption} from '@veYFI/contexts/useOption';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as OptionActions from '@veYFI/utils/actions/option';
import {validateAllowance, validateAmount, validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {BIG_ZERO, ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBigNumberAsAmount, toNormalizedBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {approveERC20} from '@common/utils/actions/approveToken';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function RedeemTab(): ReactElement {
	const [redeemAmount, set_redeemAmount] = useState(toNormalizedBN(0));
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {getRequiredEth, price: optionPrice, positions, allowances, isLoading: isLoadingOption, refresh} = useOption();
	const clearLockAmount = (): void => set_redeemAmount(toNormalizedBN(0));
	const refreshData = (): unknown => Promise.all([refresh(), refreshBalances()]);
	const onTxSuccess = (): unknown => Promise.all([refreshData(), clearLockAmount()]);
	const [{status, result}, fetchRequiredEth] = useAsync(getRequiredEth, BIG_ZERO);
	const ethBalance = useBalance(ETH_TOKEN_ADDRESS);
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const [approveRedeem, approveRedeemStatus] = useTransaction(approveERC20, refreshData);
	const [redeem, redeemStatus] = useTransaction(OptionActions.redeem, onTxSuccess);

	const userAddress = address as TAddress;
	const oYFIBalance = toNormalizedBN(formatBigNumberAsAmount(positions?.balance), 18);
	const ethRequired = toNormalizedValue(result, 18);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: VEYFI_OYFI_ADDRESS,
		spenderAddress: VEYFI_OPTIONS_ADDRESS,
		allowances,
		amount: redeemAmount.raw,
		ownerAddress: userAddress,
		chainID: 1
	});

	const {isValid: isValidRedeemAmount, error: redeemAmountError} = validateAmount({
		amount: redeemAmount.normalized,
		balance: oYFIBalance.normalized
	});

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: safeChainID});

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Redeem'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<AmountInput
						label={'You have oYFI'}
						amount={oYFIBalance.normalized}
						legend={formatCounterValue(oYFIBalance.normalized, optionPrice ?? 0)}
						disabled
					/>
					<AmountInput
						label={'YFI you want to redeem'}
						amount={redeemAmount.normalized}
						maxAmount={oYFIBalance.normalized}
						onAmountChange={(value): void => {
							const amount = handleInputChangeEventValue(value, 18);
							set_redeemAmount(amount);
							fetchRequiredEth.execute(amount.raw);
						}}
						onLegendClick={(): void => set_redeemAmount(oYFIBalance)}
						onMaxClick={(): void => set_redeemAmount(oYFIBalance)}
						legend={formatCounterValue(redeemAmount.normalized, yfiPrice)}
						error={redeemAmountError}
					/>
					<AmountInput
						label={'ETH fee'}
						amount={ethRequired}
						legend={formatCounterValue(ethRequired, ethBalance.normalizedPrice ?? 0)}
						loading={status === 'loading'}
						disabled
					/>
					<Button 
						className={'w-full md:mt-7'}
						onClick={(): unknown =>
							isApproved  
								? redeem(provider, toAddress(address), redeemAmount.raw, result)
								: approveRedeem(provider, VEYFI_OYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS)
						}
						isBusy={isLoadingOption || approveRedeemStatus.loading || redeemStatus.loading || status === 'loading'}
						disabled={!isActive || !isValidNetwork || !isValidRedeemAmount || status === 'loading' || status === 'error'}
					>
						{isApproved ? 'Redeem' : 'Approve'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RedeemTab};
