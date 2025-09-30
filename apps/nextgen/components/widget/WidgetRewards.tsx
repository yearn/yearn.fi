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
export const WidgetRewards: FC<Props> = ({ vaultType, vaultAddress, merkleCampaign }) => {
  const hasMerkleCampaign = !!merkleCampaign

  return (
    <div className="flex flex-col gap-0 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-2 bg-gray-100 p-4">
          <h1 className="text-lg text-gray-900 font-medium">Claim rewards</h1>
        </div>
        <div className="p-4">
          <h2>Vault Type: {vaultType}</h2>
          <h2 className="text-gray-500">Vault Address: {vaultAddress}</h2>
          <h2 className="text-gray-500">Merkle Campaign: {merkleCampaign}</h2>
          <h2 className="text-gray-500">{hasMerkleCampaign ? 'Merkle campaign' : 'No merkle campaign'}</h2>
        </div>
      </div>
    </div>
  )
}
