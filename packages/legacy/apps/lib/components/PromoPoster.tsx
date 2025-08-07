import type { ReactElement } from 'react'

export function PromoPoster(): ReactElement {
  return (
    <div
      className={
        'border-1 relative flex max-w-[610px] flex-col rounded-lg border border-gray-600/50 bg-gradient-to-b from-gray-900 to-[#1A1A1A] p-4 hover:from-[#1A1A1A] hover:to-[#262626]'
      }>
      <p className={'text-sm text-gray-400'}>
        {
          'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.'
        }
      </p>
    </div>
  )
}
