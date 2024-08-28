import {type ReactElement, useMemo} from 'react';
import {cl} from '@builtbymom/web3/utils';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

export function VaultRiskInfo({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const hasRiskScore = useMemo(() => {
		let sum = 0;
		currentVault.info.riskScore?.forEach(score => {
			sum += score;
		});
		return sum;
	}, [currentVault.info.riskScore]);

	return (
		<div className={'grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-10 md:p-8'}>
			<div className={'col-span-12 mt-6 w-full md:mt-0'}>
				<div className={'mb-4 md:mb-10'}>
					<div
						className={cl(
							'grid w-full grid-cols-12 items-center gap-6',
							hasRiskScore ? 'border-b border-neutral-900/20 pb-10 mb-10' : ''
						)}>
						<div className={'col-span-10'}>
							<b className={'block text-neutral-900'}>{'Risk Level'}</b>
							<small className={'mt-1 block w-3/4 text-xs text-neutral-900/40'}>
								{
									"This is an indicator of the security of the vault, calculated based on multiple factors including the strategy's complexity, exposure to potential losses, and reliance on external protocols. A score of 1 represents the highest security, while 5 indicates the lowest."
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<span>
								<b className={'font-number text-xl text-neutral-900'}>{currentVault.info.riskLevel}</b>
								<span className={'text-neutral-900/40'}>{' / 5'}</span>
							</span>
						</div>
					</div>

					<div className={cl('grid w-full grid-cols-12 items-center gap-6', hasRiskScore ? '' : 'hidden')}>
						<div className={'col-span-10'}>
							<p>{'Review'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{'The risk review score from Yearn security. 1 is for high trust to 5 low trust'}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[0]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Testing'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The testing coverage of the strategy being evaluated. 5 -> 80% or less; 1 -> 100% or higher'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[1]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Complexity'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The sLOC count of the strategy being evaluated. 5 -> 750+ sLOC; 4 -> 450-600 sLOC; 3 -> 300-450 sLOC; 2 -> 150-300 sLOC; 1 -> 0-150 sLOC'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[2]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Risk Exposure'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'This score aims to find out how much and how often a strategy can be subject to losses. 5 -> Loss of funds or non recoverable funds up to 70-100% (Example, Leveraging cross assets and got liquidated, adding liquidity to volatile pairs single sided); 4 -> Loss of funds or non recoverable funds up to 15-70% (Example, adding liquidity to single sided curve stable pools); 3 -> Loss of funds or non recoverable funds up to 10-15% (Example, Protocol specific IL exposure, very high deposit/withdrawal fees); 2 -> Loss of funds or non recoverable funds up to 0-10% (Example, deposit/withdrawal fees or anything protocol specific); 1 -> Strategy has no lossable cases, only gains, up only.'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[3]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Protocol Integration'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The protocols that are integrated into the strategy that is being evaluated. 5 -> Strategy interacts with 5 external protocols; 4 -> Strategy interacts with 4 external protocols; 3 -> Strategy interacts with 3 external protocols; 2 -> Strategy interacts with 2 external protocols; 1 -> Strategy interacts with 1 external protocol'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[4]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Centralization Risk'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The centralization score of the strategy that is being evaluated. 5 -> Strategy heavily relies on off-chain management, potentially exposing user funds to rug possibilities by admins; 4 -> Strategy frequently depends on off-chain management but has safeguards against rug possibilities by admins; 3 -> Strategy involves privileged roles but less frequently and with less risk of rug possibilities; 2 -> Strategy has privileged roles but they are not vital for operations and pose minimal risk of rug possibilities; 1 -> Strategy operates without dependency on any privileged roles, ensuring full permissionlessness.'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[5]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Audit'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The public audits count of the external protocols. 5 -> No audit conducted by a trusted firm or security researcher; 4 -> Audit conducted by 1 trusted firm or security researcher conducted; 3 -> Audit conducted by 2 trusted firm or security researcher conducted; 2 -> Audit conducted by 3 trusted firm or security researcher conducted; 1 -> Audit conducted by 4 or more trusted firm or security researcher conducted'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[6]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Centralisation'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									"Measurement of the centralization score of the external protocols. 5 -> Contracts owner is an EOA or a multisig with less than 4 members OR Contracts are not verified OR Contracts owner can harm our strategy completely; 4 -> Contracts owner is a multisig but the addresses are not known/hidden OR Contracts owner can harm our strategy by setting parameters in external protocol contracts up to some degree; 3 -> Contracts owner is a multisig with known people but multisig threshold is very low; 2 -> Contracts owner is a multisig with known trusted people; 1 -> Contracts owner is a multisig with known trusted people with Timelock OR Contracts are governanceless, immutable OR Contracts owner can't do any harm to our strategy by setting parameters in external protocol contracts"
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[7]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol TVL'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'The active TVL that the external protocol holds. 5 -> TVL of $10M or less; 4 -> TVL between $10M and $40M;3 -> TVL between $40M and $120M; 2 -> TVL; between $120M and $480M; 1 -> TVL of $480M or more'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[8]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Longevity'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									'How long the external protocol contracts in scope have been deployed alive. 5 -> Less than 6 months; 4 -> Between 6 and 12 months; 3 -> Between 12 and 18 months; 2 -> Between 18 and 24 months; 1 -> 24 months or more'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[9]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Type'}</p>
							<small className={'text-xs text-neutral-900/40'}>
								{
									"This is a rough estimate of evaluating a protocol's purpose. 5 -> The main expertise of the protocol lies in off-chain operations, such as RWA protocols; 4 -> Cross-chain applications, like cross-chain bridges, cross-chain yield aggregators, and cross-chain lending/borrowing protocols; 3 -> AMM lending/borrowing protocols that are not forks of blue-chip protocols, leveraged farming protocols, as well as newly conceptualized protocols; 2 -> Slightly modified forked blue-chip protocols; 1 -> Blue-chip protocols such as AAVE, Compound, Uniswap, Curve, Convex, and Balancer."
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[10]}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
