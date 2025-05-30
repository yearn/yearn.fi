import {useConnect} from 'wagmi';
import {retrieveConfig} from '@lib/utils/wagmi';
import {useCustomCompareMemo, useDeepCompareMemo} from '@react-hookz/web';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {Chain} from 'viem';
import type {Connector} from 'wagmi';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

export function useChainOptions(chains: number[] | null): TMultiSelectOptionProps[] {
	const {connectors} = useConnect();

	const injectedChains = useCustomCompareMemo(
		(): Chain[] | undefined => {
			connectors; //Hard trigger re-render when connectors change
			const config = retrieveConfig();
			const noFork = config.chains.filter(({id}): boolean => id !== 1337);
			return noFork;
		},
		[connectors as any],
		(savedDeps: [Connector[]], deps: [Connector[]]): boolean => {
			for (const savedDep of savedDeps[0]) {
				if (!deps[0].find((dep): boolean => dep.id === savedDep.id)) {
					return false;
				}
			}
			return true;
		}
	);

	const options = useDeepCompareMemo((): TMultiSelectOptionProps[] => {
		const _options = [];
		for (const chain of injectedChains || []) {
			_options.push({
				label: chain.name,
				value: chain.id,
				isSelected: chains?.includes(chain.id) || false,
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
	}, [injectedChains, chains]);

	return options;
}
