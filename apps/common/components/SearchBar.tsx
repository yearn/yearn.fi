import {cl} from '@builtbymom/web3/utils';

import type {ChangeEvent, ReactElement} from 'react';

type TSearchBar = {
	searchPlaceholder: string;
	searchValue: string;
	onSearch: (searchValue: string) => void;
	className?: string;
	iconClassName?: string;
};

export function SearchBar(props: TSearchBar): ReactElement {
	return (
		<>
			<div
				className={cl(
					props.className,
					'mt-1 flex h-10 w-full max-w-md items-center border border-neutral-0 bg-neutral-0 p-2 md:w-2/3'
				)}>
				<div className={'relative flex h-10 w-full flex-row items-center justify-between'}>
					<input
						id={'search'}
						suppressHydrationWarning
						className={
							'h-10 w-full overflow-x-scroll border-none bg-transparent px-0 py-2 text-base outline-none scrollbar-none placeholder:text-neutral-400'
						}
						type={'text'}
						placeholder={props.searchPlaceholder}
						value={props.searchValue || ''}
						onChange={(e: ChangeEvent<HTMLInputElement>): void => {
							props.onSearch(e.target.value);
						}}
					/>
					<div className={cl(props.iconClassName, 'absolute right-0 text-neutral-400')}>
						<svg
							width={'20'}
							height={'20'}
							viewBox={'0 0 24 24'}
							fill={'none'}
							xmlns={'http://www.w3.org/2000/svg'}>
							<path
								fillRule={'evenodd'}
								clipRule={'evenodd'}
								d={
									'M10 1C5.02972 1 1 5.02972 1 10C1 14.9703 5.02972 19 10 19C12.1249 19 14.0779 18.2635 15.6176 17.0318L21.2929 22.7071C21.6834 23.0976 22.3166 23.0976 22.7071 22.7071C23.0976 22.3166 23.0976 21.6834 22.7071 21.2929L17.0318 15.6176C18.2635 14.0779 19 12.1249 19 10C19 5.02972 14.9703 1 10 1ZM3 10C3 6.13428 6.13428 3 10 3C13.8657 3 17 6.13428 17 10C17 13.8657 13.8657 17 10 17C6.13428 17 3 13.8657 3 10Z'
								}
								fill={'currentcolor'}
							/>
						</svg>
					</div>
				</div>
			</div>
		</>
	);
}
