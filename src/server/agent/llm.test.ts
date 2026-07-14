import { describe, expect, it } from 'vitest'
import { buildUpstreamBody, checkRateLimit, getAgentLlmConfig } from './llm'

const CONFIG_ENV = {
  AGENT_LLM_BASE_URI: 'https://api.example.com/v1/',
  AGENT_LLM_API_KEY: ' secret-key ',
  AGENT_LLM_MODEL: 'gpt-test'
}

describe('Agent LLM proxy helpers', () => {
  it('reads config from server-only env vars and trims the base URI', () => {
    expect(getAgentLlmConfig(CONFIG_ENV)).toEqual({
      baseUri: 'https://api.example.com/v1',
      apiKey: 'secret-key',
      model: 'gpt-test',
      maxTokens: 4096
    })
  })

  it('returns undefined when any required var is missing', () => {
    expect(getAgentLlmConfig({})).toBeUndefined()
    expect(getAgentLlmConfig({ ...CONFIG_ENV, AGENT_LLM_API_KEY: undefined })).toBeUndefined()
    expect(getAgentLlmConfig({ ...CONFIG_ENV, AGENT_LLM_MODEL: '  ' })).toBeUndefined()
  })

  it('honors a valid AGENT_LLM_MAX_TOKENS override and ignores invalid ones', () => {
    expect(getAgentLlmConfig({ ...CONFIG_ENV, AGENT_LLM_MAX_TOKENS: '8192' })?.maxTokens).toBe(8192)
    expect(getAgentLlmConfig({ ...CONFIG_ENV, AGENT_LLM_MAX_TOKENS: 'lots' })?.maxTokens).toBe(4096)
    expect(getAgentLlmConfig({ ...CONFIG_ENV, AGENT_LLM_MAX_TOKENS: '-1' })?.maxTokens).toBe(4096)
  })

  it('forces model, max_tokens, and stream while forwarding only known fields', () => {
    const config = getAgentLlmConfig(CONFIG_ENV)
    if (!config) {
      throw new Error('expected config')
    }

    const body = {
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function' }],
      tool_choice: 'required',
      parallel_tool_calls: false,
      model: 'attacker-model',
      max_tokens: 999999,
      stream: true,
      api_key_exfil: 'nope'
    }

    expect(buildUpstreamBody(body, config)).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function' }],
      tool_choice: 'required',
      parallel_tool_calls: false,
      model: 'gpt-test',
      max_tokens: 4096,
      stream: false
    })
  })

  it('rate limits per IP over a sliding window', () => {
    const start = 1_000_000
    const allowed = Array.from({ length: 30 }, (_, index) => checkRateLimit('10.0.0.1', start + index))
    expect(allowed.every(Boolean)).toBe(true)

    expect(checkRateLimit('10.0.0.1', start + 31)).toBe(false)
    expect(checkRateLimit('10.0.0.2', start + 31)).toBe(true)
    expect(checkRateLimit('10.0.0.1', start + 61_000)).toBe(true)
  })
})
