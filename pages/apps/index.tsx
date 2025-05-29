import {type ReactElement} from 'react';
import {useMountEffect} from '@react-hookz/web';
import {useSearch} from '@common/contexts/useSearch';

import CombinedVaultsTable from './components/CombinedVaultsTable';
import {VaultsBanner} from './components/VaultsBanner';
import {VaultsPositions} from './components/VaultsPositions';

export default function Home(): ReactElement {
	const {dispatch} = useSearch();

	useMountEffect(() => {
		dispatch({searchValue: ''});
	});

	return (
		<div className={'relative mb-4 mt-24 flex w-full justify-start md:mt-10'}>
			<div className={'w-full p-6 !pl-8 pb-24 pt-0 md:px-2'}>
				<div className={'flex flex-col gap-y-10'}>
					<VaultsBanner />
					<VaultsPositions />
					<div className={'flex flex-col gap-7'}>
						<div className={'flex flex-col gap-4 rounded-[16px] border border-white/5 bg-white/5 p-4'}>
							<CombinedVaultsTable />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
