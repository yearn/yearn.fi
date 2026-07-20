import { YearnLogoSpinner } from '@shared/components/YearnLogoSpinner'

type ChartsLoaderProps = {
  loadingState?: string
}

export default function ChartsLoader({ loadingState = 'Loading charts' }: ChartsLoaderProps) {
  return (
    <div className={'absolute inset-0 flex items-center rounded-lg justify-center bg-surface/70 backdrop-blur-sm z-10'}>
      <div className={'flex flex-col items-center rounded-lg text-text-secondary'}>
        <YearnLogoSpinner />
        <p className={'mt-3 text-xs font-medium uppercase tracking-wide'}>{loadingState}</p>
      </div>
    </div>
  )
}
