import {useEffect, useState} from 'react';
import {erc20Abi} from 'viem';
import {useBlockNumber} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {
	cl,
	decodeAsAddress,
	decodeAsBigInt,
	decodeAsNumber,
	decodeAsString,
	formatUSD,
	isZero,
	isZeroAddress,
	toAddress,
	toBigInt,
	toNormalizedBN,
	zeroNormalizedBN
} from '@builtbymom/web3/utils';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {VAULT_V3_ABI} from '@vaults/utils/abi/vaultV3.abi';
import {VEYFI_GAUGE_ABI} from '@vaults/utils/abi/veYFIGauge.abi.ts';
import {readContracts} from '@wagmi/core';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {Counter} from '@common/components/Counter';
import {RenderAmount} from '@common/components/RenderAmount';
import {useYearn} from '@common/contexts/useYearn';
import {useYearnTokenPrice} from '@common/hooks/useYearnTokenPrice';
import {IconQuestion} from '@common/icons/IconQuestion';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

type TVaultHeaderLineItemProps = {
	label: string;
	children: ReactElement | string;
	legend?: ReactElement | string;
};

function VaultHeaderLineItem({label, children, legend}: TVaultHeaderLineItemProps): ReactElement {
	return (
		<div
			className={
				'flex flex-col items-center justify-center space-y-1 overflow-hidden md:space-y-2 md:overflow-visible'
			}>
			<p className={'text-center text-xs text-neutral-900/70'}>{label}</p>
			<b
				className={'font-number text-base md:text-3xl'}
				suppressHydrationWarning>
				{children}
			</b>
			<legend
				className={'font-number whitespace-nowrap text-center text-xs text-neutral-900/70'}
				suppressHydrationWarning>
				{legend ? legend : '\u00A0'}
			</legend>
		</div>
	);
}

