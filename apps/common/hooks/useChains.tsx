import {useMemo} from 'react';
import {useConnect} from 'wagmi';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';
import type {Chain} from '@wagmi/chains';

export function useChainOptions(chains: number[]): TMultiSelectOptionProps[] {
	const {connectors} = useConnect();

	const options = useMemo((): TMultiSelectOptionProps[] => {
		const injectedConnector = connectors.find((e): boolean => e.id.toLocaleLowerCase() === 'injected');
		if (!injectedConnector) {
			return [];
		}
		const noFork = injectedConnector.chains.filter(({id}): boolean => id !== 1337);
		const _options = [];
		for (const chain of noFork) {
			_options.push({
				label: chain.name,
				value: chain.id,
				isSelected: chains.includes(chain.id),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/${chain.id}/logo-128.png`}
						alt={chain.name}
						width={32}
						height={32}
					/>
				)
			});
		}
		return _options;
	}, [chains, connectors]);

	return options;
}

export function useSupportedChains(): Chain[] {
	const {connectors} = useConnect();

	return useMemo((): Chain[] => {
		const injectedConnector = connectors.find((e): boolean => e.id.toLocaleLowerCase() === 'injected');
		if (!injectedConnector) {
			return [];
		}
		const noFork = injectedConnector.chains.filter(({id}): boolean => id !== 1337);
		return noFork;
	}, [connectors]);
}
