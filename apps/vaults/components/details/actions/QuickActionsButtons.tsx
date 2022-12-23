import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';
import {getEthZapperContract} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import {DefaultTNormalizedBN} from '@common/utils';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import type {TNormalizedBN} from '@common/types/types';

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {refresh} = useWallet();
	const {isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);
	const [allowanceFrom, set_allowanceFrom] = useState<TNormalizedBN>();
	const {
		selectedOptionFrom, selectedOptionTo,
		amount, onChangeAmount,
		maxDepositPossible, isDepositing
	} = useActionFlow();
	const {onApprove, onExecuteDeposit, onExecuteWithdraw, currentSolver} = useSolver();
	const retrieveAllowance = useAllowanceFetcher();

	const shouldUseVanillaAllowance = [Solver.VANILLA, Solver.CHAIN_COIN, Solver.PARTNER_CONTRACT].includes(currentSolver);
	const isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
	const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
	const canInteract = isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo;

	const spender = useMemo((): TAddress => {
		if (currentSolver === Solver.CHAIN_COIN && isOutputTokenEth) {
			return (toAddress(getEthZapperContract(safeChainID)));
		} else if (currentSolver === Solver.PARTNER_CONTRACT) {
			return (toAddress(networks?.[safeChainID]?.partnerContractAddress));
		}
		return (toAddress(selectedOptionTo?.value));
	}, [currentSolver, isOutputTokenEth, networks, safeChainID, selectedOptionTo?.value]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: vanillAllowanceFrom, isLoading: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		canInteract && !isInputTokenEth && shouldUseVanillaAllowance ?
		[selectedOptionFrom, spender] as TAllowanceFetcher : null,
		retrieveAllowance,
		{revalidateOnFocus: false}
	);

	useEffect((): void => {
		if (shouldUseVanillaAllowance && vanillAllowanceFrom) {
			set_allowanceFrom(vanillAllowanceFrom);
		}
	}, [vanillAllowanceFrom, shouldUseVanillaAllowance]);

	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount(DefaultTNormalizedBN);
		await refresh();
	}, [onChangeAmount, refresh]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		onApprove(
			set_txStatusApprove,
			async (): Promise<void> => {
				if (currentSolver === Solver.COWSWAP) {
					set_allowanceFrom({
						raw: ethers.constants.MaxUint256,
						normalized: Infinity
					});
				} else {
					await mutateAllowance();
				}
			}
		);
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	** the selected vault.
	**************************************************************************/
	async function	onDepositToVault(): Promise<void> {
		onExecuteDeposit(
			set_txStatusDeposit,
			async (): Promise<void> => {
				await onSuccess();
			}
		);
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the vault contract to take back
	** some underlying token from this specific vault.
	**************************************************************************/
	async function	onWithdrawShares(): Promise<void> {
		onExecuteWithdraw(
			set_txStatusDeposit,
			async (): Promise<void> => {
				await onSuccess();
			}
		);
	}
	
	/* 🔵 - Yearn Finance ******************************************************
	** Wrapper to decide if we should use the partner contract or not
	**************************************************************************/
	function	onDepositOrWithdraw(): void {
		if (isDepositing) {
			onDepositToVault();
		} else {
			onWithdrawShares();
		}
	}

	console.warn(currentSolver);
	if (
		(currentSolver === Solver.VANILLA && (isDepositing &&( txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0))))
		|| (currentSolver === Solver.COWSWAP && (txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0)))
		|| (currentSolver === Solver.CHAIN_COIN && (!isDepositing && (txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0))))
		|| (currentSolver === Solver.PARTNER_CONTRACT && ((txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0))))
	) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	return (
		<Button
			onClick={onDepositOrWithdraw}
			className={'w-full'}
			isBusy={txStatusDeposit.pending}
			isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}>
			{isDepositing ? 'Deposit' : 'Withdraw'}
		</Button>
	);

}

export default VaultDetailsQuickActionsButtons;