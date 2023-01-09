import {useEffect, useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import {getVotingPower} from '@veYFI/utils';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {MAX_LOCK_TIME, MIN_LOCK_AMOUNT, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {validateAllowance, validateAmount, validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {DefaultTNormalizedBN, toNormalizedBN} from '@common/utils';

import {AmountInput} from '../../common/components/AmountInput';

import type {BigNumber, ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

function LockTab(): ReactElement {
	const [lockAmount, set_lockAmount] = useState(DefaultTNormalizedBN);
	const [lockTime, set_lockTime] = useState('');
	const {provider, address, isActive, chainID} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, allowances, isLoading: isLoadingVotingEscrow, refresh: refreshVotingEscrow} = useVotingEscrow();
	const tokenBalance = useBalance(toAddress(votingEscrow?.token));
	const clearLockAmount = (): void => set_lockAmount(DefaultTNormalizedBN);
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const onTxSuccess = (): unknown => Promise.all([refreshData(), clearLockAmount()]);
	const [approveLock, approveLockStatus] = useTransaction(VotingEscrowActions.approveLock, refreshData);
	const [lock, lockStatus] = useTransaction(VotingEscrowActions.lock, onTxSuccess);
	const [increaseLockAmount, increaseLockAmountStatus] = useTransaction(VotingEscrowActions.increaseLockAmount, onTxSuccess);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const hasLockedAmount = formatBN(positions?.deposit?.balance).gt(0);
	
	const unlockTime = useMemo((): TMilliseconds => {
		return positions?.unlockTime || Date.now() + fromWeeks(toTime(lockTime));
	}, [positions?.unlockTime, lockTime]);

	const votingPower = useMemo((): BigNumber => {
		return getVotingPower(formatBN(positions?.deposit?.underlyingBalance).add(lockAmount.raw),  unlockTime);
	}, [positions?.deposit?.underlyingBalance, lockAmount, unlockTime]);

	useEffect((): void => {
		if(!positions?.unlockTime) {
			return;
		}
		set_lockTime(toWeeks(getTimeUntil(positions.unlockTime), false).toString());
	}, [positions?.unlockTime]);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: toAddress(votingEscrow?.token),
		spenderAddress: toAddress(votingEscrow?.address),
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

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: chainID});
	
	const executeApprove = (): void => {
		if (!votingEscrow || !userAddress) {
			return;
		}
		approveLock(web3Provider, userAddress, votingEscrow.token, votingEscrow.address);
	};
	
	const executeLock = (): void => {
		if (!votingEscrow  || !userAddress) {
			return;
		}
		lock(web3Provider, userAddress, votingEscrow.address, lockAmount.raw, toSeconds(unlockTime));
	};
	
	const executeIncreaseLockAmount = (): void => {
		if (!votingEscrow  || !userAddress) {
			return;
		}
		increaseLockAmount(web3Provider, userAddress, votingEscrow.address, lockAmount.raw);
	};

	const txAction = !isApproved
		? {
			label: 'Approve',
			onAction: executeApprove,
			isLoading: approveLockStatus.loading,
			isDisabled: !isActive || !isValidNetwork || isApproved || isLoadingVotingEscrow
		}
		: hasLockedAmount
			? {
				label: 'Lock',
				onAction: executeIncreaseLockAmount,
				isLoading: increaseLockAmountStatus.loading,
				isDisabled: !isActive || !isValidNetwork || !isApproved || !isValidLockAmount || !isValidLockTime || isLoadingVotingEscrow
			}
			: {
				label: 'Lock',
				onAction: executeLock,
				isLoading: lockStatus.loading,
				isDisabled: !isActive || !isValidNetwork || !isApproved || !isValidLockAmount || !isValidLockTime || isLoadingVotingEscrow
			};

	return ( 
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 w-full'}>
				<h2 className={'m-0 text-2xl font-bold'}>
					{"YFI holders, time to Lock' ‘N Load"}
				</h2>
				<div className={'mt-6 text-neutral-600'} >
					<p >{'Lock your YFI for veYFI to take part in Yearn governance.'}</p>
					<br />
					<p>{'Please note, governance is currently the only use for veYFI until the full platform launches ‘soon’. Stay tuned anon.'}</p>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'mt-0 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'YFI'}
						amount={lockAmount.normalized}
						onAmountChange={(amount): void => set_lockAmount(toNormalizedBN(amount, 18))}
						maxAmount={tokenBalance.normalized > 0 ? tokenBalance.normalized.toFixed(18) : ''}
						legend={`Available: ${formatAmount(tokenBalance.normalized, 4)} YFI`}
						error={lockAmountError}
					/>
					<AmountInput
						label={'Current lock period (weeks)'}
						amount={toTime(lockTime) === 0 ? '' : Math.floor(toTime(lockTime)).toString()}
						onAmountChange={set_lockTime}
						maxAmount={(MAX_LOCK_TIME + 1).toString()}
						disabled={hasLockedAmount}
						legend={'min 1'}
						error={lockTimeError}
					/>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'Total veYFI'}
						amount={formatUnits(votingPower, 18)}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={txAction.onAction}
						isDisabled={txAction.isDisabled || txAction.isLoading}
						isBusy={txAction.isLoading}
					>
						{txAction.label}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {LockTab};
