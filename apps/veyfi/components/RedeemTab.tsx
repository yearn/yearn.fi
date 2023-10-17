import {useCallback, useState} from 'react';
import {useAsync} from '@react-hookz/web';
import {useOption} from '@veYFI/contexts/useOption';
import {redeem} from '@veYFI/utils/actions/option';
import {VEYFI_OPTIONS_ADDRESS, VEYFI_OYFI_ADDRESS, VEYFI_SUPPORTED_NETWORK} from '@veYFI/utils/constants';
import {validateAllowance, validateAmount} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {BIG_ZERO, ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {
	formatBigNumberAsAmount,
	toNormalizedBN,
	toNormalizedValue
} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';
import {usePrice} from '@common/hooks/usePrice';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {approveERC20} from '@common/utils/actions';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

export function RedeemTab(): ReactElement {
	const [redeemAmount, set_redeemAmount] = useState(toNormalizedBN(0));
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {
		getRequiredEth,
		price: optionPrice,
		positions,
		allowances,
		isLoading: isLoadingOption,
		refresh
	} = useOption();
	const clearLockAmount = (): void => set_redeemAmount(toNormalizedBN(0));
	const refreshData = useCallback(
		(): unknown => Promise.all([refresh(), refreshBalances()]),
		[refresh, refreshBalances]
	);
	const onTxSuccess = useCallback((): unknown => Promise.all([refreshData(), clearLockAmount()]), [refreshData]);
	const [{status, result}, fetchRequiredEth] = useAsync(getRequiredEth, BIG_ZERO);
	const ethPrice = usePrice({address: ETH_TOKEN_ADDRESS, chainID: 1}); //VeYFI is on ETH mainnet only
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const [approveRedeemStatus, set_approveRedeemStatus] = useState(defaultTxStatus);
	const [redeemStatus, set_redeemStatus] = useState(defaultTxStatus);

	const userAddress = address as TAddress;
	const oYFIBalance = toNormalizedBN(formatBigNumberAsAmount(positions?.balance), 18);
	const ethRequired = toNormalizedValue(result, 18);

	const handleApproveRedeem = useCallback(async (): Promise<void> => {
		const response = await approveERC20({
			connector: provider,
			chainID: VEYFI_SUPPORTED_NETWORK,
			contractAddress: VEYFI_OYFI_ADDRESS,
			spenderAddress: VEYFI_OPTIONS_ADDRESS,
			statusHandler: set_approveRedeemStatus,
			amount: redeemAmount.raw
		});

		if (response.isSuccessful) {
			await refreshData();
		}
	}, [provider, redeemAmount.raw, refreshData]);

	const handleRedeem = useCallback(async (): Promise<void> => {
		const response = await redeem({
			connector: provider,
			chainID: VEYFI_SUPPORTED_NETWORK,
			contractAddress: VEYFI_OPTIONS_ADDRESS,
			statusHandler: set_redeemStatus,
			accountAddress: toAddress(address),
			amount: redeemAmount.raw,
			ethRequired: result
		});

		if (response.isSuccessful) {
			await onTxSuccess();
		}
	}, [address, onTxSuccess, provider, redeemAmount.raw, result]);

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

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>{'Redeem'}</h2>
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
						legend={formatCounterValue(ethRequired, Number(ethPrice.normalized))}
						loading={status === 'loading'}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={async (): Promise<void> => (isApproved ? handleRedeem() : handleApproveRedeem())}
						isBusy={
							isLoadingOption ||
							approveRedeemStatus.pending ||
							redeemStatus.pending ||
							status === 'loading'
						}
						isDisabled={
							!isActive ||
							!isValidRedeemAmount ||
							status === 'loading' ||
							status === 'error' ||
							!redeemStatus.none ||
							!approveRedeemStatus.none
						}>
						{isApproved ? 'Redeem' : 'Approve'}
					</Button>
				</div>
			</div>
		</div>
	);
}
