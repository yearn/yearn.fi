import {z} from 'zod';
import {addressSchema} from '@common/schemas/custom/addressSchema';

export const ySettingsForNetworkSchema = z.object({
	rpcURI: z.string().optional(),
	yDaemonURI: z.string().optional(),
	graphURI: z.string().optional(),
	metaURI: z.string().optional(),
	apiURI: z.string().optional(),
	explorerBaseURI: z.string().optional(),
	lensOracleAddress: addressSchema.optional(),
	partnerContractAddress: addressSchema.optional()
});

export type TSettingsForNetwork = z.infer<typeof ySettingsForNetworkSchema>;