function VaultAPR({apr}: {apr: TYDaemonVault['apr']}): ReactElement {
	const extraAPR = apr.extra.stakingRewardsAPR + apr.extra.gammaRewardAPR;
	const monthlyAPR = apr.points.monthAgo;
	const weeklyAPR = apr.points.weekAgo;
	const netAPR = apr.netAPR + extraAPR;
	const currentAPR = apr.forwardAPR.netAPR + extraAPR;

	if (apr.forwardAPR.type === '' && extraAPR === 0) {
		return (
			<VaultHeaderLineItem label={'Historical APR'}>
				<RenderAmount
					value={apr.netAPR + extraAPR}
					symbol={'percent'}
					decimals={6}
				/>
			</VaultHeaderLineItem>
		);
	}

	if (apr.forwardAPR.type === '' && extraAPR !== 0) {
		const boostedAPR = apr.netAPR + extraAPR;
		return (
			<VaultHeaderLineItem
				label={'Historical APR'}
				legend={
					<span className={'tooltip'}>
						<div className={'flex flex-row items-center space-x-2'}>
							<div>
								{'Est. APR: '}
								<RenderAmount
									shouldHideTooltip={boostedAPR === 0}
									value={boostedAPR}
									symbol={'percent'}
									decimals={6}
								/>
							</div>
							<IconQuestion className={'hidden md:block'} />
						</div>
						<span className={'tooltipLight top-full mt-2'}>
							<div
								className={
									'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
								}>
								<p
									className={
										'font-number flex w-full flex-row justify-between text-wrap text-left text-neutral-400 md:w-80 md:text-xs'
									}>
									{'Estimated APR for the next period based on current data.'}
								</p>
								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap py-1 text-neutral-400 md:text-xs'
									}>
									<p>{'• Base APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={apr.netAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Rewards APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={extraAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>
							</div>
						</span>
					</span>
				}>
				<Renderable
					shouldRender={!apr?.type.includes('new')}
					fallback={'New'}>
					<RenderAmount
						value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</VaultHeaderLineItem>
		);
	}

	return (
		<VaultHeaderLineItem
			label={'Historical APR'}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>
							{'Est. APR: '}
							<RenderAmount
								value={isZero(currentAPR) ? netAPR : currentAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</div>
						<IconQuestion className={'hidden md:block'} />
					</div>
					<span className={'tooltipLight top-full mt-2'}>
						<div
							className={
								'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<p
								className={
									'font-number flex w-full flex-row justify-between text-wrap text-left text-neutral-400 md:w-80 md:text-xs'
								}>
								{'Estimated APR for the next period based on current data.'}
							</p>
							<div
								className={
									'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap py-1 text-neutral-400 md:text-xs'
								}>
								<p>{'• Base APR '}</p>
								<RenderAmount
									shouldHideTooltip
									value={isZero(currentAPR) ? netAPR : currentAPR}
									symbol={'percent'}
									decimals={6}
								/>
							</div>

							<div
								className={
									'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
								}>
								<p>{'• Rewards APR '}</p>
								<p>{'N/A'}</p>
							</div>
						</div>
					</span>
				</span>
			}>
			<Renderable
				shouldRender={!apr?.type.includes('new')}
				fallback={'New'}>
				<RenderAmount
					value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
					symbol={'percent'}
					decimals={6}
				/>
			</Renderable>
		</VaultHeaderLineItem>
	);
}

/**************************************************************************************************
 ** TVLInVault will render a block of two values: the total value locked in the vault along with
 ** the value of the vault in USD.
 *************************************************************************************************/
function TVLInVault(props: {tokenSymbol: string; tvl: number; totalAssets: bigint; decimals: number}): ReactElement {
	return (
		<VaultHeaderLineItem
			label={`Total deposited, ${props.tokenSymbol || 'tokens'}`}
			legend={formatUSD(props.tvl)}>
			<Counter
				value={toNormalizedBN(props.totalAssets, props.decimals).normalized}
				decimals={props.decimals}
				decimalsToDisplay={[2, 6, 8, 10, 12]}
			/>
		</VaultHeaderLineItem>
	);
}

/**************************************************************************************************
 ** ValueInVaultAsToken will render a block of two values: the value of token we can redeem from
 ** the vault based on the amount of yvToken deposited, along with the value of the token in USD.
 *************************************************************************************************/
function ValueInVaultAsToken(props: {
	currentVault: TYDaemonVault;
	vaultPrice: number;
	valueInToken: TNormalizedBN;
}): ReactElement {
	return (
		<VaultHeaderLineItem
			label={`Value in ${props.currentVault.token.symbol || 'tokens'}`}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>
							{`$`}
							<Counter
								value={props.valueInToken.normalized * props.vaultPrice}
								decimals={2}
								decimalsToDisplay={[2, 4, 6, 8]}
							/>
						</div>
						<IconQuestion className={'hidden md:block'} />
					</div>
					<span className={'tooltipLight top-full mt-2'}>
						<div
							className={
								'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<p
								className={
									'font-number flex w-full flex-row justify-between text-neutral-400 md:text-xs'
								}>
								{`Your yield is accruing every single block. Go you!`}
							</p>
						</div>
					</span>
				</span>
			}>
			<Counter
				value={props.valueInToken.normalized}
				decimals={props.currentVault.decimals}
				idealDecimals={6}
				decimalsToDisplay={[6, 8, 10, 12]}
			/>
		</VaultHeaderLineItem>
	);
}

/**************************************************************************************************
 ** ValueEarned will render a block of two values: the amount of rewards earned by the user in the
 ** vault, along with the value of the rewards in USD.
 ** This is only displayed if the vault has a staking contract.
 *************************************************************************************************/
function ValueEarned(props: {
	currentVault: TYDaemonVault;
	rewardTokenSymbol: string;
	rewardTokenDecimal: number;
	earnedValue: number;
	earnedAmount: TNormalizedBN;
}): ReactElement {
	return (
		<VaultHeaderLineItem
			label={`Extra earned, ${props.rewardTokenSymbol}`}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>
							{`$`}
							<Counter
								value={props.earnedValue}
								decimals={2}
								decimalsToDisplay={[2, 4, 6, 8]}
							/>
						</div>
						<IconQuestion className={'hidden md:block'} />
					</div>
					<span className={'tooltipLight top-full mt-2'}>
						<div
							className={
								'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<p
								className={
									'font-number flex w-full flex-row justify-between text-neutral-400 md:text-xs'
								}>
								{`Your yield is accruing every single block. Go you!`}
							</p>
						</div>
					</span>
				</span>
			}>
			<span className={'font-numer'}>
				<Counter
					value={props.earnedAmount.normalized}
					decimals={props.rewardTokenDecimal}
					idealDecimals={6}
					decimalsToDisplay={[8, 10, 12, 16, 18]}
				/>
			</span>
		</VaultHeaderLineItem>
	);
}

export function VaultDetailsHeader({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {address} = useWeb3();
	const {getPrice} = useYearn();
	const {data: blockNumber} = useBlockNumber({watch: true});
	const {apr, tvl, decimals, symbol = 'token'} = currentVault;
	const [vaultData, set_vaultData] = useState({
		deposited: zeroNormalizedBN,
		valueInToken: zeroNormalizedBN,
		earnedAmount: zeroNormalizedBN,
		rewardTokenSymbol: '',
		rewardTokenDecimal: 0,
		earnedValue: 0
	});
	const vaultPrice =
		useYearnTokenPrice({
			address: currentVault.address,
			chainID: currentVault.chainID
		}) ||
		currentVault?.tvl?.price ||
		0;

	/**********************************************************************************************
	 ** Retrieve some data from the vault and the staking contract to display a comprehensive view
	 ** of the user's holdings in the vault.
	 **********************************************************************************************/
	const refetch = useAsyncTrigger(async (): Promise<void> => {
		/******************************************************************************************
		 ** To have the most up-to-date data, we fetch a few informations directly onChain, such as:
		 ** - The user's balance in the vault
		 ** - The user's balance in staking contract (0 if no staking contract)
		 ** - The price per share of the vault (to calculate current value of the user's holdings)
		 ** - The address of the rewards token
		 ** - The amount of rewards earned by the user
		 ******************************************************************************************/
		const result = await readContracts(retrieveConfig(), {
			contracts: [
				{
					address: currentVault.address,
					abi: VAULT_V3_ABI,
					chainId: currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				},
				{
					address: currentVault.staking.address,
					abi: erc20Abi,
					chainId: currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				},
				{
					address: currentVault.address,
					abi: VAULT_V3_ABI,
					chainId: currentVault.chainID,
					functionName: 'pricePerShare'
				},
				{
					address: toAddress(currentVault.staking.address),
					chainId: currentVault.chainID,
					abi: currentVault.staking.source === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
					functionName: currentVault.staking.source === 'OP Boost' ? 'rewardsToken' : 'REWARD_TOKEN'
				},
				{
					address: toAddress(currentVault.staking.address),
					abi: STAKING_REWARDS_ABI,
					chainId: currentVault.chainID,
					functionName: 'earned',
					args: [toAddress(address)]
				}
			]
		});
		const balanceOf = decodeAsBigInt(result[0]);
		const stakingBalance = decodeAsBigInt(result[1]);
		const pps = decodeAsBigInt(result[2]);
		const rewardsToken = decodeAsAddress(result[3]);
		const earned = decodeAsBigInt(result[4]);
		const total = balanceOf + stakingBalance;

		/******************************************************************************************
		 ** Some extra elements are required at this point to be able to display a comprehensive
		 ** view of the user's holdings in the vault: we need to know what is the reward token. This
		 ** means we need to retrieve the token's symbol and decimals.
		 ******************************************************************************************/
		const rewardResult = await readContracts(retrieveConfig(), {
			contracts: [
				{
					address: rewardsToken,
					abi: erc20Abi,
					chainId: currentVault.chainID,
					functionName: 'symbol'
				},
				{
					address: rewardsToken,
					abi: erc20Abi,
					chainId: currentVault.chainID,
					functionName: 'decimals'
				}
			]
		});
		const rewardSymbol = decodeAsString(rewardResult[0]);
		const rewardDecimals = decodeAsNumber(rewardResult[1]);
		const priceOfRewardsToken = getPrice({address: rewardsToken, chainID: 1});
		const amountEarned = isZeroAddress(address) ? zeroNormalizedBN : toNormalizedBN(earned, rewardDecimals);
		const earnedValue = amountEarned.normalized * priceOfRewardsToken.normalized;

		set_vaultData({
			deposited: isZeroAddress(address) ? zeroNormalizedBN : toNormalizedBN(total, decimals),
			valueInToken: toNormalizedBN((total * pps) / toBigInt(10 ** decimals), decimals),
			rewardTokenSymbol: rewardSymbol,
			rewardTokenDecimal: rewardDecimals,
			earnedValue: earnedValue,
			earnedAmount: amountEarned
		});
	}, [
		address,
		currentVault.address,
		currentVault.chainID,
		currentVault.staking.address,
		currentVault.staking.source,
		decimals,
		getPrice
	]);

	/**********************************************************************************************
	 ** As we want live data, we want the data to be refreshed every time the block number changes.
	 ** This way, the user will always have the most up-to-date data.
	 **********************************************************************************************/
	useEffect(() => {
		refetch();
	}, [blockNumber, refetch]);

	return (
		<div className={'col-span-12 mt-4 flex w-full flex-col items-center justify-center'}>
			<strong
				className={cl(
					'mx-auto flex w-full flex-row items-center justify-center text-center',
					'text-3xl md:text-[64px] leading-[36px] md:leading-[72px]',
					'tabular-nums text-neutral-900 font-black'
				)}>
				{getVaultName(currentVault)}
			</strong>

			<div className={'mb-10 mt-6 flex flex-col justify-center md:mt-4'}>
				{currentVault.address ? (
					<button onClick={(): void => copyToClipboard(currentVault.address)}>
						<p className={'font-number text-center text-xxs text-neutral-900/70 md:text-xs'}>
							{currentVault.address}
						</p>
					</button>
				) : (
					<p className={'text-xxs md:text-xs'}>&nbsp;</p>
				)}
				<div className={'mt-4 flex flex-col gap-2 md:flex-row'}>
					<div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
						<strong className={'text-sm font-black text-neutral-900 md:text-xl'}>
							{currentVault.token.name}
						</strong>
					</div>
					<div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
						<strong className={'text-sm font-black text-neutral-900 md:text-xl'}>
							{getNetwork(currentVault.chainID).name}
						</strong>
					</div>
					{currentVault.boosted ? (
						<div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
							<strong
								className={'text-sm font-black text-neutral-900 md:text-xl'}>{`⚡️ Boosted`}</strong>
						</div>
					) : null}
				</div>
			</div>

			<div
				className={cl(
					'grid grid-cols-2 gap-6 w-full md:px-10',
					currentVault.staking.available ? 'md:grid-cols-4' : 'md:grid-cols-3'
				)}>
				<div className={'w-full'}>
					<TVLInVault
						tokenSymbol={symbol}
						tvl={tvl.tvl}
						totalAssets={tvl.totalAssets}
						decimals={decimals}
					/>
				</div>

				<div className={'w-full'}>
					<VaultAPR apr={apr} />
				</div>

				<div className={'w-full'}>
					<ValueInVaultAsToken
						currentVault={currentVault}
						valueInToken={vaultData.valueInToken}
						vaultPrice={vaultPrice}
					/>
				</div>

				{currentVault.staking.available ? (
					<div className={'w-full'}>
						<ValueEarned
							currentVault={currentVault}
							earnedAmount={vaultData.earnedAmount}
							earnedValue={vaultData.earnedValue}
							rewardTokenSymbol={vaultData.rewardTokenSymbol}
							rewardTokenDecimal={vaultData.rewardTokenDecimal}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
