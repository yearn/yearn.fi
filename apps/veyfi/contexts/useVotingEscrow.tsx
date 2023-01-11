import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import {FixedNumber} from 'ethers';
import useSWR from 'swr';
import VEYFI_ABI from '@veYFI/utils/abi/veYFI.abi';
import VEYFI_POSITION_HELPER_ABI from '@veYFI/utils/abi/veYFIPositionHelper.abi';
import {VEYFI_ADDRESS, VEYFI_POSITION_HELPER_ADDRESS, YFI_ADDRESS} from '@veYFI/utils/constants';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {toMilliseconds} from '@yearn-finance/web-lib/utils/time';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TVotingEscrow = {
	address: TAddress,
	token: TAddress,
	name: string,
	symbol: string,
	decimals: number,
	supply: BigNumber,
	rewardPool: TAddress,
}

export type TPosition = {
	balance: BigNumber,
	underlyingBalance: BigNumber,
}

export type TVotingEscrowPosition = {
	deposit?: TPosition,
	// yield?: TPosition,
	unlockTime?: TMilliseconds,
	penalty?: BigNumber,
	penaltyRatio?: number,
	withdrawable?: BigNumber,
}

export type	TVotingEscrowContext = {
	votingEscrow: TVotingEscrow | undefined,
	positions: TVotingEscrowPosition | undefined,
	allowances: TDict<BigNumber>,
	isLoading: boolean,
	refresh: () => void,
}
const defaultProps: TVotingEscrowContext = {
	votingEscrow: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const	VotingEscrowContext = createContext<TVotingEscrowContext>(defaultProps);
export const VotingEscrowContextApp = memo(function VotingEscrowContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address, isActive} = useWeb3();

	const assetFetcher = useCallback(async (): Promise<TVotingEscrow> => {
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIContract = new Contract(VEYFI_ADDRESS, VEYFI_ABI);

		const	[
			token,
			name,
			symbol,
			decimals,
			supply,
			rewardPool
		] = await ethcallProvider.tryAll([
			veYFIContract.token(),
			veYFIContract.name(),
			veYFIContract.symbol(),
			veYFIContract.decimals(),
			veYFIContract.supply(),
			veYFIContract.reward_pool()
		]) as [TAddress, string, string, number, BigNumber, TAddress];

		return ({
			address: VEYFI_ADDRESS,
			token,
			name,
			symbol,
			decimals,
			supply,
			rewardPool
		});
	}, []);
	const {data: votingEscrow, mutate: refreshVotingEscrow, isLoading: isLoadingVotingEscrow} = useSWR('asset', assetFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TVotingEscrowPosition> => {
		if (!isActive || !address) {
			return {};
		}
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIPositionHelperContract = new Contract(VEYFI_POSITION_HELPER_ADDRESS, VEYFI_POSITION_HELPER_ABI);

		const [positionDetails] = await ethcallProvider.tryAll([veYFIPositionHelperContract.getPositionDetails(address)]) as [{balance: BigNumber, depositAmount: BigNumber, unlockTime: BigNumber, penalty: BigNumber, withdrawable: BigNumber}];

		const depositPosition: TPosition = {
			balance: positionDetails.balance,
			underlyingBalance: positionDetails.depositAmount
		};

		return {
			deposit: depositPosition,
			unlockTime: toMilliseconds(positionDetails.unlockTime.toNumber()),
			penalty: positionDetails.penalty,
			penaltyRatio: positionDetails.depositAmount.gt(0) ? FixedNumber.from(positionDetails.penalty).divUnsafe(FixedNumber.from(positionDetails.depositAmount)).toUnsafeFloat() : 0,
			withdrawable: positionDetails.withdrawable
		};
	}, [isActive, address]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'positions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !address) {
			return {};
		}
		const	currentProvider = getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	yfiContract = new Contract(YFI_ADDRESS, ERC20_ABI);

		const	[yfiAllowanceVeYFI] = await ethcallProvider.tryAll([yfiContract.allowance(address, VEYFI_ADDRESS)]) as BigNumber[];

		return ({
			[allowanceKey(YFI_ADDRESS, VEYFI_ADDRESS)]: yfiAllowanceVeYFI
		});
	}, [isActive, address]);
	const	{data: allowances, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(isActive && provider ? 'allowances' : null, allowancesFetcher, {shouldRetryOnError: false});

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPositions();
		refreshAllowances();
	}, [refreshVotingEscrow, refreshPositions, refreshAllowances]);

	const contextValue = useMemo((): TVotingEscrowContext => ({
		votingEscrow,
		positions,
		allowances: allowances ?? {},
		isLoading: isLoadingVotingEscrow && isLoadingPositions && isLoadingAllowances,
		refresh
	}), [votingEscrow, positions, allowances, isLoadingVotingEscrow, isLoadingPositions, isLoadingAllowances, refresh]);

	return (
		<VotingEscrowContext.Provider value={contextValue}>
			{children}
		</VotingEscrowContext.Provider>
	);
});

export const useVotingEscrow = (): TVotingEscrowContext => useContext(VotingEscrowContext);
export default useVotingEscrow;
