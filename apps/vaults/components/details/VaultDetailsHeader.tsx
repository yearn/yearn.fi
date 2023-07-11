import {useMemo} from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {RenderAmount} from '@common/components/RenderAmount';
import {useBalance} from '@common/hooks/useBalance';
import {useFetch} from '@common/hooks/useFetch';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {yDaemonEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {getVaultName} from '@common/utils';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TYDaemonEarned} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@common/types/types';

type TVaultHeaderLineItemProps = {
	label: string;
	children: ReactElement | string;
	legend?: string;
}

function VaultHeaderLineItem({label, children, legend}: TVaultHeaderLineItemProps): ReactElement {
	return (
		<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
			<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
				{label}
			</p>
			<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
				{children}
			</b>
			<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
				{legend ? legend : '\u00A0'}
			</legend>
		</div>
	);
}

function VaultDetailsHeader({vault}: { vault: TYDaemonVault }): ReactElement {
	const {safeChainID} = useChainID();
	const {address: userAddress} = useWeb3();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});
	const {address, apy, tvl, decimals, symbol = 'token', token} = vault;
	const {data: earned} = useFetch<TYDaemonEarned>({
		endpoint: (address && userAddress) ? `${yDaemonBaseUri}/earned/${userAddress}` : null,
		schema: yDaemonEarnedSchema
	});

	const normalizedVaultEarned = useMemo((): TNormalizedBN => {
		const {unrealizedGains} = earned?.earned?.[toAddress(address)] || {};
		const normalizedValue = toBigInt(unrealizedGains);
		return toNormalizedBN(normalizedValue < 0n ? 0n : normalizedValue);
	}, [earned?.earned, address]);

	const vaultBalance = useBalance(address);
	const vaultPrice = useTokenPrice(address);
	const vaultName = useMemo((): string => getVaultName(vault), [vault]);
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();
<<<<<<< HEAD
	const stakedBalance = toNormalizedValue(toBigInt(positionsMap[toAddress(stakingRewardsByVault[address])]?.stake), decimals);
	const depositedAndStaked = vaultBalance + stakedBalance;

	//TODO: EXPORT THIS AS EXTERNAL FUNCTION
	function renderAmount(): string {
		const amount = formatToNormalizedValue(toBigInt(tvl?.total_assets || 0), decimals);
		if (isZero(amount)) {
			return formatAmount(0);
		}
		if (amount < 0.01) {
			if (amount > 0.00000001) {
				return formatAmount(amount, 8, 8);
			}
			return formatAmount(amount, decimals, decimals);
		}
		return formatAmount(amount);
	}
=======
	const stakedBalance = toBigInt(positionsMap[toAddress(stakingRewardsByVault[address])]?.stake);
	const depositedAndStaked = toNormalizedBN(vaultBalance.raw + stakedBalance, decimals);
>>>>>>> b8dde5b8 (feat: update number display)

	return (
		<div aria-label={'Vault Header'} className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mb-10 mt-4 md:mb-14 md:mt-10'}>
				{address ? (
					<button onClick={(): void => copyToClipboard(address)}>
						<p className={'font-number text-xxs text-neutral-500 md:text-xs'}>{address}</p>
					</button>
				) : <p className={'text-xxs text-neutral-500 md:text-xs'}>&nbsp;</p>}
			</div>
			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12'}>
				<VaultHeaderLineItem label={`Total deposited, ${token?.symbol || 'tokens'}`} legend={formatUSD(tvl?.tvl || 0)}>
					<RenderAmount
						value={tvl?.total_assets}
						symbol={''}
						decimals={decimals} />
				</VaultHeaderLineItem>

				<VaultHeaderLineItem label={'Net APY'}>
					<RenderAmount
						value={(apy?.net_apy || 0) + (apy?.staking_rewards_apr || 0)}
						symbol={'percent'}
						decimals={6} />
				</VaultHeaderLineItem>

				<VaultHeaderLineItem
					label={`Balance, ${symbol}`}
					legend={formatCounterValue(depositedAndStaked.normalized, vaultPrice)}>
					<RenderAmount
						value={depositedAndStaked.raw}
						symbol={''}
						decimals={decimals} />
				</VaultHeaderLineItem>

				<VaultHeaderLineItem
					label={`Earned, ${token?.symbol || 'tokens'}`}
					legend={formatCounterValue(normalizedVaultEarned.normalized, vaultPrice)}>
					<RenderAmount
						value={normalizedVaultEarned.raw}
						symbol={''}
						decimals={decimals} />
				</VaultHeaderLineItem>
			</div>
		</div>
	);
}

export {VaultDetailsHeader};
