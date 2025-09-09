/*******************************************************************************
 ** RPC Rate Limiter for Base Chain
 **
 ** This module provides rate limiting functionality specifically for Base chain
 ** RPC calls to prevent 429 errors. It uses a token bucket algorithm to limit
 ** the number of requests per time window.
 ******************************************************************************/

type RateLimiterConfig = {
  maxRequests: number
  windowMs: number
  delayMs: number
}

const CHAIN_RATE_CONFIGS: Record<number, RateLimiterConfig> = {
  8453: {
    // Base
    maxRequests: 5,
    windowMs: 1000,
    delayMs: 200
  }
}

const DEFAULT_RATE_CONFIG: RateLimiterConfig = {
  maxRequests: 20,
  windowMs: 1000,
  delayMs: 50
}

class RateLimiter {
  private requests: number[] = []
  private config: RateLimiterConfig
  private queue: Array<() => void> = []
  private processing = false

  constructor(chainId: number) {
    this.config = CHAIN_RATE_CONFIGS[chainId] || DEFAULT_RATE_CONFIG
  }

  async throttle(): Promise<void> {
    const now = Date.now()

    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.config.windowMs)

    // If we're at the limit, wait
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = oldestRequest + this.config.windowMs - now

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime + this.config.delayMs))
        return this.throttle() // Retry after waiting
      }
    }

    // Add current request
    this.requests.push(now)
  }

  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      await this.throttle()
      const next = this.queue.shift()
      if (next) next()

      // Add delay between requests for Base chain
      if (this.config.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.delayMs))
      }
    }

    this.processing = false
  }

  enqueue(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
      this.processQueue()
    })
  }
}

// Store rate limiters per chain
const rateLimiters = new Map<number, RateLimiter>()

export function getRateLimiter(chainId: number): RateLimiter {
  if (!rateLimiters.has(chainId)) {
    rateLimiters.set(chainId, new RateLimiter(chainId))
  }
  return rateLimiters.get(chainId)!
}

/*******************************************************************************
 ** Wrap RPC calls with rate limiting for Base chain
 ******************************************************************************/
export async function rateLimitedRPC<T>(chainId: number, rpcCall: () => Promise<T>): Promise<T> {
  // Only rate limit Base chain aggressively
  if (chainId === 8453) {
    const limiter = getRateLimiter(chainId)
    await limiter.enqueue()
  }

  return rpcCall()
}
