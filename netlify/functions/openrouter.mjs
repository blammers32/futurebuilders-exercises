import { handleOpenRouter } from '../../server/openrouter.mjs'

function headers(origin) {
  const allowed = (process.env.ALLOWED_ORIGIN || '*').split(',').map((item) => item.trim())
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0]
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export async function handler(event) {
  const cors = headers(event.headers?.origin ?? '')
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  let payload = {}
  if (event.httpMethod === 'POST') {
    try {
      payload = JSON.parse(event.body || '{}')
    } catch {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON.' }) }
    }
  }
  const result = await handleOpenRouter({ method: event.httpMethod, ...payload }, process.env.OPENROUTER_API_KEY)
  return { statusCode: result.status, headers: cors, body: JSON.stringify(result.body) }
}
