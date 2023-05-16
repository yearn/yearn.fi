import {z} from 'zod';
import {addressSchema} from '@common/schemas/custom/addressSchema';

export const yDaemonPriceSchema = z.string();

export const yDaemonPricesSchema = z.record(addressSchema, yDaemonPriceSchema);

export type TYDaemonPrice = z.infer<typeof yDaemonPriceSchema>;

export type TYDaemonPrices = z.infer<typeof yDaemonPricesSchema>;
