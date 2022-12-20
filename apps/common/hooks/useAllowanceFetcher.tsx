import {useCallback, useMemo} from 'react';
import {ethers} from 'ethers';
import {getEthZapperContract} from '@vaults/utils';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TAllowanceFetcher = [
	inputToken: TDropdownOption,
	outputToken: TDropdownOption
]

export function	useAllowanceFetcher(): (args: TAllowanceFetcher) => Promise<TNormalizedBN> {
	const {networks} = useSettings();
	const {address, provider} = useWeb3();
	const {chainID, safeChainID} = useChainID();
	
	const isPartnerAddressValid = useMemo((): boolean => (
		!isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress))
	), [networks, safeChainID]);

	const isUsingPartnerContract = useMemo((): boolean => (
		(process?.env?.SHOULD_USE_PARTNER_CONTRACT || true) === true && isPartnerAddressValid
	), [isPartnerAddressValid]);

	const retrieveAllowance = useCallback(async (args: TAllowanceFetcher): Promise<TNormalizedBN> => {
		const	[inputToken, outputToken] = args;
		const	isOutputTokenEth = toAddress(outputToken.value) === ETH_TOKEN_ADDRESS;
		const	currentProvider = provider || getProvider(safeChainID);
		const	contract = new ethers.Contract(
			toAddress(inputToken.value),
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			currentProvider
		);

		let	spender = toAddress(outputToken.value);
		if (isUsingPartnerContract) {
			spender = toAddress(networks?.[safeChainID]?.partnerContractAddress);
		}
		if (isOutputTokenEth) {
			spender = toAddress(getEthZapperContract(chainID));
		}

		try {
			const	tokenAllowance = await contract.allowance(address, spender) || ethers.constants.Zero;
			const	effectiveAllowance = ({
				raw: tokenAllowance,
				normalized: formatToNormalizedValue(tokenAllowance || ethers.constants.Zero, outputToken.decimals)
			});
			return effectiveAllowance;
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
	}, [address, chainID, isUsingPartnerContract, networks, provider, safeChainID]);

	return retrieveAllowance;
}