import { handleOpenRouter } from '../../server/openrouter.mjs'

export async function handler(event) {
  let payload = {}
  if (event.httpMethod === 'POST') {
    try {
      payload = JSON.parse(event.body || '{}')
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON.' }),
      }
    }
  }
  const result = await handleOpenRouter({ method: event.httpMethod, ...payload }, process.env.OPENROUTER_API_KEY)
  return {
    statusCode: result.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  }
}
