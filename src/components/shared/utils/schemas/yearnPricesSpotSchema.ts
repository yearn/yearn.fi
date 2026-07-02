import * as z from 'zod'

const yearnPricesSpotPricePointSchema = z
  .object({
    timestamp: z.number().nullable().optional(),
    price: z.number(),
    confidence: z.number().nullable().optional(),
    source: z.string().nullable().optional()
  })
  .passthrough()

const yearnPricesSpotCoinSchema = z
  .object({
    prices: z.array(yearnPricesSpotPricePointSchema).default([]).catch([])
  })
  .passthrough()

export const yearnPricesSpotResponseSchema = z
  .object({
    coins: z.record(z.string(), yearnPricesSpotCoinSchema).default({}).catch({})
  })
  .passthrough()

export type TYearnPricesSpotResponse = z.infer<typeof yearnPricesSpotResponseSchema>
