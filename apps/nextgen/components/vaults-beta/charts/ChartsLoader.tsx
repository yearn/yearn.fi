type ChartsLoaderProps = {
  loadingState?: string
}

export default function ChartsLoader({ loadingState = 'Loading charts' }: ChartsLoaderProps) {
  return (
    <div className={'absolute inset-0 flex items-center rounded-lg justify-center bg-white/30 backdrop-blur-sm z-10'}>
      <div className={'flex flex-col items-center rounded-lg text-neutral-600'}>
        <div className={'relative flex h-12 w-12 items-center justify-center'}>
          <div
            className={'absolute inset-0 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin'}
          />
          <img src={'/logo.svg'} alt={'Yearn Finance'} width={32} height={32} className={'z-10'} />
        </div>
        <p className={'mt-3 text-xs font-medium uppercase tracking-wide'}>{loadingState}</p>
      </div>
    </div>
  )
}
