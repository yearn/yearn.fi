import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { type ReactElement, useMemo, useState } from 'react'

type TRiskScoreItem = {
  label: string
  score: number
  explanation: string
  isOpen: boolean
  onToggle: () => void
  isOverall?: boolean
  currentVault: TYDaemonVault
}

function RiskScoreItem({
  label,
  score,
  explanation,
  isOpen,
  onToggle,
  isOverall = false
  // currentVault
}: TRiskScoreItem): ReactElement {
  return (
    <div className={'w-full'}>
      <div className={'flex items-center gap-8'}>
        <button onClick={onToggle} className={'flex items-center gap-2 text-left transition-colors hover:opacity-70'}>
          <span
            className={cl('transition-transform', isOverall ? 'text-xl' : 'text-lg')}
            style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          >
            {'+'}
          </span>
          <p className={cl('font-medium', isOverall ? 'text-xl font-bold' : '')}>{label}</p>
        </button>
        <div className={'flex items-center font-bold'}>
          <p className={cl('mr-2', isOverall ? 'text-xl' : 'text-lg')}>{score}</p>
          <span className={'text-neutral-900/40'}> {' / 5'}</span>
        </div>
      </div>
      {isOpen && (
        <div className={'mt-2 w-full'}>
          {/* {isOverall && <p className={'mt-2 text-md text-neutral-900/70'}>{currentVault.info.riskScoreComment}</p>} */}
          <small className={'whitespace-break-spaces text-sm text-neutral-900/70'}>{explanation}</small>
        </div>
      )}
    </div>
  )
}

