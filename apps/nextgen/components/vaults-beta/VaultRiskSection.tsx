import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultRiskScoreTag } from '@vaults-v3/components/table/VaultRiskScoreTag'
import { type ReactElement, useMemo, useState } from 'react'

type TRiskScoreItem = {
  label: string
  score: number
  explanation: string
  isOpen: boolean
  onToggle: () => void
  isOverall?: boolean
  rightContent?: ReactElement | null
}

function RiskScoreItem({
  label,
  score,
  explanation,
  isOpen,
  onToggle,
  isOverall = false,
  rightContent = null
}: TRiskScoreItem): ReactElement {
  return (
    <div className={'w-full'}>
      <div className={'flex flex-wrap items-end gap-4 md:gap-8'}>
        <button onClick={onToggle} className={'flex items-end gap-2 text-left transition-colors hover:opacity-70'}>
          <span
            className={cl('transition-transform', isOverall ? 'text-xl' : 'text-lg')}
            style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          >
            {'+'}
          </span>
          <p className={cl('font-medium', isOverall ? 'text-xl font-bold' : '')}>{label}</p>
        </button>
        <div className={'flex items-end font-bold'}>
          <p className={cl('mr-2', isOverall ? 'text-xl' : 'text-lg')}>{score}</p>
          <span className={'text-neutral-900/40'}>{' / 5'}</span>
        </div>
        {rightContent ? <div className={'flex items-end'}>{rightContent}</div> : null}
      </div>
      {isOpen && (
        <div className={'mt-2 w-full'}>
          <small className={'whitespace-break-spaces text-sm text-neutral-900/70'}>{explanation}</small>
        </div>
      )}
    </div>
  )
}

export function VaultRiskSection({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const hasRiskScore = useMemo(() => {
    let sum = 0
    currentVault.info.riskScore?.forEach((score) => {
      sum += score
    })
    return sum
  }, [currentVault.info.riskScore])

  return <SimpleRiskScore hasRiskScore={hasRiskScore} currentVault={currentVault} />
}

function SimpleRiskScore({
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
  const renderInlineRiskScoreTag = (): ReactElement => (
    <VaultRiskScoreTag
      riskLevel={currentVault.info.riskLevel}
      variant={'inline'}
      className={'w-auto flex-shrink-0 md:pt-0'}
    />
  )

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
          <div className={'mb-4 flex flex-col md:mb-10'}>
            <div className={'flex flex-col gap-2'}>
              <div className={'mb-2 border-b border-neutral-300 pb-2'}>
                <div className={'flex flex-wrap items-end gap-4 md:gap-8'}>
                  <div className={'flex items-end gap-2'}>
                    <p className={'text-xl font-bold'}>{multiStrategyRiskScore.label}</p>
                  </div>
                  <div className={'flex items-end gap-4'}>
                    <div className={'flex items-center font-bold'}>
                      <p className={'mr-2 text-xl'}>{multiStrategyRiskScore.score}</p>
                      <span className={'text-neutral-900/40'}>{' / 5'}</span>
                    </div>
                    {renderInlineRiskScoreTag()}
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
      explanation: currentVault.info.riskScoreComment,
      isOverall: true,
      rightContent: renderInlineRiskScoreTag()
    },
    {
      label: 'Category Risk Score',
      score: currentVault.info.riskScore?.[0] || 0,
      explanation: 'Measures the risk level of the vault category.'
    },
    {
      label: 'Complexity Risk Score',
      score: currentVault.info.riskScore?.[1] || 0,
      explanation: 'Indicates the complexity of the strategy.'
    },
    {
      label: 'Yield Risk Score',
      score: currentVault.info.riskScore?.[2] || 0,
      explanation: 'Assesses the sustainability and reliability of the yield.'
    },
    {
      label: 'Audit Risk Score',
      score: currentVault.info.riskScore?.[3] || 0,
      explanation: 'Represents the audit and security posture of the strategy.'
    },
    {
      label: 'Counterparty Risk Score',
      score: currentVault.info.riskScore?.[4] || 0,
      explanation: 'Reflects the counterparty exposure for the vault.'
    }
  ]

  return (
    <div className={'grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-10 md:p-8'}>
      <div className={'col-span-12 mt-6 w-full space-y-6 md:mt-0'}>
        {hasRiskScore ? (
          riskScoreData.map((item, index) => (
            <RiskScoreItem
              key={item.label}
              label={item.label}
              score={item.score}
              explanation={item.explanation}
              isOpen={openIndex === index}
              onToggle={(): void => toggleItem(index)}
              isOverall={item.isOverall}
              rightContent={item.rightContent}
            />
          ))
        ) : (
          <div className={'rounded-3xl border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900'}>
            {'No risk data available for this vault.'}
          </div>
        )}
      </div>
    </div>
  )
}
