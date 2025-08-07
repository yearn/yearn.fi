import { useSearch } from '@lib/contexts/useSearch'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useMountEffect } from '@react-hookz/web'
import CombinedVaultsTable from '@vaults/components/table/CombinedVaultsTable'
import { VaultsBanner } from '@vaults/components/VaultsBanner'
import { VaultsPositions } from '@vaults/components/VaultsPositions'
import type { ReactElement } from 'react'

export default function Home(): ReactElement {
  const { dispatch } = useSearch()
  const { isActive } = useWeb3()

  useMountEffect(() => {
    dispatch({ searchValue: '' })
  })

  return (
    <div
      className={
        'relative mx-auto mb-4 mt-24 flex w-full max-w-6xl justify-start rounded-lg p-4 md:mt-16'
      }>
      <div className={'w-full pb-24'}>
        <div className={'flex flex-col gap-y-10'}>
          <VaultsBanner />
          {isActive && <VaultsPositions />}
          <div className={'flex flex-col gap-7'}>
            <div
              className={
                'flex flex-col gap-4 rounded-[16px] border border-neutral-900/5 bg-neutral-900/5 p-4'
              }>
              <CombinedVaultsTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
