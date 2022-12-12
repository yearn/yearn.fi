import React from 'react';

import type {ReactElement} from 'react';

function	HarvestListHead(): ReactElement {
	return (
		<div className={'yearn--table-head-wrapper'}>
			<div className={'yearn--table-head-token-section'}>
				<div className={'yearn--table-head-label-wrapper group'}>
					<p className={'yearn--table-head-label'}>
						{'Token'}
					</p>
				</div>
			</div>
			<div className={'yearn--table-head-data-section grid-cols-9'}>
				<div className={'yearn--table-head-label-wrapper group'} datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Gain'}
					</p>
				</div>

				<div className={'yearn--table-head-label-wrapper group col-span-2'} datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Value'}
					</p>
				</div>

				<div className={'yearn--table-head-label-wrapper group col-span-3'} datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Date'}
					</p>
				</div>

				<div className={'yearn--table-head-label-wrapper group col-span-3'} datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Transaction'}
					</p>
				</div>
			</div>
		</div>
	);
}

export {HarvestListHead};
