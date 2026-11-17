import { useEffect, useRef, useState } from 'react'
import { complete, useModels } from './api'
import { money, perMillion } from './money'
import { SendBox } from './send'
import { Blocks, pieces, useCodec } from './tokens'
import type { LevelProps } from './types'

type Turn = { role: 'user' | 'assistant'; content: string; in?: number; out?: number; cost?: number | null }

export function Live({ onComplete, completed }: LevelProps) {
  const { configured, models, error: loadError } = useModels()
  const codec = useCodec()
  const [model, setModel] = useState('openai/gpt-4o-mini')
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = useRef(onComplete)
  finish.current = onComplete
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [turns.length])

  const chosen = models.find((item) => item.id === model)

  async function send() {
    const text = draft.trim()
    const history: Turn[] = [...turns, { role: 'user', content: text }]
    setTurns(history)
    setDraft('')
    setBusy(true)
    setError('')
    try {
      const result = await complete({
        model,
        maxTokens: 300,
        temperature: 0.7,
        messages: history.slice(-12).map((turn) => ({ role: turn.role, content: turn.content })),
      })
      const input = result.usage.prompt ?? 0
      const output = result.usage.completion ?? 0
      const price =
        chosen?.promptPrice != null && chosen.completionPrice != null ? input * chosen.promptPrice + output * chosen.completionPrice : result.cost
      setTurns([...history, { role: 'assistant', content: result.text.trim(), in: input, out: output, cost: price }])
      if (!completed) finish.current({ score: 1, detail: 'chatted' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The model request failed.')
    } finally {
      setBusy(false)
    }
  }

  if (configured === false) return <p className="fb-bad">No OpenRouter key on this server.</p>

  const total = turns.reduce((sum, turn) => sum + (turn.in ?? 0) + (turn.out ?? 0), 0)
  const spent = turns.reduce((sum, turn) => sum + (turn.cost ?? 0), 0)

  return (
    <div className="fb-play">
      <div className="fb-row">
        <p className="fb-num">
          {total}
          <small>tokens · {money(spent)}</small>
        </p>
        <label className="fb-model">
          Model
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · in {perMillion(item.promptPrice)} · out {perMillion(item.completionPrice)}
              </option>
            ))}
          </select>
        </label>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])}>
            New chat
          </button>
        )}
      </div>
      <div className="chat-log">
        {turns.length === 0 && <p className="fb-note">Say hi. Every colored block is one token.</p>}
        {turns.map((turn, index) => (
          <div key={index} className={`chat-turn ${turn.role}`}>
            <div className="chat-bubble">
              <Blocks items={pieces(codec, turn.content)} />
            </div>
            {turn.role === 'assistant' && (
              <p className="chat-meta">
                <b className="in">in {turn.in}</b>
                <b className="out">out {turn.out}</b>
                {turn.cost != null && <span>{money(turn.cost)}</span>}
              </p>
            )}
          </div>
        ))}
        {busy && <p className="chat-turn assistant chat-bubble">…</p>}
        <div ref={end} />
      </div>
      {turns.length >= 4 && <p className="fb-note">“in” grows: the whole chat is sent again every time.</p>}
      <SendBox value={draft} onChange={setDraft} onSend={() => void send()} busy={busy} placeholder="Type a message" />
      {(error || loadError) && <p className="fb-bad">{error || loadError}</p>}
    </div>
  )
}
