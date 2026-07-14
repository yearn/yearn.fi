import { getRequestIp, json, noContent, POST_CORS_HEADERS } from '@/server/http'

type TEnv = Record<string, string | undefined>

export type TAgentLlmConfig = {
  baseUri: string
  apiKey: string
  model: string
  maxTokens: number
}

const DEFAULT_MAX_TOKENS = 4096
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30

export function getAgentLlmConfig(env: TEnv = process.env): TAgentLlmConfig | undefined {
  const baseUri = env.AGENT_LLM_BASE_URI?.trim().replace(/\/+$/, '')
  const apiKey = env.AGENT_LLM_API_KEY?.trim()
  const model = env.AGENT_LLM_MODEL?.trim()

  if (!baseUri || !apiKey || !model) {
    return undefined
  }

  const parsedMaxTokens = Number.parseInt(env.AGENT_LLM_MAX_TOKENS ?? '', 10)
  const maxTokens = Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : DEFAULT_MAX_TOKENS

  return { baseUri, apiKey, model, maxTokens }
}

// Best-effort per-instance limiter; serverless instances each keep their own window,
// so treat this as an abuse brake, not a strict quota.
const requestLog = new Map<string, number[]>()

export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  const recent = (requestLog.get(ip) ?? []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(ip, recent)
    return false
  }

  requestLog.set(ip, [...recent, now])
  return true
}

type TChatCompletionsBody = {
  messages?: unknown
  tools?: unknown
  tool_choice?: unknown
  parallel_tool_calls?: unknown
}

// Only fields page-agent's OpenAI client sends are forwarded; model, token cap,
// and stream are forced server-side so the endpoint can't be repurposed.
export function buildUpstreamBody(body: TChatCompletionsBody, config: TAgentLlmConfig): Record<string, unknown> {
  return {
    messages: body.messages,
    ...(body.tools !== undefined && { tools: body.tools }),
    ...(body.tool_choice !== undefined && { tool_choice: body.tool_choice }),
    ...(body.parallel_tool_calls !== undefined && { parallel_tool_calls: body.parallel_tool_calls }),
    model: config.model,
    max_tokens: config.maxTokens,
    stream: false
  }
}

export function OPTIONS(): Response {
  return noContent(POST_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  const config = getAgentLlmConfig()
  if (!config) {
    return json({ error: 'Agent LLM proxy not configured' }, { status: 503, headers: POST_CORS_HEADERS })
  }

  const ip = getRequestIp(request)
  if (!ip || !checkRateLimit(ip)) {
    return json({ error: 'Rate limit exceeded' }, { status: 429, headers: POST_CORS_HEADERS })
  }

  const body = await request.json().catch(() => undefined)
  if (!body || !Array.isArray((body as TChatCompletionsBody).messages)) {
    return json({ error: 'Invalid request body: messages array required' }, { status: 400, headers: POST_CORS_HEADERS })
  }

  try {
    const response = await fetch(`${config.baseUri}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildUpstreamBody(body as TChatCompletionsBody, config))
    })

    const responseBody = await response.text()

    if (!response.ok) {
      console.error(`Agent LLM upstream error: ${response.status}`, responseBody)
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...POST_CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    console.error('Error proxying agent LLM request:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: POST_CORS_HEADERS })
  }
}
