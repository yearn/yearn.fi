import { cl } from '@lib/utils'
import { iconsDict, LANDING_SIDEBAR_LINKS } from '@lib/utils/constants'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactElement } from 'react'

import { TypeMarkYearn } from '../icons/TypeMarkYearn'

type TSidebarProps = {
	tabs: { route: string; title: string; isAcitve?: boolean }[]
}

export function Sidebar(props: TSidebarProps): ReactElement {
	const pathName = usePathname()

	const currentTab = pathName?.startsWith('/apps/') ? pathName?.split('/')[2] : 'apps'

	return (
		<div
			className={
				'flex h-full w-72 flex-col justify-between rounded-lg border border-gray-700/50 bg-gradient-to-b from-gray-900 to-[#1A1A1A] py-6 text-white'
			}>
			<div>
				<div className={'px-4'}>
					<div className={'mb-4 ml-2'}>
						<Link href={'/'} className={'flex w-fit items-center'}>
							<TypeMarkYearn className={'w-32'} color={'white'} />
							{/* <span className={'ml-2 text-xl text-white'}>{'Yearn'}</span> */}
						</Link>
					</div>
					{/* <div className={'mb-4'}>
						<PromoPoster />
					</div> */}
					{/* <SearchBar
						className={cl('!w-full !border-0 rounded-lg !border-white !bg-gray-600/40')}
						searchPlaceholder={'Search App'}
						searchValue={configuration.searchValue}
						onSearch={(value: string) => dispatch({searchValue: value})}
						shouldSearchByClick
						onSearchClick={onSearchClick}
					/> */}
				</div>
				<div className={'mt-6 flex flex-col'}>
					{props.tabs.map(tab => {
						const href = tab.route === 'apps' ? `/${tab.route}` : `/apps/${tab.route}`
						return (
							<Link
								className={cl(
									'py-2 px-[28px] flex gap-4 text-base hover:bg-gray-600/40',
									currentTab === tab.route ? 'text-white font-bold' : 'text-gray-400'
								)}
								shallow
								href={href}
								key={tab.route}>
								<div className={'flex size-6 items-center justify-center'}>
									{iconsDict[tab.route as keyof typeof iconsDict]}
								</div>
								<p>{tab.title}</p>
							</Link>
						)
					})}
				</div>
			</div>

			<div className={'flex flex-wrap gap-x-3 gap-y-4 px-6'}>
				{LANDING_SIDEBAR_LINKS.map(link => (
					<Link
						className={'text-xs text-gray-400 hover:text-white'}
						target={'_blank'}
						href={link.href}
						key={link.title}>
						{link.title}
					</Link>
				))}
			</div>
		</div>
	)
}
