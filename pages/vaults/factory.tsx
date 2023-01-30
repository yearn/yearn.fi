import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Balancer from 'react-wrap-balancer';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useAsync} from '@react-hookz/web';
import VaultListFactory from '@vaults/components/list/VaultListFactory';
import VAULT_FACTORY_ABI from '@vaults/utils/abi/vaultFactory.abi';
import {createNewVaultsAndStrategies, estimateGasForCreateNewVaultsAndStrategies} from '@vaults/utils/actions/createVaultFromFactory';
import Wrapper from '@vaults/Wrapper';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import LinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {ERC20_ABI} from '@yearn-finance/web-lib/utils/abi';
import {addressZero, toAddress} from '@yearn-finance/web-lib/utils/address';
import {VAULT_FACTORY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {Dropdown} from '@common/components/GaugeDropdown';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {CurveContextApp, useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber, providers} from 'ethers';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TCurveGaugesFromYearn} from '@common/types/curves';
import type {TDropdownGaugeOption} from '@common/types/types';

type TGaugeDisplayData = {
	name: string,
	symbol: string,
	poolAddress: TAddress,
	gaugeAddress: TAddress
}

const	defaultOption: TDropdownGaugeOption = {
	label: '',
	value: {
		name: '',
		tokenAddress: addressZero,
		poolAddress: addressZero,
		gaugeAddress: addressZero,
		APY: 0
	}
};

