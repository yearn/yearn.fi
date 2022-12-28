import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import VEYFI_ABI from '@veYFI/utils/abi/veYFI.abi';
import VEYFI_POSITION_HELPER_ABI from '@veYFI/utils/abi/veYFIPositionHelper.abi';
import {toMilliseconds} from '@veYFI/utils/time';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TVotingEscrow = {
	address: string,
	token: string,
	name: string,
	symbol: string,
	decimals: number,
	supply: string,
	rewardPool: string,
}

export type TPosition = {
	balance: string,
	underlyingBalance: string,
}

export type TVotingEscrowPosition = {
	deposit?: TPosition,
	// yield?: TPosition,
	unlockTime?: number,
	penalty?: string,
	// penaltyRatio?: number;
}

export type	TVotingEscrowContext = {
	votingEscrow: TVotingEscrow | undefined,
	positions: TVotingEscrowPosition | undefined,
	allowances: TDict<string>,
	isLoading: boolean,
	refresh: () => void,
}
const defaultProps: TVotingEscrowContext = {
	votingEscrow: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	refresh: (): void => {}
};

const	VotingEscrowContext = createContext<TVotingEscrowContext>(defaultProps);
export const VotingEscrowContextApp = memo(function VotingEscrowContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address, isActive} = useWeb3();

	// TODO: add to constants
	const veYFIAddress = '0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5';
	const veYFIPositionHelper = '0x5A70cD937bA3Daec8188E937E243fFa43d6ECbe8';
	const yfiAddress = '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e';

	const assetFetcher = useCallback(async (): Promise<TVotingEscrow> => {
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIContract = new Contract(veYFIAddress, VEYFI_ABI);

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
		]) as [string, string, string, number, BigNumber, string];
		
		return ({
			address: veYFIAddress,
			token,
			name,
			symbol,
			decimals,
			supply: supply.toString(),
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
		const veYFIPositionHelperContract = new Contract(veYFIPositionHelper, VEYFI_POSITION_HELPER_ABI);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const [positionDetails] = await ethcallProvider.tryAll([veYFIPositionHelperContract.getPositionDetails(address)]) as [any];
		
		const depositPosition: TPosition = {
			balance: (positionDetails.balance as BigNumber).toString(),
			underlyingBalance: (positionDetails.depositAmount as BigNumber).toString()
		};

		return {
			deposit: depositPosition,
			unlockTime: toMilliseconds((positionDetails.unlockTime as BigNumber).toNumber()),
			penalty: (positionDetails.penalty as BigNumber).toString()
			// penaltyRatio: ,
		};
	}, [isActive, address]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'positions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<string>> => {
		if (!isActive || !address) {
			return {};
		}
		const	currentProvider = getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	yfiContract = new Contract(yfiAddress, ERC20_ABI);

		const	[yfiAllowanceVeYFI] = await ethcallProvider.tryAll([yfiContract.allowance(address, veYFIAddress)]) as BigNumber[];

		return ({
			[allowanceKey(yfiAddress, veYFIAddress)]: yfiAllowanceVeYFI.toString()
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