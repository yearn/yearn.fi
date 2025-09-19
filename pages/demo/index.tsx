import { Widget } from '@nextgen/components/widget'
import { WidgetActionType } from '@nextgen/types'
import type { ReactElement } from 'react'

function Index(): ReactElement {
  return (
    <div className={'z-50 w-full bg-neutral-100 pt-20'}>
      <div className={'relative mx-auto w-full max-w-[1232px]'}>
        <div className={'absolute inset-x-0 top-0 w-full px-4 pt-6 md:pt-16 bg-white/5'}>
          <div className="flex flex-col gap-4">
            <h3 className="text-2xl font-bold">V2</h3>
            <Widget
              vaultType="v2"
              vaultAddress="0x27B5739e22ad9033bcBf192059122d163b60349D"
              actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
            />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-2xl font-bold">V3</h3>
            <Widget
              vaultType="v3"
              vaultAddress="0x182863131F9a4630fF9E27830d945B1413e347E8"
              actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Index
