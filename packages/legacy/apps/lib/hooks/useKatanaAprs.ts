import {useEffect, useState} from 'react';
import axios from 'axios';

const CACHE_KEY = 'katana-aprs-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 min 

export type TKatanaAprs = {
	[key: string]: {
		apr: {
			netAPR: number;
			extra: TAprData;
		};
	};
};

export type TAprData = {
	katanaRewardsAPR: number; // legacy field for App rewards from Morpho, Sushi, Yearn, etc.
	katanaAppRewardsAPR: number; // rewards from Morpho, Sushi, Yearn, etc.
	FixedRateKatanaRewards: number; // fixed rate rewards from Katana
	katanaBonusAPY: number; // bonus APR from Katana for not leaving the vault
	extrinsicYield: number; // yield from underlying assets in bridge
	katanaNativeYield: number; // yield from katana markets (the netAPR). This is subsidized if low.
};

type TCacheData = {
	data: TKatanaAprs;
	timestamp: number;
};

export const useKatanaAprs = (): {data: Partial<TKatanaAprs>; isLoading: boolean; error: Error | null} => {
	const [data, set_data] = useState<Partial<TKatanaAprs>>({});
	const [isLoading, set_isLoading] = useState(true);
	const [error, set_error] = useState<Error | null>(null);

	useEffect(() => {
		const fetchData = async (): Promise<void> => {
			try {
				// Check cache first
				const cachedString = localStorage.getItem(CACHE_KEY);
				if (cachedString) {
					const cached: TCacheData = JSON.parse(cachedString);
					const now = Date.now();

					// Return cached data if within TTL
					if (now - cached.timestamp < CACHE_TTL) {
						set_data(cached.data);
						set_isLoading(false);
						return;
					}
				}

				const freshData = await axios
					.get('https://katana-apr-service-git-chore-update-yearn.vercel.app/api/vaults')
					.then(res => res.data);

				const cacheData: TCacheData = {
					data: freshData,
					timestamp: Date.now()
				};
				localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

				set_data(freshData);
				set_error(null);
			} catch (err) {
				set_error(err as Error);
				const cachedString = localStorage.getItem(CACHE_KEY);
				if (cachedString) {
					const cached: TCacheData = JSON.parse(cachedString);
					set_data(cached.data);
				}
			} finally {
				set_isLoading(false);
			}
		};

		fetchData();
	}, []);

	return {data, isLoading, error};
};
