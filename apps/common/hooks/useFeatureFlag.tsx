import {useSearchParams} from 'next/navigation';

export function useFeatureFlag(flag: string): [boolean] {
	const searchParams = useSearchParams();

	const flags = searchParams.get('features')?.split(',') ?? [];

	const isEnabled = flags.includes(flag);

	return [isEnabled];
}
