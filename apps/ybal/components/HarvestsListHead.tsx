import {cl} from '@yearn-finance/web-lib/utils/cl';

import type {ReactElement} from 'react';

type THeadLabelProps = {
	label: string;
	className?: string;
	datatype?: 'text' | 'number';
}
function HeadLabel({label, className, datatype = 'text'}: THeadLabelProps): ReactElement {
	return (
		<div className={cl('yearn--table-head-label-wrapper group', className)} datatype={datatype}>
			<p className={'yearn--table-head-label'}>
				{label}
			</p>
		</div>
	);
}

function HarvestListHead(): ReactElement {
	return (
		<div className={'yearn--table-head-wrapper'}>
			<div className={'yearn--table-head-token-section'}>
				<HeadLabel label={'Token'} />
			</div>
			<div className={'yearn--table-head-data-section grid-cols-9'}>
				<HeadLabel label={'Gain'} datatype={'number' }/>
				<HeadLabel label={'Value'} className={'col-span-2'} datatype={'number' }/>
				<HeadLabel label={'Date'} className={'col-span-3'} datatype={'number' }/>
				<HeadLabel label={'Transaction'} className={'col-span-3'} datatype={'number' }/>
			</div>
		</div>
	);
}

export {HarvestListHead};
