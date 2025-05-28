import {useState} from 'react';

type TProps<T> = {
	data: T[];
	itemsPerPage: number;
};

type TUsePaginationReturn<T> = {
	currentItems: T[];
	paginationProps: {
		range: [from: number, to: number];
		pageCount: number;
		numberOfItems: number;
		onPageChange: (selectedItem: {selected: number}) => void;
	};
};

export function usePagination<T>({data, itemsPerPage}: TProps<T>): TUsePaginationReturn<T> {
	const [itemOffset, set_itemOffset] = useState(0);

	const endOffset = itemOffset + itemsPerPage;

	const currentItems = data.slice(itemOffset, endOffset);

	const handlePageChange = ({selected}: {selected: number}): void => {
		set_itemOffset((selected * itemsPerPage) % data.length);
	};

	return {
		currentItems,
		paginationProps: {
			range: [endOffset - (itemsPerPage - 1), Math.min(endOffset, data.length)],
			pageCount: Math.ceil(data.length / itemsPerPage),
			numberOfItems: data.length,
			onPageChange: handlePageChange
		}
	};
}
