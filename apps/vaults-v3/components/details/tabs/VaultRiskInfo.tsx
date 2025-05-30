import {type ReactElement, useMemo} from 'react';
import {cl} from '@lib/utils';

import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

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

					<div
						className={cl(
							'grid w-full grid-cols-12 items-center mb-6',
							currentVault.info.riskScoreComment ? '' : 'hidden'
						)}>
						<div className={'col-span-10'}>
							<p>{'Comment'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{currentVault.info.riskScoreComment}
							</small>
						</div>
					</div>

					<div className={cl('grid w-full grid-cols-12 items-center gap-6', hasRiskScore ? '' : 'hidden')}>
						<div className={'col-span-10'}>
							<p>{'Review'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'To have a unified reviewScore for both internal and external strategies, we assume that the strategist writer itself is either a Source of Trust (internal) or not (external). So all internal strategies always includes that 1 additional source of trust in addition. Together with all other Sources of Trust (SoTs) in this list: internal strategist wrote the strategy, peer reviews, expert peer reviews, ySec security reviews and ySec recurring security review. Each item accounts for 1 SoT point, and any combinations of these gives the number of SoTs a strategy has and thus gives the associated review score: \n\t\t1 -> 5 SoT \n\t\t2 -> 4 SoT\n\t\t3 -> 3 SoT\n\t\t4 -> 2 SoT\n\t\t5 -> 1 SoT'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[0]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Testing'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The testing coverage of the strategy being evaluated. \n\t\t1 -> 95%+\n\t\t2 -> 90%+\n\t\t3 -> 80%+\n\t\t4 -> 70%+\n\t\t5 -> below 70%'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[1]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Complexity'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The sLOC count of the strategy being evaluated. \n\t\t1 -> 0-150 sLOC\n\t\t2 -> 150-300 sLOC\n\t\t3 -> 300-450 sLOC\n\t\t4 -> 450-600 sLOC\n\t\t5 -> 750+ sLOC'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[2]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Risk Exposure'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'This score aims to find out how much and how often a strategy can be subject to losses. \n\t\t1 -> Strategy has no lossable cases, only gains, up only.\n\t\t2 -> Loss of funds or non recoverable funds up to 0-10% (Example, deposit/withdrawal fees or anything protocol specific)\n\t\t3 -> Loss of funds or non recoverable funds up to 10-15% (Example, Protocol specific IL exposure, very high deposit/withdrawal fees)\n\t\t4 -> Loss of funds or non recoverable funds up to 15-70% (Example, adding liquidity to single sided curve stable pools)\n\t\t5 -> Loss of funds or non recoverable funds up to 70-100% (Example, Leveraging cross assets and got liquidated, adding liquidity to volatile pairs single sided)'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[3]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Protocol Integration'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The protocols that are integrated into the strategy that is being evaluated. \n\t\t1 -> Strategy interacts with 1 external protocol\n\t\t2 -> Strategy interacts with 2 external protocols\n\t\t3 -> Strategy interacts with 3 external protocols\n\t\t4 -> Strategy interacts with 4 external protocols\n\t\t5 -> Strategy interacts with 5 external protocols'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[4]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'Centralization Risk'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The centralization score of the strategy that is being evaluated. \n\t\t1 -> Strategy operates without dependency on any privileged roles, ensuring full permissionlessness.\n\t\t2 -> Strategy has privileged roles but they are not vital for operations and pose minimal risk of rug possibilities\n\t\t3 -> Strategy involves privileged roles but less frequently and with less risk of rug possibilities\n\t\t4 -> Strategy frequently depends on off-chain management but has safeguards against rug possibilities by admins\n\t\t5 -> Strategy heavily relies on off-chain management, potentially exposing user funds to rug possibilities by admins'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[5]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Audit'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The public audits count of the external protocols. \n\t\t1 -> Audit conducted by 4 or more trusted firm or security researcher conducted.\n\t\t2 -> Audit conducted by 3 trusted firm or security researcher conducted\n\t\t3 -> Audit conducted by 2 trusted firm or security researcher conducted\n\t\t4 -> Audit conducted by 1 trusted firm or security researcher conducted\n\t\t5 -> No audit conducted by a trusted firm or security researcher'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[6]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Centralisation'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									"Measurement of the centralization score of the external protocols. \n\t\t1 -> Contracts owner is a multisig with known trusted people with Timelock OR Contracts are governanceless, immutable OR Contracts owner can't do any harm to our strategy by setting parameters in external protocol contracts.\n\t\t2 -> Contracts owner is a multisig with known trusted people\n\t\t3 -> Contracts owner is a multisig with known people but multisig threshold is very low\n\t\t4 -> Contracts owner is a multisig but the addresses are not known/hidden OR Contracts owner can harm our strategy by setting parameters in external protocol contracts up to some degree\n\t\t5 -> Contracts owner is an EOA or a multisig with less than 4 members OR Contracts are not verified OR Contracts owner can harm our strategy completely"
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[7]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol TVL'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'The active TVL that the external protocol holds. \n\t\t1 -> TVL of $480M or more\n\t\t2 -> TVL between $120M and $480M\n\t\t3 -> TVL between $40M and $120M\n\t\t4 -> TVL between $10M and $40M\n\t\t5 -> TVL of $10M or less'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[8]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Longevity'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									'How long the external protocol contracts in scope have been deployed alive. \n\t\t1 -> 24 months or more\n\t\t2 -> Between 18 and 24 months\n\t\t3 -> Between 12 and 18 months\n\t\t4 -> Between 6 and 12 months\n\t\t5 -> Less than 6 months'
								}
							</small>
						</div>
						<div className={'col-span-2 flex items-center justify-center font-bold'}>
							<p>{currentVault.info.riskScore[9]}</p>
						</div>

						<div className={'col-span-10'}>
							<p>{'External Protocol Type'}</p>
							<small className={'whitespace-break-spaces text-xs text-neutral-900/40'}>
								{
									"This is a rough estimate of evaluating a protocol's purpose. \n\t\t1 -> Blue-chip protocols such as AAVE, Compound, Uniswap, Curve, Convex, and Balancer.\n\t\t2 -> Slightly modified forked blue-chip protocols\n\t\t3 -> AMM lending/borrowing protocols that are not forks of blue-chip protocols, leveraged farming protocols, as well as newly conceptualized protocols\n\t\t4 -> Cross-chain applications, like cross-chain bridges, cross-chain yield aggregators, and cross-chain lending/borrowing protocols\n\t\t5 -> The main expertise of the protocol lies in off-chain operations, such as RWA protocols"
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
