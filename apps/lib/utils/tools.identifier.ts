import XXH from 'xxhashjs';

export function createUniqueID(msg: string): string {
	const hash = XXH.h32(0x536d6f6c).update(msg).digest().toString(16);
	return hash;
}
