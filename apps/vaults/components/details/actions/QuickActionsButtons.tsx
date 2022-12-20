import React, {useCallback} from 'react';
import {ethers} from 'ethers';
import {SolverChainCoin} from '@vaults/components/details/actions/solversButtons/SolverChainCoin';
import {SolverCowswap} from '@vaults/components/details/actions/solversButtons/SolverCowswap';
import {SolverPartnerContract} from '@vaults/components/details/actions/solversButtons/SolverPartnerContract';
import {SolverVanilla} from '@vaults/components/details/actions/solversButtons/SolverVanilla';
import {Solvers, useQuickAction} from '@vaults/components/VaultDetailsQuickActions';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {refresh} = useWallet();
	const {
		currentSolver,
		currentVault,
		selectedOptionFrom, selectedOptionTo,
		amount, onChangeAmount,
		maxDepositPossible, isDepositing
	} = useQuickAction();

	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount({raw: ethers.constants.Zero, normalized: 0});
		await refresh();
	}, [onChangeAmount, refresh]);
	
	if (currentSolver === Solvers.COWSWAP) {
		return (
			<SolverCowswap
				isDepositing={isDepositing}
				amount={amount}
				maxDepositPossible={maxDepositPossible}
				selectedOptionFrom={selectedOptionFrom}
				selectedOptionTo={selectedOptionTo}
				onSuccess={onSuccess} />
		);
	}
	if (currentSolver === Solvers.CHAIN_COIN) {
		return (
			<SolverChainCoin
				isDepositing={isDepositing}
				amount={amount}
				maxDepositPossible={maxDepositPossible}
				selectedOptionFrom={selectedOptionFrom}
				selectedOptionTo={selectedOptionTo}
				onSuccess={onSuccess} />
		);
	} else if (currentSolver === Solvers.PARTNER_CONTRACT) {
		return (
			<SolverPartnerContract
				destinationVault={toAddress(currentVault.address)}
				amount={amount}
				maxDepositPossible={maxDepositPossible}
				selectedOptionFrom={selectedOptionFrom}
				selectedOptionTo={selectedOptionTo}
				onSuccess={onSuccess} />
		);
	}
	return (
		<SolverVanilla
			isDepositing={isDepositing}
			amount={amount}
			maxDepositPossible={maxDepositPossible}
			selectedOptionFrom={selectedOptionFrom}
			selectedOptionTo={selectedOptionTo}
			onSuccess={onSuccess} />
	);
}

export default VaultDetailsQuickActionsButtons;