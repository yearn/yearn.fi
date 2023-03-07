import React, {useMemo} from 'react';
import Balancer from 'react-wrap-balancer';
import {motion} from 'framer-motion';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {Dropdown} from '@common/components/TokenDropdown';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import ArrowDown from '@common/icons/ArrowDown';
import CardTransactorContextApp, {useCardTransactor} from '@yCRV/components/CardTransactorWrapper';
import {CardVariants, CardVariantsInner} from '@yCRV/utils/animations';
import {LEGACY_OPTIONS_FROM, LEGACY_OPTIONS_TO} from '@yCRV/utils/zapOptions';

import type {ChangeEvent, ReactElement} from 'react';
import type {TDropdownOption} from '@common/types/types';

function	CardMigrateLegacy(): ReactElement | null {
	const	{isActive} = useWeb3();
	const	{balances} = useWallet();
	const	{vaults, prices} = useYearn();
	const	{
		txStatusApprove, txStatusZap,
		selectedOptionFrom, set_selectedOptionFrom,
		selectedOptionTo, set_selectedOptionTo,
		amount, set_amount,
		set_hasTypedSomething,
		toVaultAPY, expectedOutWithSlippage,
		allowanceFrom, onApproveFrom, onZap
	} = useCardTransactor();

	const	ycrvPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[YCRV_TOKEN_ADDRESS] || 0),
			6
		)
	), [prices]);
	const	ycrvCurvePoolPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[YCRV_CURVE_POOL_ADDRESS] || 0),
			6
		)
	), [prices]);

	function	renderButton(): ReactElement {
		const	balanceForInputToken = formatBN(balances?.[toAddress(selectedOptionFrom.value)]?.raw);
		const	isAboveBalance = formatBN(amount?.raw).gt(balanceForInputToken) || balanceForInputToken.eq(Zero);

		if (txStatusApprove.pending || (amount.raw).gt(allowanceFrom)) {
			return (
				<Button
					onClick={onApproveFrom}
					className={'w-full'}
					isBusy={txStatusApprove.pending}
					isDisabled={
						!isActive
						|| (amount.raw).isZero()
						|| isAboveBalance
					}>
					{isAboveBalance ? 'Insufficient balance' : `Approve ${selectedOptionFrom?.label || 'token'}`}
				</Button>
			);
		}

		return (
			<Button
				onClick={onZap}
				className={'w-full'}
				isBusy={txStatusZap.pending}
				isDisabled={
					!isActive ||
					(amount.raw).isZero() ||
					amount.raw.gt(balanceForInputToken)
				}>
				{isAboveBalance && !amount.raw.isZero() ? 'Insufficient balance' : 'Swap'}
			</Button>
		);
	}

	return (
		<>
			<div aria-label={'card title'} className={'flex flex-col pb-8'}>
				<Balancer>
					<h2 className={'text-3xl font-bold'}>{'Out with the old,'}</h2>
					<h2 className={'text-3xl font-bold'}>{'in with the new'}</h2>
				</Balancer>
			</div>
			<div aria-label={'card description'} className={'w-[98%] pb-10'}>
				<Balancer>
					<p className={'text-neutral-600'}>{'yveCRV and yvBOOST are no longer supported (RIP), but you can easily migrate them to our new and improved tokens. Simply convert below and start earning that sweet sweet yield.'}</p>
				</Balancer>
			</div>

			<div className={'grid grid-cols-2 gap-4'}>
				<label className={'relative z-20 flex flex-col space-y-1'}>
					<p className={'text-base text-neutral-600'}>{'Select Legacy Token'}</p>
					<Dropdown
						defaultOption={LEGACY_OPTIONS_FROM[0]}
						options={LEGACY_OPTIONS_FROM}
						selected={selectedOptionFrom}
						onSelect={(option: TDropdownOption): void => {
							performBatchedUpdates((): void => {
								set_selectedOptionFrom(option);
								set_amount(toNormalizedBN(balances[toAddress(option.value)]?.raw));
							});
						}} />
					<p className={'pl-2 !text-xs font-normal text-green-600'}>
						{`APY ${formatPercent(0)}`}
					</p>
				</label>
				<div className={'flex flex-col space-y-1'}>
					<label
						htmlFor={'amountLegacy'}
						className={'text-base text-neutral-600'}>
						{'Amount'}
					</label>
					<div className={'flex h-10 items-center bg-neutral-100 p-2'}>
						<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
							<input
								id={'amountLegacy'}
								className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
								type={'text'}
								disabled={!isActive}
								value={amount.normalized}
								onChange={(e: ChangeEvent<HTMLInputElement>): void => {
									performBatchedUpdates((): void => {
										set_amount(handleInputChangeEventValue(e.target.value, balances[toAddress(selectedOptionFrom.value)]?.decimals || 18));
										set_hasTypedSomething(true);
									});
								}} />
							<button
								onClick={(): void => set_amount(toNormalizedBN(balances[toAddress(selectedOptionFrom.value)]?.raw))}
								className={'cursor-pointer text-sm text-neutral-500 transition-colors hover:text-neutral-900'}>
								{'max'}
							</button>
						</div>
					</div>
					<p className={'pl-2 text-xs font-normal text-neutral-600'}>
						{formatCounterValue(
							amount?.normalized || 0,
							toAddress(selectedOptionFrom.value) === YCRV_TOKEN_ADDRESS
								? ycrvPrice || 0
								: toAddress(selectedOptionFrom.value) === YCRV_CURVE_POOL_ADDRESS
									? ycrvCurvePoolPrice || 0
									: balances?.[toAddress(selectedOptionFrom.value)]?.normalizedPrice
									|| vaults?.[toAddress(selectedOptionFrom.value)]?.tvl?.price
									|| 0
						)}
					</p>
				</div>
			</div>

			<div className={'mt-2 mb-4 hidden grid-cols-2 gap-4 md:grid lg:mt-8 lg:mb-10'}>
				<div className={'flex items-center justify-center'}>
					<ArrowDown />
				</div>
				<div className={'flex items-center justify-center'}>
					<ArrowDown />
				</div>
			</div>

			<div className={'mt-4 mb-8 grid grid-cols-2 gap-4 md:mt-0'}>
				<label className={'relative z-10 flex flex-col space-y-1'}>
					<p className={'text-base text-neutral-600'}>{'Migrate To'}</p>
					<Dropdown
						defaultOption={LEGACY_OPTIONS_TO[0]}
						options={LEGACY_OPTIONS_TO}
						selected={selectedOptionTo}
						onSelect={(option: TDropdownOption): void => set_selectedOptionTo(option)} />
					<p className={'pl-2 !text-xs font-normal !text-green-600'}>
						{toVaultAPY}
					</p>
				</label>
				<div className={'flex flex-col space-y-1'}>
					<div>
						<p className={'hidden text-base text-neutral-600 md:block'}>{'You will receive minimum'}</p>
						<p className={'block text-base text-neutral-600 md:hidden'}>{'You will receive min'}</p>
					</div>
					<div className={'flex h-10 items-center text-clip bg-neutral-300 p-2'}>
						<b className={'overflow-x-scroll scrollbar-none'}>
							{expectedOutWithSlippage}
						</b>
					</div>
					<p className={'pl-2 text-xs font-normal text-neutral-600'}>
						{formatCounterValue(
							expectedOutWithSlippage,
							toAddress(selectedOptionTo.value) === YCRV_TOKEN_ADDRESS
								? ycrvPrice || 0
								: toAddress(selectedOptionFrom.value) === YCRV_CURVE_POOL_ADDRESS
									? ycrvCurvePoolPrice || 0
									: balances?.[toAddress(selectedOptionTo.value)]?.normalizedPrice
									|| vaults?.[toAddress(selectedOptionTo.value)]?.tvl?.price
									|| 0
						)}
					</p>
				</div>
			</div>

			<div aria-label={'card actions'}>
				<div className={'mb-3'}>
					{renderButton()}
				</div>
			</div>
		</>
	);
}

function	CardMigrateLegacyWrapper(): ReactElement {
	const {txStatusApprove, txStatusZap} = useCardTransactor();

	return (
		<div>
			<motion.div
				initial={'rest'}
				whileHover={'hover'}
				animate={'rest'}
				variants={CardVariants as never}
				className={'hidden h-[733px] w-[592px] items-center justify-start lg:flex'}
				custom={!txStatusApprove.none || !txStatusZap.none}>
				<motion.div
					variants={CardVariantsInner as never}
					custom={!txStatusApprove.none || !txStatusZap.none}
					className={'h-[701px] w-[560px] bg-neutral-200 p-12'}>
					<CardMigrateLegacy />
				</motion.div>
			</motion.div>
			<div className={'w-full bg-neutral-200 p-4 md:p-8 lg:hidden'}>
				<CardMigrateLegacy />
			</div>
		</div>
	);
}

function	WithCardTransactor(): ReactElement {
	return (
		<CardTransactorContextApp
			defaultOptionFrom={LEGACY_OPTIONS_FROM[0]}
			defaultOptionTo={LEGACY_OPTIONS_TO[0]}>
			<CardMigrateLegacyWrapper />
		</CardTransactorContextApp>
	);
}
export default WithCardTransactor;