function	Factory(): ReactElement {
	const {mutateVaultList} = useYearn();
	const {provider, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();
	const {gaugesFromYearn} = useCurve();
	const {toast} = yToast();
	const [selectedOption, set_selectedOption] = useState(defaultOption);
	const [hasError, set_hasError] = useState(false);
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	/* 🔵 - Yearn Finance ******************************************************
	** Only a vault for a gauge with no already created vault can be created.
	** This means we need to check, for all the gauges if we already have an
	** associated vault.
	**************************************************************************/
	const [{result: filteredGauges}, fetchGaugesAction] = useAsync(async function fetchAlreadyCreatedGauges(
		_provider: providers.JsonRpcProvider,
		_safeChainID: number,
		_gaugesFromYearn: TCurveGaugesFromYearn[]
	): Promise<TCurveGaugesFromYearn[]> {
		if ((_gaugesFromYearn || []).length === 0) {
			return [];
		}
		const	currentProvider = _safeChainID === 1 ? _provider || getProvider(1) : getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	curveVaultFactory = new Contract(VAULT_FACTORY_ADDRESS, VAULT_FACTORY_ABI);

		const calls = [];
		for (const gauge of _gaugesFromYearn) {
			calls.push(curveVaultFactory.canCreateVaultPermissionlessly(gauge.gauge_address));
		}
		const	canCreateVaults = await ethcallProvider.tryAll(calls) as boolean[];
		return _gaugesFromYearn.filter((_gauge: TCurveGaugesFromYearn, index: number): boolean => canCreateVaults[index]);
	}, []);

	useEffect((): void => {
		fetchGaugesAction.execute(provider, safeChainID, gaugesFromYearn);
	}, [fetchGaugesAction, gaugesFromYearn, provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** We need to create the possible elements for the dropdown by removing all
	** the extra impossible gauges and formating them to the expected
	** TDropdownGaugeOption type
	**************************************************************************/
	const	gaugesOptions = useMemo((): TDropdownGaugeOption[] => {
		return (
			(filteredGauges || [])
				.filter((item: TCurveGaugesFromYearn): boolean => item.weight !== '0')
				.map((gauge: TCurveGaugesFromYearn): TDropdownGaugeOption => ({
					label: gauge.gauge_name,
					icon: (
						<ImageWithFallback
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(gauge.lp_token)}/logo-128.png`}
							alt={gauge.gauge_name}
							width={36}
							height={36} />
					),
					value: {
						name: gauge.gauge_name,
						tokenAddress: toAddress(gauge.lp_token),
						poolAddress: toAddress(gauge.pool_address),
						gaugeAddress: toAddress(gauge.gauge_address),
						APY: gauge.apy.net_apy
					}
				})
				));
	}, [filteredGauges]);

	/* 🔵 - Yearn Finance ******************************************************
	** Name and symbol from the Curve API are not the one we want to display.
	** We need to fetch the name and symbol from the gauge contract.
	**************************************************************************/
	const [{result: gaugeDisplayData, status}, fetchGaugeDisplayDataAction] = useAsync(async function fetchGaugeDisplayData(
		_provider: providers.JsonRpcProvider,
		_safeChainID: number,
		_selectedOption: TDropdownGaugeOption
	): Promise<TGaugeDisplayData> {
		const currentProvider = _safeChainID === 1 ? _provider || getProvider(1) : getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const curveGauge = new Contract(toAddress(_selectedOption.value.gaugeAddress), ERC20_ABI);

		const calls = [curveGauge.name(), curveGauge.symbol()];
		const [name, symbol] = await ethcallProvider.tryAll(calls) as [string, string];
		return ({
			name: name.replace('Curve.fi', '').replace('Gauge Deposit', '') || _selectedOption.value.name,
			symbol: symbol.replace('-gauge', '').replace('-f', '') || _selectedOption.value.name,
			poolAddress: _selectedOption.value.poolAddress,
			gaugeAddress: _selectedOption.value.gaugeAddress
		});
	}, undefined);

	useEffect((): void => {
		fetchGaugeDisplayDataAction.execute(provider, safeChainID, selectedOption);
	}, [fetchGaugeDisplayDataAction, provider, safeChainID, selectedOption]);

	/* 🔵 - Yearn Finance ******************************************************
	** Perform a smartContract call to the ZAP contract to get the expected
	** out for a given in/out pair with a specific amount. This callback is
	** called every 10s or when amount/in or out changes.
	**************************************************************************/
	const fetchEstimate = useCallback(async (): Promise<BigNumber> => {
		set_hasError(false);
		try {
			return await estimateGasForCreateNewVaultsAndStrategies(provider, toAddress(selectedOption.value.gaugeAddress));
		} catch (error) {
			const	err = error as {reason: string, code: string};
			if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
				toast({type: 'warning', content: (err?.reason || '').replace('execution reverted: ', '')});
			} else {
				toast({type: 'error', content: (err?.reason || '').replace('execution reverted: ', '')});
				set_hasError(true);
			}
			return Zero;
		}
		//eslint-disable-next-line react-hooks/exhaustive-deps
	}, [provider, selectedOption?.value?.gaugeAddress]); //toast is a false negative error
	const	{data: estimate} = useSWR(
		'gasEstimate',
		(!isActive || selectedOption.value.gaugeAddress === addressZero || safeChainID !== 1) ? null : fetchEstimate,
		{shouldRetryOnError: false}
	);

	async function	onCreateNewVault(): Promise<void> {
		new Transaction(provider, createNewVaultsAndStrategies, set_txStatus).populate(
			selectedOption.value.gaugeAddress
		).onSuccess(async (): Promise<void> => {
			set_selectedOption(defaultOption);
			await setTimeout(async (): Promise<void> => {
				await Promise.all([
					fetchGaugesAction.execute(provider, safeChainID, gaugesFromYearn),
					mutateVaultList()
				]);
			}, 1000);
		}).perform();
	}

	return (
		<section>
			<div className={'mb-4 w-full bg-neutral-100 p-4 md:p-8'}>
				<div aria-label={'new vault card title'} className={'flex flex-col pb-8'}>
					<h2 className={'pb-4 text-3xl font-bold'}>{'Create new Vault'}</h2>
					<div className={'w-full md:w-7/12'}>
						<Balancer>
							<p>
								{'Deploy a new auto-compounding yVault for any Curve pool with an active liquidity gauge. All factory-deployed vaults have no management fees and a flat 10% performance fee. Permissionless finance just got permissionless-er. To learn more, check our '}
								<a
									href={'https://docs.yearn.finance/getting-started/products/yvaults/vault-factory'}
									target={'_blank'}
									className={'text-neutral-900 underline'}
									rel={'noreferrer'}>
									{'docs'}
								</a>
								{'.'}
							</p>
						</Balancer>
					</div>
				</div>

				<div aria-label={'Available Curve pools'} className={'flex flex-col pb-[52px]'}>
					<div className={'grid grid-cols-1 gap-x-0 gap-y-5 md:grid-cols-6 md:gap-x-8'}>
						<label className={'yearn--input relative z-10 col-span-2'}>
							<p className={'!text-neutral-600'}>{'Available Curve pools'}</p>
							<Dropdown
								placeholder={'Select Curve Pool'}
								options={gaugesOptions}
								selected={selectedOption}
								onSelect={set_selectedOption} />
						</label>

						<div className={'col-span-2 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Vault name'}</p>
							{status === 'loading' ? (
								<div className={'flex h-10 items-center bg-neutral-200 p-2 pl-5 text-neutral-600'}>
									<span className={'loader'} />
								</div>
							) : (
								<div className={'h-10 bg-neutral-200 p-2 text-neutral-600'}>
									{!gaugeDisplayData ? '' : `Curve ${gaugeDisplayData.name} Factory`}
								</div>
							)}
						</div>

						<div className={'col-span-2 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Symbol'}</p>
							{status === 'loading' ? (
								<div className={'flex h-10 items-center bg-neutral-200 p-2 pl-5 text-neutral-600'}>
									<span className={'loader'} />
								</div>
							) : (
								<div className={'h-10 bg-neutral-200 p-2 text-neutral-600'}>
									{!gaugeDisplayData ? '' : `yvCurve-${gaugeDisplayData.symbol}-f`}
								</div>
							)}
						</div>

						<div className={'col-span-3 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Pool address'}</p>
							{status === 'loading' ? (
								<div className={'flex h-10 items-center bg-neutral-200 p-2 pl-5 text-neutral-600'}>
									<span className={'loader'} />
								</div>
							) : (
								<div className={'flex h-10 flex-row items-center justify-between bg-neutral-200 p-2 font-mono'}>
									{gaugeDisplayData ? (
										<>
											<p className={'overflow-hidden text-ellipsis text-neutral-600'}>
												{gaugeDisplayData.poolAddress}
											</p>
											<a
												href={`${networks[1].explorerBaseURI}/address/${gaugeDisplayData.poolAddress}`}
												target={'_blank'}
												rel={'noreferrer'}
												className={'ml-4 cursor-pointer text-neutral-900'}>
												<LinkOut className={'h-6 w-6'} />
											</a>
										</>
									) : ''}
								</div>
							)}
						</div>
						<div className={'col-span-3 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Gauge address'}</p>

							{status === 'loading' ? (
								<div className={'flex h-10 items-center bg-neutral-200 p-2 pl-5 text-neutral-600'}>
									<span className={'loader'} />
								</div>
							) : (
								<div className={'flex h-10 flex-row items-center justify-between bg-neutral-200 p-2 font-mono'}>
									{gaugeDisplayData ? (
										<>
											<p className={'overflow-hidden text-ellipsis text-neutral-600'}>
												{gaugeDisplayData.gaugeAddress}
											</p>
											<a
												href={`${networks[1].explorerBaseURI}/address/${gaugeDisplayData.gaugeAddress}`}
												target={'_blank'}
												rel={'noreferrer'}
												className={'ml-4 cursor-pointer text-neutral-900'}>
												<LinkOut className={'h-6 w-6'} />
											</a>
										</>
									) : ''}
								</div>
							)}
						</div>

					</div>
				</div>

				<div aria-label={'actions'} className={'flex flex-row items-center space-x-6'}>
					<div>
						<Button
							onClick={onCreateNewVault}
							isBusy={txStatus.pending}
							disabled={!isActive || selectedOption.value.gaugeAddress === addressZero || safeChainID !== 1 || hasError}
							className={'w-full'}>
							{'Create new Vault'}
						</Button>
					</div>
					<div>
						<p className={'font-number text-xs'}>
							{`Est. gas ${formatAmount((formatBN(estimate)).toNumber(), 0, 0)}`}
						</p>
					</div>
				</div>
			</div>

			<VaultListFactory />
		</section>
	);
}


Factory.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return (
		<Wrapper router={router}>
			<CurveContextApp>
				{page}
			</CurveContextApp>
		</Wrapper>
	);
};

export default Factory;
