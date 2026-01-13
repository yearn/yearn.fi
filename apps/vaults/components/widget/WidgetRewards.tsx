import type { FC } from 'react'

// would need to cover:
// - merkle campaign pass through
// - veYFI
// - op boost

interface Props {
  vaultType: 'v2' | 'v3'
  vaultAddress: `0x${string}`
  merkleCampaign?: `0x${string}`
  handleRewardsSuccess?: () => void
}
export const WidgetRewards: FC<Props> = ({ vaultAddress, merkleCampaign }) => {
  const hasMerkleCampaign = !!merkleCampaign

  return (
    <div className="flex flex-col gap-0">
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="flex flex-col gap-2 bg-surface-secondary p-4">
          <h1 className="text-lg text-text-primary font-medium">Claim rewards</h1>
        </div>
        <div className="p-4">
          <h2 className="text-text-secondary">Vault Address: {vaultAddress}</h2>
          <h2 className="text-text-secondary">Merkle Campaign: {merkleCampaign}</h2>
          <h2 className="text-text-secondary">{hasMerkleCampaign ? 'Merkle campaign' : 'No merkle campaign'}</h2>
        </div>
      </div>
    </div>
  )
}
