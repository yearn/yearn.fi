import {useCallback, useMemo, useState} from 'react';
import {QueryParamProvider} from 'use-query-params';
import {VaultListFactory} from '@vaults/components/list/VaultListFactory';
import {YFACTORY_SUPPORTED_NETWORK} from '@vaults/constants';
import {VAULT_FACTORY_ABI} from '@vaults/utils/abi/vaultFactory.abi';
import {createNewVaultsAndStrategies, gasOfCreateNewVaultsAndStrategies} from '@vaults/utils/actions';
import {Wrapper} from '@vaults/Wrapper';
import {erc20ABI, multicall} from '@wagmi/core';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {VAULT_FACTORY_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBoolean, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {Dropdown} from '@common/components/GaugeDropdown';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {CurveContextApp, useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {NextQueryParamAdapter} from '@common/utils/QueryParamsProvider';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TCurveGaugeFromYearn, TCurveGaugesFromYearn} from '@common/schemas/curveSchemas';
import type {TDropdownGaugeOption} from '@common/types/types';

type TGaugeDisplayData = {
	name: string;
	symbol: string;
	poolAddress: TAddress;
	gaugeAddress: TAddress;
};

const defaultOption: TDropdownGaugeOption = {
	label: '',
	value: {
		name: '',
		tokenAddress: ZERO_ADDRESS,
		poolAddress: ZERO_ADDRESS,
		gaugeAddress: ZERO_ADDRESS,
		APY: 0
	}
};

function Factory(): ReactElement {
	const {mutateVaultList} = useYearn();
	const {provider, isActive} = useWeb3();
	const {gaugesFromYearn} = useCurve();
	const [filteredGauges, set_filteredGauges] = useState<TCurveGaugesFromYearn>([]);
	const [gaugeDisplayData, set_gaugeDisplayData] = useState<TGaugeDisplayData | undefined>(undefined);
	const [isLoadingGaugeDisplay, set_isLoadingGaugeDisplay] = useState(false);
	const [estimate, set_estimate] = useState(0n);
	const [selectedOption, set_selectedOption] = useState(defaultOption);
	const [hasError, set_hasError] = useState(false);
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Only a vault for a gauge with no already created vault can be created.
	 ** This means we need to check, for all the gauges if we already have an
	 ** associated vault.
	 **************************************************************************/
	const onRetriggerGaugesAction = useAsyncTrigger(async (): Promise<void> => {
		if (isZero((gaugesFromYearn || []).length)) {
			return set_filteredGauges([]);
		}

		const baseContract = {
			address: VAULT_FACTORY_ADDRESS,
			abi: VAULT_FACTORY_ABI
		};
		const calls = [];
		for (const gauge of gaugesFromYearn) {
			calls.push({
				...baseContract,
				functionName: 'canCreateVaultPermissionlessly',
				args: [toAddress(gauge.gauge_address)]
			});
		}
		const canCreateVaults = await multicall({
			contracts: calls,
			chainId: YFACTORY_SUPPORTED_NETWORK
		});
		set_filteredGauges(
			gaugesFromYearn.filter((_gauge: TCurveGaugeFromYearn, index: number): boolean =>
				decodeAsBoolean(canCreateVaults[index])
			)
		);
	}, [gaugesFromYearn]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** We need to create the possible elements for the dropdown by removing all
	 ** the extra impossible gauges and formating them to the expected
	 ** TDropdownGaugeOption type
	 **************************************************************************/
	const gaugesOptions = useMemo((): TDropdownGaugeOption[] => {
		return (filteredGauges || [])
			.filter((item: TCurveGaugeFromYearn): boolean => !isZero(item.weight))
			.map(
				(gauge: TCurveGaugeFromYearn): TDropdownGaugeOption => ({
					label: gauge.gauge_name,
					icon: (
						<ImageWithFallback
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(gauge.lp_token)}/logo-128.png`}
							alt={gauge.gauge_name}
							width={36}
							height={36}
						/>
					),
					value: {
						name: gauge.gauge_name,
						tokenAddress: toAddress(gauge.lp_token),
						poolAddress: toAddress(gauge.pool_address),
						gaugeAddress: toAddress(gauge.gauge_address),
						APY: gauge?.apy?.net_apy || 0
					}
				})
			);
	}, [filteredGauges]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Name and symbol from the Curve API are not the one we want to display.
	 ** We need to fetch the name and symbol from the gauge contract.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		set_isLoadingGaugeDisplay(true);
		const baseContract = {
			address: selectedOption.value.gaugeAddress,
			abi: erc20ABI
		};
		const results = await multicall({
			contracts: [
				{...baseContract, functionName: 'name'},
				{...baseContract, functionName: 'symbol'}
			],
			chainId: YFACTORY_SUPPORTED_NETWORK
		});

		const name = decodeAsString(results[0]);
		const symbol = decodeAsString(results[1]);
		set_gaugeDisplayData({
			name: name.replace('Curve.fi', '').replace('Gauge Deposit', '') || selectedOption.value.name,
			symbol: symbol.replace('-gauge', '').replace('-f', '') || selectedOption.value.name,
			poolAddress: selectedOption.value.poolAddress,
			gaugeAddress: selectedOption.value.gaugeAddress
		});
		set_isLoadingGaugeDisplay(false);
	}, [selectedOption]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Perform a smartContract call to the ZAP contract to get the expected
	 ** out for a given in/out pair with a specific amount.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		if (!isActive || toAddress(selectedOption.value.gaugeAddress) === ZERO_ADDRESS) {
			return;
		}

		set_hasError(false);
		try {
			set_estimate(
				await gasOfCreateNewVaultsAndStrategies({
					connector: provider,
					chainID: YFACTORY_SUPPORTED_NETWORK,
					contractAddress: VAULT_FACTORY_ADDRESS,
					gaugeAddress: selectedOption.value.gaugeAddress
				})
			);
		} catch (error) {
			const err = error as {reason: string; code: string};
			if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
				toast({
					type: 'warning',
					content: (err?.reason || '').replace('execution reverted: ', '')
				});
			} else {
				toast({
					type: 'error',
					content: (err?.reason || '').replace('execution reverted: ', '')
				});
				set_hasError(true);
			}
			set_estimate(0n);
		}
	}, [isActive, provider, selectedOption.value.gaugeAddress]);

	const onCreateNewVault = useCallback(async (): Promise<void> => {
		const result = await createNewVaultsAndStrategies({
			connector: provider,
			chainID: YFACTORY_SUPPORTED_NETWORK,
			contractAddress: VAULT_FACTORY_ADDRESS,
			gaugeAddress: selectedOption.value.gaugeAddress,
			statusHandler: set_txStatus
		});
		if (result.isSuccessful) {
			await setTimeout(async (): Promise<void> => {
				await Promise.all([onRetriggerGaugesAction(), mutateVaultList()]);
			}, 1000);
		}
	}, [onRetriggerGaugesAction, mutateVaultList, provider, selectedOption.value.gaugeAddress]);

	function loadingFallback(): ReactElement {
		return (
			<div className={'flex h-10 items-center bg-neutral-200 p-2 pl-5 text-neutral-600'}>
				<span className={'loader'} />
			</div>
		);
	}

	return (
		<section className={'pt-20'}>
			<div className={'mb-4 w-full bg-neutral-100 p-4 md:p-8'}>
				<div
					aria-label={'new vault card title'}
					className={'flex flex-col pb-8'}>
					<h2 className={'pb-4 text-3xl font-bold'}>{'Create new Vault'}</h2>
					<div className={'w-full md:w-7/12'}>
						<p>
							{
								'Deploy a new auto-compounding yVault for any Curve pool with an active liquidity gauge. All factory-deployed vaults have no management fees and a flat 10% performance fee. Permissionless finance just got permissionless-er. To learn more, check our '
							}
							<a
								href={'https://docs.yearn.fi/getting-started/products/yvaults/vault-factory'}
								target={'_blank'}
								className={'text-neutral-900 underline'}
								rel={'noreferrer'}>
								{'docs'}
							</a>
							{'.'}
						</p>
					</div>
				</div>

				<div
					aria-label={'Available Curve pools'}
					className={'flex flex-col pb-[52px]'}>
					<div className={'grid grid-cols-1 gap-x-0 gap-y-5 md:grid-cols-6 md:gap-x-8'}>
						<label className={'yearn--input relative z-10 col-span-2'}>
							<p className={'!text-neutral-600'}>{'Available Curve pools'}</p>
							<Dropdown
								placeholder={'Select Curve Pool'}
								options={gaugesOptions}
								selected={selectedOption}
								onSelect={set_selectedOption}
							/>
						</label>

						<div className={'col-span-2 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Vault name'}</p>
							<Renderable
								shouldRender={!isLoadingGaugeDisplay}
								fallback={loadingFallback()}>
								<div className={'h-10 bg-neutral-200 p-2 text-neutral-600'}>
									{!gaugeDisplayData?.name ? '' : `Curve ${gaugeDisplayData.name} Factory`}
								</div>
							</Renderable>
						</div>

						<div className={'col-span-2 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Symbol'}</p>
							<Renderable
								shouldRender={!isLoadingGaugeDisplay}
								fallback={loadingFallback()}>
								<div className={'h-10 bg-neutral-200 p-2 text-neutral-600'}>
									{!gaugeDisplayData?.symbol ? '' : `yvCurve-${gaugeDisplayData.symbol}-f`}
								</div>
							</Renderable>
						</div>

						<div className={'col-span-3 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Pool address'}</p>
							<Renderable
								shouldRender={!isLoadingGaugeDisplay}
								fallback={loadingFallback()}>
								<div
									className={
										'flex h-10 flex-row items-center justify-between bg-neutral-200 p-2 font-mono'
									}>
									<Renderable shouldRender={!!gaugeDisplayData}>
										<p className={'overflow-hidden text-ellipsis text-neutral-600'}>
											{!gaugeDisplayData?.poolAddress ||
											isZeroAddress(gaugeDisplayData?.poolAddress)
												? '-'
												: toAddress(gaugeDisplayData?.poolAddress)}
										</p>
										<a
											href={`${getNetwork(YFACTORY_SUPPORTED_NETWORK)
												?.defaultBlockExplorer}/address/${toAddress(
												gaugeDisplayData?.poolAddress
											)}`}
											target={'_blank'}
											rel={'noreferrer'}
											className={'ml-4 cursor-pointer text-neutral-900'}>
											<IconLinkOut className={'h-6 w-6'} />
										</a>
									</Renderable>
								</div>
							</Renderable>
						</div>
						<div className={'col-span-3 w-full space-y-1'}>
							<p className={'text-neutral-600'}>{'Gauge address'}</p>
							<Renderable
								shouldRender={!isLoadingGaugeDisplay}
								fallback={loadingFallback()}>
								<div
									className={
										'flex h-10 flex-row items-center justify-between bg-neutral-200 p-2 font-mono'
									}>
									<Renderable shouldRender={!!gaugeDisplayData}>
										<p className={'overflow-hidden text-ellipsis text-neutral-600'}>
											{!gaugeDisplayData?.gaugeAddress ||
											isZeroAddress(gaugeDisplayData?.gaugeAddress)
												? '-'
												: toAddress(gaugeDisplayData?.gaugeAddress)}
										</p>
										<a
											href={`${getNetwork(YFACTORY_SUPPORTED_NETWORK)
												?.defaultBlockExplorer}/address/${toAddress(
												gaugeDisplayData?.gaugeAddress
											)}`}
											target={'_blank'}
											rel={'noreferrer'}
											className={'ml-4 cursor-pointer text-neutral-900'}>
											<IconLinkOut className={'h-6 w-6'} />
										</a>
									</Renderable>
								</div>
							</Renderable>
						</div>
					</div>
				</div>

				<div
					aria-label={'actions'}
					className={'flex flex-row items-center space-x-6'}>
					<div>
						<Button
							onClick={onCreateNewVault}
							isBusy={txStatus.pending}
							isDisabled={!isActive || selectedOption.value.gaugeAddress === ZERO_ADDRESS || hasError}
							className={'w-full'}>
							{'Create new Vault'}
						</Button>
					</div>
					<div>
						<p className={'font-number text-xs'}>{`Est. gas ${formatAmount(Number(estimate), 0, 0)}`}</p>
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
				<QueryParamProvider
					adapter={NextQueryParamAdapter}
					options={{removeDefaultsFromUrl: true}}>
					{page}
				</QueryParamProvider>
			</CurveContextApp>
		</Wrapper>
	);
};

export default Factory;
