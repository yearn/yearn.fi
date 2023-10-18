import {useCallback, useEffect, useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {getVotingPower} from '@veYFI/utils';
import {increaseVeYFILockAmount, lockVeYFI} from '@veYFI/utils/actions';
import {MAX_LOCK_TIME, MIN_LOCK_AMOUNT, MIN_LOCK_TIME, VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {validateAllowance, validateAmount} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {approveERC20} from '@common/utils/actions';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

export function LockVeYFI(): ReactElement {
	const [lockAmount, set_lockAmount] = useState(toNormalizedBN(0));
	const [lockTime, set_lockTime] = useState('');
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, allowances, isLoading: isLoadingVotingEscrow, refresh: refreshVotingEscrow} = useVotingEscrow();
	const tokenBalance = useBalance(toAddress(votingEscrow?.token));
	const hasLockedAmount = toBigInt(positions?.deposit?.underlyingBalance) > 0n;
	const [approveLockStatus, set_approveLockStatus] = useState(defaultTxStatus);
	const [lockStatus, set_lockStatus] = useState(defaultTxStatus);
	const [increaseLockAmountStatus, set_increaseLockAmountStatus] = useState(defaultTxStatus);

	const unlockTime = useMemo((): TMilliseconds => {
		return positions?.unlockTime || Date.now() + fromWeeks(toTime(lockTime));
	}, [positions?.unlockTime, lockTime]);

	const votingPower = useMemo((): TNormalizedBN => {
		return toNormalizedBN(getVotingPower(toBigInt(positions?.deposit?.underlyingBalance) + toBigInt(lockAmount.raw), unlockTime), 18);
	}, [positions?.deposit?.underlyingBalance, lockAmount, unlockTime]);

	const refreshData = useCallback(async (): Promise<void> => {
		await Promise.all([refreshVotingEscrow(), refreshBalances()]);
	}, [refreshVotingEscrow, refreshBalances]);

	const onTxSuccess = useCallback(async (): Promise<void> => {
		await Promise.all([refreshData(), set_lockAmount(toNormalizedBN(0))]);
	}, [refreshData]);

	const onApproveLock = useCallback(async (): Promise<void> => {
		const result = await approveERC20({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: votingEscrow?.token,
			spenderAddress: votingEscrow?.address,
			statusHandler: set_approveLockStatus,
			amount: lockAmount.raw
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [lockAmount.raw, provider, refreshData, votingEscrow?.address, votingEscrow?.token]);

	const onLock = useCallback(async (): Promise<void> => {
		const result = await lockVeYFI({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: votingEscrow?.address,
			amount: lockAmount.raw,
			time: toBigInt(toSeconds(unlockTime)),
			statusHandler: set_lockStatus
		});
		if (result.isSuccessful) {
			onTxSuccess();
		}
	}, [provider, votingEscrow?.address, lockAmount.raw, unlockTime, onTxSuccess]);

	const onIncreaseLockAmount = useCallback(async (): Promise<void> => {
		const result = await increaseVeYFILockAmount({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: votingEscrow?.address,
			amount: lockAmount.raw,
			statusHandler: set_increaseLockAmountStatus
		});
		if (result.isSuccessful) {
			onTxSuccess();
		}
	}, [provider, votingEscrow?.address, lockAmount.raw, onTxSuccess]);

	useEffect((): void => {
		if(!positions?.unlockTime) {
			return;
		}
		set_lockTime(toWeeks(getTimeUntil(positions.unlockTime), false).toString());
	}, [positions?.unlockTime]);

	const {isValid: isApproved} = validateAllowance({
		ownerAddress: toAddress(address),
		tokenAddress: toAddress(votingEscrow?.token),
		spenderAddress: toAddress(votingEscrow?.address),
		chainID: safeChainID,
		allowances,
		amount: lockAmount.raw
	});

	const {isValid: isValidLockAmount, error: lockAmountError} = validateAmount({
		amount: lockAmount.normalized,
		balance: tokenBalance.normalized,
		minAmountAllowed: hasLockedAmount ? 0 : MIN_LOCK_AMOUNT,
		shouldDisplayMin: !hasLockedAmount
	});

	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime,
		minAmountAllowed: hasLockedAmount ? 0 : MIN_LOCK_TIME
	});

	const isApproveDisabled = !isActive || isApproved || isLoadingVotingEscrow || !votingEscrow || !address;
	const isLockDisabled = !isActive || !isApproved || !isValidLockAmount || !isValidLockTime || isLoadingVotingEscrow || !votingEscrow || !address;
	const txAction = !isApproved
		? {
			label: 'Approve',
			onAction: onApproveLock,
			isLoading: approveLockStatus.pending,
			isDisabled: isApproveDisabled
		}
		: hasLockedAmount
			? {
				label: 'Lock',
				onAction: onIncreaseLockAmount,
				isLoading: increaseLockAmountStatus.pending,
				isDisabled: isLockDisabled
			}
			: {
				label: 'Lock',
				onAction: onLock,
				isLoading: lockStatus.pending,
				isDisabled: isLockDisabled
			};

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 w-full'}>
				<h2 className={'m-0 text-2xl font-bold'}>
					{"YFI holders, time to Lock' ‘N Load"}
				</h2>
				<div className={'mt-6 text-neutral-600'} >
					<p >{'Lock your YFI to veYFI to:'}</p>
					<ul>
						<li className={'list-inside list-disc'}>{'Take part in Yearn governance.'}</li>
						<li className={'list-inside list-disc'}>{'Direct YFI rewards to Vaults.'}</li>
						<li className={'list-inside list-disc'}>{'Receive dYFI (the longer you lock, the more you keep).'}</li>
					</ul>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'mt-0 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'YFI'}
						amount={lockAmount}
						maxAmount={tokenBalance}
						onAmountChange={(amount): void => set_lockAmount(handleInputChangeEventValue(amount, 18))}
						onLegendClick={(): void => set_lockAmount(tokenBalance)}
						onMaxClick={(): void => set_lockAmount(tokenBalance)}
						legend={`Available: ${formatAmount(tokenBalance.normalized, 4)} YFI`}
						error={lockAmountError} />
					<AmountInput
						label={'Current lock period (weeks)'}
						amount={toNormalizedBN(isZero(toTime(lockTime)) ? '' : Math.floor(toTime(lockTime)).toString(), 0)}
						onAmountChange={(v: string): void => {
							const inputed = handleInputChangeEventValue(v, 0);
							if (Number(inputed.normalized) > MAX_LOCK_TIME + 1) {
								set_lockTime((MAX_LOCK_TIME + 1).toString());
							} else {
								set_lockTime(inputed.normalized.toString());
							}
						}}
						maxAmount={toNormalizedBN(MAX_LOCK_TIME + 1, 0)}
						onMaxClick={(): void => set_lockTime((MAX_LOCK_TIME + 1).toString())}
						disabled={hasLockedAmount}
						legend={'Minimum: 1 week'}
						error={lockTimeError} />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'Total veYFI'}
						amount={votingPower}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={txAction.onAction}
						isDisabled={txAction.isDisabled || txAction.isLoading}
						isBusy={txAction.isLoading}>
						{txAction.label}
					</Button>
				</div>
			</div>
		</div>
	);
}
