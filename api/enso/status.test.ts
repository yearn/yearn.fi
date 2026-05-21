import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './status'

type TMockVercelResponse = VercelResponse & {
  body: unknown
  statusCode: number
}

function createMockResponse(): TMockVercelResponse {
  const response: {
    body: unknown
    json: (payload: unknown) => unknown
    status: (code: number) => unknown
    statusCode: number
  } = {
    body: undefined,
    statusCode: 200,
    json(payload: unknown) {
      response.body = payload
      return response
    },
    status(code: number) {
      response.statusCode = code
      return response
    }
  }

  return response as unknown as TMockVercelResponse
}

function readStatusResponse() {
  const res = createMockResponse()

  handler({ method: 'GET' } as VercelRequest, res)

  return {
    body: res.body,
    statusCode: res.statusCode
  }
}

describe('Enso status route', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not disclose whether the Enso API key is configured', () => {
    vi.stubEnv('ENSO_API_KEY', 'test-api-key')
    const configuredResponse = readStatusResponse()

    vi.unstubAllEnvs()
    const unconfiguredResponse = readStatusResponse()

    expect(configuredResponse).toEqual(unconfiguredResponse)
    expect(configuredResponse.statusCode).toBe(200)
    expect(configuredResponse.body).toEqual({ status: 'ok' })
    expect(configuredResponse.body).not.toHaveProperty('configured')
    expect(configuredResponse.body).not.toHaveProperty('apiKey')
  })
})
