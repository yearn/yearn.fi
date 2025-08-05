import {useSearch} from '@lib/contexts/useSearch'
import {IconBurgerPlain} from '@lib/icons/IconBurgerPlain'
import {IconSearch} from '@lib/icons/IconSearch'
import {LogoYearn} from '@lib/icons/LogoYearn'
import {useRouter} from 'next/router'
import {type ReactElement, useCallback} from 'react'

import {SearchBar} from './SearchBar'

export function MobileTopNav({
	isSearchOpen,
	setIsSearchOpen,
	setIsNavbarOpen
}: {
	isSearchOpen: boolean
	setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
	setIsNavbarOpen: React.Dispatch<React.SetStateAction<boolean>>
}): ReactElement {
	const {configuration, dispatch} = useSearch()
	const router = useRouter()

	const onSearchClick = useCallback(() => {
		if (!configuration.searchValue) {
			router.push('/apps')
			return
		}
		router.push(`/apps/search/${encodeURIComponent(configuration.searchValue)}`)
	}, [configuration.searchValue, router])

	return (
		<div className={'z-50 bg-gray-900'}>
			<div className={'flex w-full items-center justify-between bg-gray-900 p-4'}>
				<div className={'flex items-center gap-4'}>
					<button
						className={'flex size-8 items-center justify-center rounded-full bg-neutral-900/20 p-1.5'}
						onClick={() => setIsNavbarOpen(prev => !prev)}>
						<span className={'sr-only'}>{'Open menu'}</span>
						<IconBurgerPlain />
					</button>
					<button
						className={'hidden md:block'}
						onClick={() => {
							router.push('/')
							setIsSearchOpen(false)
						}}>
						<LogoYearn className={'size-8'} back={'text-blue-500'} front={'text-white'} />
					</button>
				</div>
				<button
					onClick={() => {
						setIsNavbarOpen(false)
						setIsSearchOpen(prev => !prev)
					}}>
					<IconSearch className={'text-white'} />
				</button>
			</div>

			{isSearchOpen && (
				<div className={'!w-full bg-gray-900 pb-6 pl-8 pr-6'}>
					<SearchBar
						className={
							'!max-w-none !rounded-lg !border-0 !border-none !bg-gray-600/40 text-white !outline-none '
						}
						searchValue={configuration.searchValue}
						onSearch={(value: string) => dispatch({searchValue: value})}
						searchPlaceholder={'Search App'}
						onSearchClick={onSearchClick}
						shouldSearchByClick
					/>
				</div>
			)}
		</div>
	)
}
