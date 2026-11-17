export const MODELS = [
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    family: 'OpenAI',
    note: 'Fast, and usually willing to be brief.',
    logprobs: true,
  },
  {
    id: 'openai/gpt-4.1-nano',
    label: 'GPT-4.1 nano',
    family: 'OpenAI',
    note: 'A very small OpenAI model.',
    logprobs: false,
  },
  {
    id: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    family: 'OpenAI',
    note: 'A step up from nano. Still wordy if you let it.',
    logprobs: false,
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    family: 'Google',
    note: 'A different lab, and different habits.',
    logprobs: false,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    family: 'Anthropic',
    note: 'Helpful, and often spends more tokens than you asked for.',
    logprobs: false,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    family: 'Meta',
    note: 'A small open model that shares next-token probabilities.',
    logprobs: true,
  },
]

const ALLOWED = new Set(MODELS.map((model) => model.id))
const EMBED_MODEL = 'openai/text-embedding-3-small'

let priceCache = null
let priceAt = 0

async function modelPrices(apiKey) {
  if (priceCache && Date.now() - priceAt < 10 * 60 * 1000) return priceCache
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })
    const json = await response.json()
    const map = {}
    for (const model of json.data ?? []) {
      const prompt = Number(model.pricing?.prompt)
      const completion = Number(model.pricing?.completion)
      if (Number.isFinite(prompt) && Number.isFinite(completion)) map[model.id] = { prompt, completion }
    }
    priceCache = map
    priceAt = Date.now()
  } catch {
    priceCache = priceCache ?? {}
  }
  return priceCache
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.max(min, Math.min(max, Math.round(number)))
}

function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 24) {
    throw new Error('Send between 1 and 24 messages.')
  }
  return input.map((message) => {
    const role = message?.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      throw new Error('Messages must be system, user, or assistant.')
    }
    if (typeof message.content !== 'string' || message.content.length === 0 || message.content.length > 6000) {
      throw new Error('Each message needs text, up to 6000 characters.')
    }
    return { role, content: message.content }
  })
}

async function callUpstream(apiKey, payload) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://raise.mit.edu/engage-with-us/k-12/mit-futurebuilders/',
      'X-Title': 'MIT RAISE FutureBuilders',
    },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let json
  try {
    json = raw ? JSON.parse(raw) : {}
  } catch {
    json = { error: { message: raw.slice(0, 400) } }
  }
  return { ok: response.ok, status: response.status, json }
}

export async function handleOpenRouter(request, apiKey) {
  if (request.method === 'GET') {
    const prices = await modelPrices(apiKey)
    const models = MODELS.map((model) => ({
      ...model,
      promptPrice: prices[model.id]?.prompt ?? null,
      completionPrice: prices[model.id]?.completion ?? null,
    }))
    return { status: 200, body: { configured: Boolean(apiKey), models } }
  }
  if (request.method !== 'POST') {
    return { status: 405, body: { error: 'Use POST.' } }
  }
  if (!apiKey) {
    return {
      status: 503,
      body: {
        error:
          'No OpenRouter key on the server. Add OPENROUTER_API_KEY in the host environment. The key stays off the student laptops.',
      },
    }
  }
  if (request.task === 'embed') return embedWords(request, apiKey)

  let messages
  try {
    messages = sanitizeMessages(request.messages)
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'Bad request.' } }
  }

  if (!ALLOWED.has(request.model)) {
    return { status: 400, body: { error: 'That model is not enabled for this classroom.' } }
  }

  const maxTokens = clamp(request.maxTokens, 1, 1200)
  const temperature = Math.max(0, Math.min(1, Number(request.temperature ?? 0) || 0))
  const payload = {
    model: request.model,
    messages,
    max_tokens: maxTokens,
    temperature,
  }
  if (request.logprobs) {
    payload.logprobs = true
    payload.top_logprobs = clamp(request.topLogprobs ?? 8, 1, 10)
  }
  if (request.reasoning === true) payload.reasoning = { effort: 'low' }

  let lifted = false
  let result = await callUpstream(apiKey, payload)
  if (!result.ok && maxTokens < 16) {
    const message = result.json?.error?.message || ''
    if (/16|minimum|at least/i.test(message)) {
      lifted = true
      result = await callUpstream(apiKey, { ...payload, max_tokens: 16 })
    }
  }

  if (!result.ok) {
    return {
      status: result.status || 502,
      body: { error: result.json?.error?.message || 'The model request failed.' },
    }
  }

  const choice = result.json?.choices?.[0]
  const text = choice?.message?.content ?? ''
  const thinking = typeof choice?.message?.reasoning === 'string' ? choice.message.reasoning : ''
  const rows = choice?.logprobs?.content
  let logprobs = null
  let firstToken = null
  if (Array.isArray(rows) && rows.length > 0) {
    firstToken = typeof rows[0].token === 'string' ? rows[0].token : ''
    const tops = Array.isArray(rows[0].top_logprobs) ? rows[0].top_logprobs : []
    logprobs = tops
      .filter((row) => typeof row?.token === 'string' && typeof row?.logprob === 'number')
      .map((row) => ({ token: row.token, logprob: row.logprob, prob: Math.exp(row.logprob) }))
      .sort((a, b) => b.prob - a.prob)
  }

  const usage = result.json?.usage ?? {}
  const details = usage.completion_tokens_details ?? {}
  const reasoning = typeof details.reasoning_tokens === 'number' ? details.reasoning_tokens : null
  return {
    status: 200,
    body: {
      text,
      thinking,
      firstToken,
      lifted,
      model: request.model,
      usage: {
        prompt: usage.prompt_tokens ?? null,
        completion: usage.completion_tokens ?? null,
        reasoning,
      },
      cost: typeof usage.cost === 'number' ? usage.cost : null,
      logprobs,
    },
  }
}

async function embedWords(request, apiKey) {
  if (!Array.isArray(request.input) || request.input.length < 1 || request.input.length > 48) {
    return { status: 400, body: { error: 'Send 1 to 48 words.' } }
  }
  const input = request.input.map((item) => (typeof item === 'string' ? item.trim().slice(0, 80) : ''))
  if (input.some((item) => item.length === 0)) {
    return { status: 400, body: { error: 'Every word needs text.' } }
  }
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://raise.mit.edu/engage-with-us/k-12/mit-futurebuilders/',
      'X-Title': 'MIT RAISE FutureBuilders',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { status: response.status || 502, body: { error: json?.error?.message || 'Embeddings failed.' } }
  }
  const vectors = (json.data ?? []).map((row) => row.embedding).filter((row) => Array.isArray(row))
  if (vectors.length !== input.length) {
    return { status: 502, body: { error: 'The embedding response was incomplete.' } }
  }
  return {
    status: 200,
    body: { vectors, cost: typeof json.usage?.cost === 'number' ? json.usage.cost : null },
  }
}
