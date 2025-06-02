import {Fragment} from 'react';
import {isZero, toAddress} from '@builtbymom/web3/utils';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {RenderAmount} from '@common/components/RenderAmount';

import {APYSubline} from './APYSubline';
import {APYTooltip} from './APYTooltip';

import type {FC} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

export const VAULT_ADDRESSES = {
	PENDLE_ARB_REWARDS: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544',
	KELP_N_ENGENLAYER: '0xDDa02A2FA0bb0ee45Ba9179a3fd7e65E5D3B2C90',
	KELP: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544'
};

export const VaultForwardAPY: FC<{currentVault: TYDaemonVault}> = ({currentVault}) => {
	const isEthMainnet = currentVault.chainID === 1;
	const hasPendleArbRewards = currentVault.address === toAddress(VAULT_ADDRESSES.PENDLE_ARB_REWARDS);
	const hasKelpNEngenlayer = currentVault.address === toAddress(VAULT_ADDRESSES.KELP_N_ENGENLAYER);
	const hasKelp = currentVault.address === toAddress(VAULT_ADDRESSES.KELP);

	/**********************************************************************************************
	 ** If there is no forwardAPY, we only have the historical APY to display.
	 **********************************************************************************************/
	if (currentVault.apr.forwardAPR.type === '') {
		const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
		const boostedAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.netAPR;
		const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0;

		if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
			return (
				<div className={'relative flex flex-col items-end md:text-right'}>
					<span className={'tooltip'}>
						<b className={'yearn--table-data-section-item-value'}>
							<Renderable
								shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
								/* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
								fallback={'NEW'}>
								{'⚡️ '}
								<span
									className={
										'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
									}>
									<RenderAmount
										shouldHideTooltip={hasZeroBoostedAPY}
										value={boostedAPY}
										symbol={'percent'}
										decimals={6}
									/>
								</span>
							</Renderable>
						</b>
						<APYTooltip
							baseAPY={currentVault.apr.netAPR}
							hasPendleArbRewards={hasPendleArbRewards}
							hasKelp={hasKelp}
							hasKelpNEngenlayer={hasKelpNEngenlayer}
							rewardsAPY={currentVault.apr.extra.stakingRewardsAPR}
						/>
					</span>
					<APYSubline
						hasPendleArbRewards={hasPendleArbRewards}
						hasKelpNEngenlayer={hasKelpNEngenlayer}
						hasKelp={hasKelp}
					/>
				</div>
			);
		}
		return (
			<div className={'relative flex flex-col items-end md:text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
						/* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
						fallback={'NEW'}>
						<RenderAmount
							value={currentVault.apr?.netAPR}
							shouldHideTooltip={hasZeroAPY}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
				<APYSubline
					hasPendleArbRewards={hasPendleArbRewards}
					hasKelpNEngenlayer={hasKelpNEngenlayer}
					hasKelp={hasKelp}
				/>
			</div>
		);
	}

	/**********************************************************************************************
	 ** If we are on eth mainnet and the vault has a boost, we display the APY with the boost.
	 ** This is mostly valid for Curve vaults.
	 **********************************************************************************************/
	if (isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !currentVault.apr.extra.stakingRewardsAPR) {
		const unBoostedAPY = currentVault.apr.forwardAPR.netAPR / currentVault.apr.forwardAPR.composite.boost;
		return (
			<span className={'tooltip'}>
				<div className={'flex flex-col items-end md:text-right'}>
					<b
						className={
							'yearn--table-data-section-item-value underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
						}>
						<Renderable
							shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
							fallback={'NEW'}>
							<RenderAmount
								shouldHideTooltip
								value={currentVault.apr.forwardAPR.netAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
					<APYTooltip
						baseAPY={unBoostedAPY}
						hasPendleArbRewards={hasPendleArbRewards}
						hasKelpNEngenlayer={hasKelpNEngenlayer}
						hasKelp={hasKelp}
						boost={currentVault.apr.forwardAPR.composite.boost}
					/>
				</div>
			</span>
		);
	}

	/**********************************************************************************************
	 ** Display the APY including the rewards APY if the rewards APY is greater than 0.
	 **********************************************************************************************/
	const sumOfRewardsAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR;
	const isSourceVeYFI = currentVault.staking.source === 'VeYFI';
	if (sumOfRewardsAPY > 0) {
		let veYFIRange: [number, number] | undefined = undefined;
		let estAPYRange: [number, number] | undefined = undefined;
		let boostedAPY: number;
		let hasZeroBoostedAPY: boolean;

		if (isSourceVeYFI) {
			veYFIRange = [
				currentVault.apr.extra.stakingRewardsAPR / 10 + currentVault.apr.extra.gammaRewardAPR,
				sumOfRewardsAPY
			] as [number, number];
			boostedAPY = veYFIRange[0] + currentVault.apr.forwardAPR.netAPR;
			hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0;
			estAPYRange = [
				veYFIRange[0] + currentVault.apr.forwardAPR.netAPR,
				veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
			] as [number, number];
		} else {
			boostedAPY = sumOfRewardsAPY + currentVault.apr.forwardAPR.netAPR;
			hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0;
		}

		return (
			<div className={'relative flex flex-col items-end md:text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value whitespace-nowrap'}>
						<Renderable
							shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
							/* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
							fallback={'NEW'}>
							<div className={'flex flex-col items-end'}>
								{estAPYRange ? (
									<Fragment>
										<RenderAmount
											shouldHideTooltip
											value={estAPYRange[0]}
											symbol={'percent'}
											decimals={6}
										/>
										<span
											className={
												'text-xs font-normal text-white/50 underline decoration-neutral-600/30 decoration-dotted underline-offset-4'
											}>
											{'proj. '}
											<RenderAmount
												shouldHideTooltip
												value={estAPYRange[1]}
												symbol={'percent'}
												decimals={6}
											/>
										</span>
									</Fragment>
								) : (
									<RenderAmount
										shouldHideTooltip={hasZeroBoostedAPY}
										value={boostedAPY}
										symbol={'percent'}
										decimals={6}
									/>
								)}
							</div>
						</Renderable>
					</b>
					<APYTooltip
						baseAPY={currentVault.apr.forwardAPR.netAPR}
						rewardsAPY={veYFIRange ? undefined : sumOfRewardsAPY}
						hasPendleArbRewards={hasPendleArbRewards}
						hasKelpNEngenlayer={hasKelpNEngenlayer}
						hasKelp={hasKelp}
						range={veYFIRange}
					/>
				</span>
				<APYSubline
					hasPendleArbRewards={hasPendleArbRewards}
					hasKelp={hasKelp}
					hasKelpNEngenlayer={hasKelpNEngenlayer}
				/>
			</div>
		);
	}

	/**********************************************************************************************
	 ** Display the current spot APY, retrieved from the V3Oracle, only if the current APY is
	 ** greater than 0.
	 **********************************************************************************************/
	const hasCurrentAPY = !isZero(currentVault?.apr.forwardAPR.netAPR);
	if (hasCurrentAPY) {
		return (
			<div className={'relative flex flex-col items-end md:text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
						/* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
						fallback={'NEW'}>
						{currentVault?.info?.isBoosted ? '⚡️ ' : ''}
						<RenderAmount
							shouldHideTooltip
							value={currentVault?.apr.forwardAPR.netAPR}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
				<APYSubline
					hasPendleArbRewards={hasPendleArbRewards}
					hasKelp={hasKelp}
					hasKelpNEngenlayer={hasKelpNEngenlayer}
				/>
			</div>
		);
	}

	const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	return (
		<div className={'relative flex flex-col items-end md:text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={
						!currentVault.apr.forwardAPR?.type.includes('new') && !currentVault.apr.type.includes('new')
					}
					/* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
					fallback={'NEW'}>
					{currentVault?.info?.isBoosted ? '⚡️ ' : ''}
					<RenderAmount
						shouldHideTooltip={hasZeroAPY}
						value={currentVault.apr.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
			<APYSubline
				hasPendleArbRewards={hasPendleArbRewards}
				hasKelp={hasKelp}
				hasKelpNEngenlayer={hasKelpNEngenlayer}
			/>
		</div>
	);
};
