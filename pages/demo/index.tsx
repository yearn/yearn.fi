import { Header } from '@demo/components/Header'
import { mockVault } from '@demo/mock'
import { Widget } from '@nextgen/components/widget'
import { WidgetRewards } from '@nextgen/components/widget/WidgetRewards'
import { WidgetActionType } from '@nextgen/types'
import type { ReactElement } from 'react'

function Index(): ReactElement {
  return (
    <div className={'z-50 w-full bg-neutral-100 pt-20'}>
      <div className={'relative mx-auto w-full max-w-[1232px]'}>
        <Header />
        <div>
          <div className={'flex flex-col-reverse md:flex-row gap-6 md:items-start'}>
            <div className={'w-full md:w-[65%] h-[2000px]'}>
              <div className={'w-full h-full bg-neutral-200 rounded-lg'}>
                <div className="h-[1000px]"></div>
              </div>
            </div>
            <div className={'w-full md:w-[35%] md:sticky md:top-6 md:self-start'}>
              <div className={'w-full h-[400px] bg-neutral-200 rounded-lg'}>
                <div className="flex flex-col gap-2">
                  <WidgetRewards vaultType="v3" vaultAddress={mockVault.address} handleRewardsSuccess={() => {}} />
                  <Widget
                    vaultType="v3"
                    vaultAddress={mockVault.address}
                    actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
                  />
                  <Widget
                    vaultType="v3"
                    vaultAddress={mockVault.address}
                    actions={[WidgetActionType.Stake, WidgetActionType.Unstake]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Index
