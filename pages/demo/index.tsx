import { Widget } from '@nextgen/components/widget'
import type { ReactElement } from 'react'

function Index(): ReactElement {
  return (
    <div className={'z-50 w-full bg-neutral-100 pt-20'}>
      <div className={'relative mx-auto w-full max-w-[1232px]'}>
        <div className={'absolute inset-x-0 top-0 w-full px-4 pt-6 md:pt-16'}>
          <Widget />
        </div>
      </div>
    </div>
  )
}

export default Index
