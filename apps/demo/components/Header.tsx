import Link from '@components/Link'
import { mockVault } from '@demo/mock'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { cl } from '@lib/utils/cl'
import { VaultDetailsHeader } from '@vaults-v3/components/details/VaultDetailsHeader'

export const Header = () => {
  return (
    <header
      className={cl(
        'h-full rounded-3xl',
        'pt-6 pb-6 md:pb-10 px-4 md:px-8',
        'bg-[linear-gradient(73deg,#D21162_24.91%,#2C3DA6_99.66%)]',
        'relative flex flex-col items-center justify-center'
      )}
    >
      <nav className={'mb-4 hidden self-start md:mb-2 md:block'}>
        <Link href={'/v3'} className={'w-fit block'}>
          <p className={'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'}>
            <span className={'pr-2 leading-[normal]'}>&#10229;</span>
            {'  Back'}
          </p>
        </Link>
      </nav>
      <div className={'absolute -top-10 md:-top-6'}>
        <div
          className={cl(
            'h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-[#FAD1ED7A] backdrop-blur-sm',
            'flex justify-center items-center'
          )}
        >
          <ImageWithFallback
            className={'size-10 md:size-12'}
            src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${mockVault.chainID}/${mockVault.token.address.toLowerCase()}/logo-128.png`}
            alt={''}
            width={48}
            height={48}
          />
        </div>
      </div>
      <VaultDetailsHeader currentVault={mockVault} />
    </header>
  )
}
