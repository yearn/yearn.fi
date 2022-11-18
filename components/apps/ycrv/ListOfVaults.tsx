/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {ReactElement, ReactNode, useMemo} from 'react';
import {usePagination, useSortBy, useTable} from 'react-table';
import Link from 'next/link';
import {Chevron} from '@yearn-finance/web-lib/icons';
import {format} from '@yearn-finance/web-lib/utils';
import IconChevronPlain from 'components/icons/IconChevronPlain';

type	TWorkLogs = {
	asset: string,
	tvl: number,
	tir: number,
	availableToStake: number,
	staked: number,
	button: string
}
function	ListOfVaults(): ReactElement {
	const data = useMemo((): TWorkLogs[] => ([
		{
			asset: 'Curve KP3R-ETH',
			tvl: 69420420.42,
			tir: 69420.42,
			availableToStake: 84124.42,
			staked: 94214.42,
			button: 'stake'
		}, {
			asset: 'Curve USDN',
			tvl: 14156141.45,
			tir: 44444.12,
			availableToStake: 69420.42,
			staked: 18745.44,
			button: 'stake'
		}, {
			asset: 'Curve CRV-ETH',
			tvl: 7842454.10,
			tir: 4445.45,
			availableToStake: 1245.14,
			staked: 454.24,
			button: 'stake'
		}
	]
		// logs.map((log): unknown => ({
		// 	date: format.date(Number(log.time) * 1000, true),
		// 	jobName: 'Unverified Job',
		// 	earnedKp3r: format.toNormalizedAmount(log.earned, 18),
		// 	earnedUsd: format.amount(format.toNormalizedValue(log.earned, 18) * (10), 2, 2),
		// 	fees: format.toNormalizedAmount(log.fees, 18),
		// 	linkOut: 'log.job'
		// }))
	), []);
		
	const columns = useMemo((): unknown[] => [
		{Header: 'Asset', accessor: 'asset', className: 'cell-start pr-8', sortType: 'basic'},
		{
			Header: 'TVL',
			accessor: 'tvl',
			className: 'cell-end pr-8',
			sortType: 'basic',
			Cell: ({value}: {value: number}): ReactNode => format.amount(value, 2, 2)
		},
		{
			Header: 'Total incoming rewards',
			accessor: 'tir',
			className: 'cell-end pr-8',
			sortType: 'basic',
			Cell: ({value}: {value: number}): ReactNode => format.amount(value, 2, 2)
		},
		{
			Header: 'Available to stake',
			accessor: 'availableToStake',
			className: 'cell-end pr-8',
			sortType: 'basic',
			Cell: ({value}: {value: number}): ReactNode => format.amount(value, 2, 2)
		},
		{
			Header: 'Staked',
			accessor: 'staked',
			className: 'cell-end pr-20',
			sortType: 'basic',
			Cell: ({value}: {value: number}): ReactNode => format.amount(value, 2, 2)

		},
		{
			Header: '',
			accessor: 'button',
			className: 'cell-end pl-1.5',
			disableSortBy: true,
			Cell: ({value}: {value: string}): ReactNode => (
				<button
					className={'flex h-8 items-center justify-center border border-neutral-900 px-7'}
					onClick={(event: any): void => {
						event.stopPropagation();
						window.open(`https://etherscan.io/address/${value}`, '_blank');
					}}>
					{'Stake'}
				</button>
			)
		}
	], []);

	const {
		getTableProps,
		getTableBodyProps,
		headerGroups,
		prepareRow,
		page,
		canPreviousPage,
		canNextPage,
		pageOptions,
		nextPage,
		previousPage,
		state: {pageIndex}
	} = useTable({columns, data, initialState: {pageSize: 50}}, useSortBy, usePagination);
	
	function	renderPreviousChevron(): ReactElement {
		if (!canPreviousPage) {
			return (<Chevron className={'h-4 w-4 cursor-not-allowed opacity-50'} />);
		}
		return (
			<Chevron
				className={'h-4 w-4 cursor-pointer'}
				onClick={previousPage} />
		);
	}

	function	renderNextChevron(): ReactElement {
		if (!canNextPage) {
			return (<Chevron className={'h-4 w-4 rotate-180 cursor-not-allowed opacity-50'} />);
		}
		return (
			<Chevron
				className={'h-4 w-4 rotate-180 cursor-pointer'}
				onClick={nextPage} />
		);
	}

	// if (!isInit && logs.length === 0) {
	// 	return (
	// 		<div className={'flex h-full min-h-[112px] items-center justify-center'}>
	// 			<Loader className={'h-6 w-6 animate-spin'} />
	// 		</div>
	// 	);
	// }

	return (
		<div className={'mt-10 flex w-full flex-col overflow-x-scroll'}>
			<table
				{...getTableProps()}
				className={'min-w-full overflow-x-scroll'}>
				<thead>
					{headerGroups.map((headerGroup: any): ReactElement => (
						<tr key={headerGroup.getHeaderGroupProps().key} {...headerGroup.getHeaderGroupProps()}>
							{headerGroup.headers.map((column: any): ReactElement => (
								<th
									key={column.getHeaderProps().key}
									{...column.getHeaderProps(column.getSortByToggleProps([
										{
											className: 'pb-6 text-xs text-neutral-900 font-normal whitespace-pre'
										}
									]))}>
									<div className={`flex flex-row items-center ${column.className}`}>
										{column.render('Header')}
										{column.canSort ? (
											<div className={'ml-1'}>
												{column.isSorted
													? column.isSortedDesc
														? <IconChevronPlain className={'h-4 w-4 cursor-pointer text-neutral-500'} />
														: <IconChevronPlain className={'h-4 w-4 rotate-180 cursor-pointer text-neutral-500'} />
													: <IconChevronPlain className={'h-4 w-4 cursor-pointer text-neutral-300 transition-colors hover:text-neutral-500'} />}
											</div>
										) : null}
									</div>
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody {...getTableBodyProps()}>
					{page.map((row: any): ReactElement => {
						prepareRow(row);
						return (
							<Link key={row.getRowProps().key} href={`/jobs/${row.values.linkOut}`}>
								<tr {...row.getRowProps()} className={'cursor-pointer transition-colors hover:bg-white'}>
									{row.cells.map((cell: any): ReactElement => {
										return (
											<td
												key={cell.getCellProps().key}
												{...cell.getCellProps([
													{
														className: 'pb-2 text-base font-mono whitespace-pre',
														style: cell.column.style
													}
												])
												}>
												<div className={`flex flex-row items-center ${cell.column.className}`}>
													{cell.column.Header === 'Asset' ? (
														<div className={'mr-4 mb-4 h-8 w-8 rounded-full bg-neutral-300'}>

														</div>
													) : null}
													<div>
														{cell.render('Cell')}
														{cell.column.Header === 'Total incoming rewards' ? (
															<p className={'text-xs text-neutral-500'}>{'~ every 4d'}</p>
														) : <p className={'invisible text-xs opacity-0'}>{'-'}</p>}
													</div>
												</div>
											</td>
										);
									})}
								</tr>
							</Link>
						);
					})}
				</tbody>
			</table>
			{canPreviousPage || canNextPage ? (
				<div className={'flex flex-row items-center justify-end space-x-2 p-4'}>
					{renderPreviousChevron()}
					<p className={'select-none text-sm tabular-nums'}>
						{`${pageIndex + 1}/${pageOptions.length}`}
					</p>
					{renderNextChevron()}
				</div>
			) : null}
		</div>
	);
}

export default ListOfVaults;