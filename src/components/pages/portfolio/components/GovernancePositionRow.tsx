import { ProtocolPositionRow } from '@pages/portfolio/components/ProtocolPositionRow'
import type { TGovernancePosition } from '@pages/portfolio/governance/types'
import type { ReactElement } from 'react'

type TGovernancePositionRowProps = {
  position: TGovernancePosition
}

export function GovernancePositionRow({ position }: TGovernancePositionRowProps): ReactElement {
  return <ProtocolPositionRow position={{ ...position, decimals: 18 }} />
}
