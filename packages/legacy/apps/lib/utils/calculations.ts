/************************************************************************************************
 * Calculate boost based on veYFI amount, total deposits, and current deposit amount
 * Handles bigint values properly by converting to numbers for ratio calculation
 ************************************************************************************************/
export function calculateBoostFromVeYFI(
	veYFIAmount: number,
	veYFITotalSupply: number,
	totalDeposited: number,
	depositAmount: number
): number {
	const veRatio = veYFITotalSupply ? veYFIAmount / veYFITotalSupply : 0;
	const boost = depositAmount ? 1 + veRatio * 9 + (totalDeposited * veRatio * 9) / depositAmount : 1;
	return Math.min(boost, 10);
}
