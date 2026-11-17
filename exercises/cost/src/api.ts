import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || '/api/openrouter'

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`No AI server found at ${API}. This site needs the model proxy (see "Standalone site" in the README).`)
  }
}

export type ModelInfo = {
  id: string
  label: string
  family: string
  note: string
  logprobs: boolean
  promptPrice: number | null
  completionPrice: number | null
}

export type Completion = {
  text: string
  thinking?: string
  usage: { prompt: number | null; completion: number | null; reasoning?: number | null }
  cost: number | null
}

export async function getModels() {
  const response = await fetch(API)
  const data = (await readJson(response)) as { configured?: boolean; models?: ModelInfo[]; error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not reach the model desk.')
  return { configured: Boolean(data.configured), models: data.models ?? [] }
}

export function useModels() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    void getModels()
      .then((desk) => {
        setConfigured(desk.configured)
        setModels(desk.models)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load models.'))
  }, [])
  return { configured, models, error }
}

export async function complete(input: {
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens: number
  temperature?: number
  reasoning?: boolean
}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await readJson(response)) as Completion & { error?: string }
  if (!response.ok) throw new Error(data.error || 'The model request failed.')
  return data
}
