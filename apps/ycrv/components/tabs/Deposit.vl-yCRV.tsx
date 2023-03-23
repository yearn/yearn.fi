import React, {useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {useAsync, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {approvedERC20Amount} from '@common/utils/actions/approveToken';
import {QuickActions} from '@yCRV/components/QuickActions';
import {VL_YCRV, YCRV} from '@yCRV/constants/tokens';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';

import type {BigNumber} from 'ethers';
import type {ChangeEvent, ReactElement} from 'react';
import type {TQAButton, TQAInput, TQASelect} from '@yCRV/components/QuickActions';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function Deposit(): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances, refresh} = useWallet();
	const yCRVBalance = useBalance(YCRV.value);
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerYCRV = useTokenPrice(toAddress(YCRV.value));
	const {deposit, approve} = useVLyCRV();

	const fromSelectProps: TQASelect = useMemo((): TQASelect => {
		const legend = `You have ${formatAmount(yCRVBalance.normalized)} ${yCRVBalance?.symbol || 'tokens'}`;
		return {label: 'From wallet', legend, options: [YCRV], selected: YCRV};
	}, [yCRVBalance.normalized, yCRVBalance?.symbol]);

	const maxLockingPossible = useMemo((): TNormalizedBN => {
		const balance = yCRVBalance.raw || ethers.constants.Zero;
		return (toNormalizedBN(balance.toString(), yCRVBalance.decimals));
	}, [yCRVBalance.decimals, yCRVBalance.raw]);

	const fromInputProps: TQAInput = useMemo((): TQAInput => ({
		onChange: ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
			const decimals = balances?.[toAddress(YCRV.value)]?.decimals || 18;
			set_amount(value === '' ? undefined : handleInputChangeEventValue(value, decimals));
		},
		value: amount ? amount.normalized : '',
		onSetMaxAmount: (): void => set_amount(maxLockingPossible),
		label: 'Amount',
		legend: formatCounterValue(amount?.normalized || 0, pricePerYCRV),
		isDisabled: !isActive,
		placeholder: '0'
	}), [amount, balances, isActive, maxLockingPossible, pricePerYCRV]);

	const toInputProps: TQAInput = useMemo((): TQAInput => ({
		value: amount?.normalized ?? 0,
		label: 'You will get',
		isDisabled: true
	}), [amount]);

	const [{result: allowanceFrom, status}, actions] = useAsync(async (): Promise<BigNumber> => approvedERC20Amount(
		provider,
		toAddress(YCRV.value),
		toAddress(VL_YCRV.value)
	), Zero);
	useUpdateEffect((): void => {
		actions.execute();
	}, [provider]);

	const toSelectProps: TQASelect = {label: 'To vault', options: [VL_YCRV], selected: VL_YCRV};

	async function onDeposit(): Promise<void> {
		new Transaction(provider, deposit, set_txStatusDeposit)
			.populate(formatBN(amount?.raw))
			.onSuccess(async (): Promise<void> => {
				await refresh([{token: VL_YCRV.value}, {token: YCRV.value}]);
			})
			.perform();
	}
	async function onApprove(): Promise<void> {
		new Transaction(provider, approve, set_txStatusApprove)
			.populate(ethers.constants.MaxUint256)
			.onSuccess(async (): Promise<void> => {
				await actions.execute();
			})
			.perform();
	}

	const depositButtonProps: TQAButton = {
		label: 'Deposit',
		onClick: onDeposit,
		isBusy: txStatusDeposit.pending,
		isDisabled: !isActive || !amount?.raw.gt(0)
	};
	const approveButtonProps: TQAButton = {
		label: 'Approve',
		onClick: onApprove,
		isBusy: txStatusApprove.pending,
		isDisabled: !isActive || status === 'loading'
	};

	return (
		<div aria-label={'yCRV Deposit'} className={'col-span-12 mb-4'}>
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
				<QuickActions.Button {...(allowanceFrom.gte(formatBN(amount?.raw)) ? depositButtonProps : approveButtonProps)} />
			</div>
		</div>
	);
}

export default Deposit;
