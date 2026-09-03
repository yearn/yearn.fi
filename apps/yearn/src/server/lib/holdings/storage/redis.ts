import { Redis } from '@upstash/redis'
import { holdingsConfig } from '../config'

const holdingsRedisState = {
  client: null as Redis | null,
  disabled: false
}

function hasRedisConfig(): boolean {
  return Boolean(holdingsConfig.redisUrl && holdingsConfig.redisToken)
}

function shouldDisableRedis(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('unauthorized') || message.includes('invalid token') || message.includes('forbidden')
}

function disableHoldingsRedis(reason: string, error?: unknown): void {
  holdingsRedisState.disabled = true
  holdingsRedisState.client = null
  console.error(`[Holdings Redis] Disabling Redis-backed storage: ${reason}`, error ?? '')
}

export function handleHoldingsRedisError(reason: string, error: unknown): void {
  if (shouldDisableRedis(error)) {
    disableHoldingsRedis(reason, error)
    return
  }

  console.error(`[Holdings Redis] ${reason}:`, error)
}

export function isHoldingsStorageEnabled(): boolean {
  return hasRedisConfig() && !holdingsRedisState.disabled
}

export function getHoldingsRedisClient(): Redis | null {
  if (!isHoldingsStorageEnabled()) {
    return null
  }

  if (!holdingsRedisState.client) {
    holdingsRedisState.client = new Redis({
      url: holdingsConfig.redisUrl as string,
      token: holdingsConfig.redisToken as string
    })
  }

  return holdingsRedisState.client
}
