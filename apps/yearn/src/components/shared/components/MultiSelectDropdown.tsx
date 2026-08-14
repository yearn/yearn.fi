import type { ReactElement } from 'react'

export type TMultiSelectOptionProps = {
  label: string
  value: number | string
  isSelected: boolean
  icon?: ReactElement
  onCheckboxClick?: (event: React.MouseEvent<HTMLElement>) => void
  onContainerClick?: (event: React.MouseEvent<HTMLElement>) => void
}
