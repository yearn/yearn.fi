import React, {useMemo, useState} from 'react';
import {BigNumber, ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {QuickActions} from '@yCRV/components/QuickActions';
import {VL_YCRV, YCRV} from '@yCRV/constants/tokens';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';

import type {ChangeEvent, ReactElement} from 'react';
import type {TQAButton, TQAInput, TQASelect} from '@yCRV/components/QuickActions';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function Withdraw(): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances} = useWallet();
	const stYCRVBalance = useBalance(VL_YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerSTYCRV = useTokenPrice(toAddress(VL_YCRV.value));
	const {withdraw} = useVLyCRV();

	const fromSelectProps: TQASelect = useMemo((): TQASelect => {
		const legend = `You have ${formatAmount(stYCRVBalance.normalized)} ${stYCRVBalance?.symbol || 'tokens'}`;
		return {label: 'From vault', legend, options: [VL_YCRV], selected: VL_YCRV};
	}, [stYCRVBalance.normalized, stYCRVBalance?.symbol]);

	const maxLockingPossible = useMemo((): TNormalizedBN => {
		const balance = stYCRVBalance.raw || ethers.constants.Zero;
		return (toNormalizedBN(balance.toString(), stYCRVBalance.decimals));
	}, [stYCRVBalance.decimals, stYCRVBalance.raw]);

	const fromInputProps: TQAInput = useMemo((): TQAInput => ({
		onChange: ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
			const decimals = balances?.[toAddress(VL_YCRV.value)]?.decimals || 18;
			if (value === '') {
				set_amount(undefined);
				return;
			}
			set_amount(handleInputChangeEventValue(value, decimals));
		},
		value: amount ? amount.normalized : '',
		onSetMaxAmount: (): void => set_amount(maxLockingPossible),
		label: 'Amount',
		legend: formatCounterValue(amount?.normalized || 0, pricePerSTYCRV),
		isDisabled: !isActive,
		placeholder: '0'
	}), [amount, balances, isActive, maxLockingPossible, pricePerSTYCRV]);


	const toInputProps: TQAInput = useMemo((): TQAInput => ({
		value: amount?.normalized ?? 0,
		label: 'You will get',
		isDisabled: true
	}), [amount]);

	return useMemo((): ReactElement => {
		const toSelectProps: TQASelect = {label: 'To wallet', options: [YCRV], selected: YCRV};

		async function onWithdraw(): Promise<void> {
			withdraw({amount: amount?.raw ? amount?.raw : BigNumber.from(0), provider: provider as ethers.providers.Web3Provider});
		}

		const buttonProps: TQAButton = {
			label: 'Withdraw',
			onClick: onWithdraw,
			isDisabled: !isActive || !amount?.raw.gt(0)
		};

		return (
			<div
				aria-label={'yCRV Withdraw'}
				className={'col-span-12 mb-4'}>
				<div className={'col-span-12 flex flex-col space-x-0 space-y-2 md:flex-row md:space-x-4 md:space-y-0'}>
					<QuickActions label={'voteFrom'}>
						<QuickActions.Select {...fromSelectProps} />
						<QuickActions.Input {...fromInputProps} />
					</QuickActions>
					<QuickActions.Switch />
					<QuickActions label={'voteTo'}>
						<QuickActions.Select {...toSelectProps} />
						<QuickActions.Input {...toInputProps} />
					</QuickActions>
					<QuickActions.Button {...buttonProps} />
				</div>
			</div>
		);
	}, [amount?.raw, fromInputProps, fromSelectProps, isActive, provider, toInputProps, withdraw]);
}

export default Withdraw;
