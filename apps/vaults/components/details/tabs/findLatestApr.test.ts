import {findLatestApr} from './findLatestApr';

describe('findLatestApr', (): void => {
	it('should return 0 when no reports are provided', (): void => {
		expect(findLatestApr()).toBe(0);
	});

	it('should return 0 when an empty array is provided', (): void => {
		expect(findLatestApr([])).toBe(0);
	});

	it('should return 0 if a result item has no APR', (): void => {
		const reports = [
			{
				timestamp: '1000',
				results: [
					{
						APR: ''
					}
				]
			}
		];

		expect(findLatestApr(reports)).toBe(0);
	});

	it('should return 0 if a result item has an invalid APR', (): void => {
		const reports = [
			{
				timestamp: '1000',
				results: [
					{
						APR: 'foo'
					}
				]
			}
		];

		expect(findLatestApr(reports)).toBe(0);
	});

	it('should return the correct APR for a single report', (): void => {
		const reports = [
			{
				timestamp: '1000',
				results: [
					{
						APR: '0.05'
					}
				]
			}
		];

		expect(findLatestApr(reports)).toBe(5);
	});

	it('should return the correct APR for multiple reports', (): void => {
		const reports = [
			{
				timestamp: '1000',
				results: [
					{
						APR: '0.05'
					}
				]
			},
			{
				timestamp: '3000',
				results: [
					{
						APR: '0.1'
					}
				]
			},
			{
				timestamp: '2000',
				results: [
					{
						APR: '0.07'
					}
				]
			}
		];

		expect(findLatestApr(reports)).toBe(10);
	});
});