export function VaultRiskInfo({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const hasRiskScore = useMemo(() => {
    let sum = 0
    currentVault.info.riskScore?.forEach((score) => {
      sum += score
    })
    return sum
  }, [currentVault.info.riskScore])

  return <SimpleRiskScore hasRiskScore={hasRiskScore} currentVault={currentVault} />
}

export function SimpleRiskScore({
  hasRiskScore,
  currentVault
}: {
  hasRiskScore: number
  currentVault: TYDaemonVault
}): ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const isMultiStrategy = currentVault.kind?.toLowerCase() === 'multi strategy'

  const toggleItem = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index)
  }

  if (isMultiStrategy) {
    const multiStrategyRiskScore = {
      label: 'Overall Risk Score',
      score: currentVault.info.riskLevel,
      explanation:
        "This risk score determines what strategies can be added to this vault. Only strategies with overall risk score values equal or lower to the vault risk score are allowed. The strategy risk scores are calculated based on multiple factors including the strategy's complexity, exposure to potential losses, and reliance on external protocols. A score of 1 represents the highest security, while 5 indicates the lowest."
    }

    return (
      <div className={'grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-10 md:p-8'}>
        <div className={'col-span-12 mt-6 w-full md:mt-0'}>
          <div className={'flex flex-col mb-4 md:mb-10'}>
            <div className={'flex flex-col gap-2'}>
              <div className={'border-b border-neutral-300 pb-2 mb-2'}>
                <div className={'flex items-center gap-8'}>
                  <div className={'flex items-center gap-2 text-left'}>
                    <p className={'font-medium text-xl font-bold'}>{multiStrategyRiskScore.label}</p>
                  </div>
                  <div className={'flex items-center font-bold'}>
                    <p className={'mr-2 text-xl'}>{multiStrategyRiskScore.score}</p>
                    <span className={'text-neutral-900/40'}> {' / 5'}</span>
                  </div>
                </div>
                <div className={'mt-2 w-full'}>
                  <small className={'whitespace-break-spaces text-sm text-neutral-900/70'}>
                    {multiStrategyRiskScore.explanation}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const riskScoreData = [
    {
      label: 'Overall Risk Score',
      score: currentVault.info.riskLevel,
      explanation:
        "This is an indicator of the security of the vault, calculated based on multiple factors including the strategy's complexity, exposure to potential losses, and reliance on external protocols. A score of 1 represents the highest security, while 5 indicates the lowest."
    },
    {
      label: 'Review',
      score: currentVault.info.riskScore[0],
      explanation:
        'To have a unified reviewScore for both internal and external strategies, we assume that the strategist writer itself is either a Source of Trust (internal) or not (external). So all internal strategies always includes that 1 additional source of trust in addition. Together with all other Sources of Trust (SoTs) in this list: internal strategist wrote the strategy, peer reviews, expert peer reviews, ySec security reviews and ySec recurring security review. Each item accounts for 1 SoT point, and any combinations of these gives the number of SoTs a strategy has and thus gives the associated review score: \n\t\t1 -> 5 SoT \n\t\t2 -> 4 SoT\n\t\t3 -> 3 SoT\n\t\t4 -> 2 SoT\n\t\t5 -> 1 SoT'
    },
    {
      label: 'Testing',
      score: currentVault.info.riskScore[1],
      explanation:
        'The testing coverage of the strategy being evaluated. \n\t\t1 -> 95%+\n\t\t2 -> 90%+\n\t\t3 -> 80%+\n\t\t4 -> 70%+\n\t\t5 -> below 70%'
    },
    {
      label: 'Complexity',
      score: currentVault.info.riskScore[2],
      explanation:
        'The sLOC count of the strategy being evaluated. \n\t\t1 -> 0-150 sLOC\n\t\t2 -> 150-300 sLOC\n\t\t3 -> 300-450 sLOC\n\t\t4 -> 450-600 sLOC\n\t\t5 -> 750+ sLOC'
    },
    {
      label: 'Risk Exposure',
      score: currentVault.info.riskScore[3],
      explanation:
        'This score aims to find out how much and how often a strategy can be subject to losses. \n\t\t1 -> Strategy has no lossable cases, only gains, up only.\n\t\t2 -> Loss of funds or non recoverable funds up to 0-10% (Example, deposit/withdrawal fees or anything protocol specific)\n\t\t3 -> Loss of funds or non recoverable funds up to 10-15% (Example, Protocol specific IL exposure, very high deposit/withdrawal fees)\n\t\t4 -> Loss of funds or non recoverable funds up to 15-70% (Example, adding liquidity to single sided curve stable pools)\n\t\t5 -> Loss of funds or non recoverable funds up to 70-100% (Example, Leveraging cross assets and got liquidated, adding liquidity to volatile pairs single sided)'
    },
    {
      label: 'Protocol Integration',
      score: currentVault.info.riskScore[4],
      explanation:
        'The protocols that are integrated into the strategy that is being evaluated. \n\t\t1 -> Strategy interacts with 1 external protocol\n\t\t2 -> Strategy interacts with 2 external protocols\n\t\t3 -> Strategy interacts with 3 external protocols\n\t\t4 -> Strategy interacts with 4 external protocols\n\t\t5 -> Strategy interacts with 5 external protocols'
    },
    {
      label: 'Centralization Risk',
      score: currentVault.info.riskScore[5],
      explanation:
        'The centralization score of the strategy that is being evaluated. \n\t\t1 -> Strategy operates without dependency on any privileged roles, ensuring full permissionlessness.\n\t\t2 -> Strategy has privileged roles but they are not vital for operations and pose minimal risk of rug possibilities\n\t\t3 -> Strategy involves privileged roles but less frequently and with less risk of rug possibilities\n\t\t4 -> Strategy frequently depends on off-chain management but has safeguards against rug possibilities by admins\n\t\t5 -> Strategy heavily relies on off-chain management, potentially exposing user funds to rug possibilities by admins'
    },
    {
      label: 'External Protocol Audit',
      score: currentVault.info.riskScore[6],
      explanation:
        'The public audits count of the external protocols. \n\t\t1 -> Audit conducted by 4 or more trusted firm or security researcher conducted.\n\t\t2 -> Audit conducted by 3 trusted firm or security researcher conducted\n\t\t3 -> Audit conducted by 2 trusted firm or security researcher conducted\n\t\t4 -> Audit conducted by 1 trusted firm or security researcher conducted\n\t\t5 -> No audit conducted by a trusted firm or security researcher'
    },
    {
      label: 'External Protocol Centralisation',
      score: currentVault.info.riskScore[7],
      explanation:
        "Measurement of the centralization score of the external protocols. \n\t\t1 -> Contracts owner is a multisig with known trusted people with Timelock OR Contracts are governanceless, immutable OR Contracts owner can't do any harm to our strategy by setting parameters in external protocol contracts.\n\t\t2 -> Contracts owner is a multisig with known trusted people\n\t\t3 -> Contracts owner is a multisig with known people but multisig threshold is very low\n\t\t4 -> Contracts owner is a multisig but the addresses are not known/hidden OR Contracts owner can harm our strategy by setting parameters in external protocol contracts up to some degree\n\t\t5 -> Contracts owner is an EOA or a multisig with less than 4 members OR Contracts are not verified OR Contracts owner can harm our strategy completely"
    },
    {
      label: 'External Protocol TVL',
      score: currentVault.info.riskScore[8],
      explanation:
        'The active TVL that the external protocol holds. \n\t\t1 -> TVL of $480M or more\n\t\t2 -> TVL between $120M and $480M\n\t\t3 -> TVL between $40M and $120M\n\t\t4 -> TVL between $10M and $40M\n\t\t5 -> TVL of $10M or less'
    },
    {
      label: 'External Protocol Longevity',
      score: currentVault.info.riskScore[9],
      explanation:
        'How long the external protocol contracts in scope have been deployed alive. \n\t\t1 -> 24 months or more\n\t\t2 -> Between 18 and 24 months\n\t\t3 -> Between 12 and 18 months\n\t\t4 -> Between 6 and 12 months\n\t\t5 -> Less than 6 months'
    },
    {
      label: 'External Protocol Type',
      score: currentVault.info.riskScore[10],
      explanation:
        "This is a rough estimate of evaluating a protocol's purpose. \n\t\t1 -> Blue-chip protocols such as AAVE, Compound, Uniswap, Curve, Convex, and Balancer.\n\t\t2 -> Slightly modified forked blue-chip protocols\n\t\t3 -> AMM lending/borrowing protocols that are not forks of blue-chip protocols, leveraged farming protocols, as well as newly conceptualized protocols\n\t\t4 -> Cross-chain applications, like cross-chain bridges, cross-chain yield aggregators, and cross-chain lending/borrowing protocols\n\t\t5 -> The main expertise of the protocol lies in off-chain operations, such as RWA protocols"
    }
  ]

  return (
    <div className={'grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-10 md:p-8'}>
      <div className={'col-span-12 mt-6 w-full md:mt-0'}>
        <div className={'flex flex-col mb-4 md:mb-10'}>
          {/* <div className={cl('flex flex-col gap-2', hasRiskScore ? '' : 'hidden')}> */}
          {hasRiskScore > 10 ? (
            <div className={cl('flex flex-col gap-2')}>
              {riskScoreData.map((item, index) => (
                <div key={item.label} className={index === 0 ? 'border-b border-neutral-300 pb-2 mb-2' : ''}>
                  <RiskScoreItem
                    label={item.label}
                    score={item.score}
                    explanation={item.explanation}
                    isOpen={openIndex === index}
                    onToggle={() => toggleItem(index)}
                    isOverall={index === 0}
                    currentVault={currentVault}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={'text-neutral-900/70'}>
              <p>
                No risk score data available for this vault. If you are seeing this, please let us know in our{' '}
                <a
                  href="https://discord.gg/yearn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-70"
                >
                  discord server
                </a>{' '}
                and we will get it added!
              </p>
            </div>
          )}
          {/* </div> */}
        </div>
      </div>
    </div>
  )
}
