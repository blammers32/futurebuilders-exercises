import { useEffect, useRef, useState } from 'react'
import { complete } from './api'
import { SendBox } from './send'
import { Blocks, pieces, useCodec } from './tokens'
import type { LevelProps } from './types'

const MODEL = 'openai/gpt-4o-mini'

const HANDBOOK = `ACME Store Handbook, Section 4: Returns

4.1 Our goal is happy customers. Every purchase should feel like a great choice.
4.2 Shipping is paid at checkout and is not refunded once an order ships.
4.3 Gift cards, software downloads, and final sale items cannot be returned.
4.4 Customers may return most items for a full refund within 30 days of the delivery date.
4.5 Returned items must be unused, in the original box, with all parts.
4.6 Refunds go back to the original card within 5 to 7 business days.
4.7 To start a return, visit the returns page and enter your order number.
4.8 Exchanges follow the same window and depend on stock.
4.9 Broken items are covered by a separate 12 month warranty.`

const SHOP = `// shop.js
function greet(name) {
  return 'Welcome to the shop, ' + name + '!'
}

function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2)
}

function total(prices) {
  let t = 0
  for (const p of prices) {
    t = t - p
  }
  return t
}

function isOpen(hour) {
  return hour >= 9 && hour < 17
}

function tax(amount) {
  return Math.round(amount * 0.08)
}

// Bug: total([100, 250]) gives -350. Fix it.`

type Task = { id: string; goal: string; hint: string; budget: number; start: string; rows?: number; ok: (text: string) => boolean }

const TASKS: Task[] = [
  {
    id: 'paris',
    goal: 'Paris',
    hint: 'This prompt is too long. Make it shorter.',
    budget: 18,
    start: 'Can you please tell me what the capital city of the country of France is?',
    ok: (text) => /\bparis\b/i.test(text),
  },
  {
    id: 'cat',
    goal: 'chat  (French for cat)',
    hint: 'Remove the extra words.',
    budget: 20,
    start: 'Hello! I hope you are having a wonderful day. Could you please kindly tell me what the French word for cat is? Thank you so much!',
    ok: (text) => /\bchat\b/i.test(text),
  },
  {
    id: 'refund',
    goal: '30  (days to return)',
    hint: 'Keep only the line you need.',
    budget: 32,
    start: `${HANDBOOK}\n\nHow many days do customers have to return an item?`,
    rows: 8,
    ok: (text) => /\b30\b/.test(text),
  },
  {
    id: 'colors',
    goal: 'red · blue · yellow',
    hint: 'The answer is too long. Ask for a short answer.',
    budget: 24,
    start: 'What are the three primary colors?',
    ok: (text) => ['red', 'blue', 'yellow'].every((word) => new RegExp(`\\b${word}\\b`, 'i').test(text)),
  },
  {
    id: 'python',
    goal: 'def add(a, b): return a + b',
    hint: 'Too long. Ask for code only.',
    budget: 36,
    start: 'Hi! I am learning Python and I was wondering if you could please help me write a function called add that takes two numbers and gives back their sum? Please explain every step so I understand.',
    ok: (text) => /def\s+add\s*\(/.test(text) && /return/.test(text),
  },
  {
    id: 'sql',
    goal: 'SELECT … FROM students WHERE age > 15',
    hint: 'Make it shorter.',
    budget: 40,
    start: 'Could you please write me an SQL query that will select all of the columns for every student in the table called students whose age is greater than 15? Please also explain how it works.',
    ok: (text) => /select/i.test(text) && /from\s+students/i.test(text) && /age\s*>\s*15/i.test(text),
  },
  {
    id: 'bug',
    goal: 't = t + p  (fix total)',
    hint: 'Send only the broken part.',
    budget: 80,
    start: SHOP,
    rows: 10,
    ok: (text) => /t\s*\+=\s*p|t\s*=\s*t\s*\+\s*p|t\s*=\s*p\s*\+\s*t/.test(text),
  },
  {
    id: 'button',
    goal: '<button> that counts clicks',
    hint: 'The answer is huge. Ask for less.',
    budget: 50,
    start: 'Make a web page with a button that counts how many times it was clicked.',
    ok: (text) => /<button/i.test(text) && /(\+\+|\+\s*1|\+=\s*1)/.test(text),
  },
]

type Shot = { prompt: string; reply: string; in: number; out: number; overhead: number; ok: boolean }

export function Budget({ onComplete, completed }: LevelProps) {
  const codec = useCodec()
  const [step, setStep] = useState(0)
  const [prompt, setPrompt] = useState(TASKS[0].start)
  const [shot, setShot] = useState<Shot | null>(null)
  const [best, setBest] = useState<(number | null)[]>(TASKS.map(() => null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = useRef(onComplete)
  finish.current = onComplete
  const won = useRef(false)
  const ticket = useRef(0)
  const codecRef = useRef(codec)
  codecRef.current = codec

  const task = TASKS[step]

  async function send(text: string, index: number) {
    const id = ++ticket.current
    setBusy(true)
    setError('')
    try {
      const result = await complete({ model: MODEL, maxTokens: 400, temperature: 0, messages: [{ role: 'user', content: text }] })
      if (ticket.current !== id) return
      const local = codecRef.current ? codecRef.current.encode(text).length : 0
      const input = result.usage.prompt ?? local
      const output = result.usage.completion ?? 0
      const ok = TASKS[index].ok(result.text)
      setShot({ prompt: text, reply: result.text.trim(), in: input, out: output, overhead: local > 0 ? Math.max(0, input - local) : 0, ok })
      const total = input + output
      if (ok && total <= TASKS[index].budget) {
        setBest((prev) => prev.map((value, at) => (at === index ? Math.min(value ?? total, total) : value)))
      }
    } catch (err) {
      if (ticket.current === id) setError(err instanceof Error ? err.message : 'The model request failed.')
    } finally {
      if (ticket.current === id) setBusy(false)
    }
  }

  useEffect(() => {
    void send(TASKS[step].start, step)
  }, [step])

  useEffect(() => {
    if (won.current || best.some((value) => value === null)) return
    won.current = true
    finish.current({ score: 100, detail: `${best.reduce<number>((sum, value) => sum + (value ?? 0), 0)} tokens` })
  }, [best])

  function go(index: number) {
    setStep(index)
    setPrompt(TASKS[index].start)
    setShot(null)
  }

  if (!task) return null

  const total = shot ? shot.in + shot.out : null
  const sent = shot !== null && shot.prompt === prompt.trim()
  const nextOpen = TASKS.findIndex((_, index) => index > step && best[index] === null)

  return (
    <div className="fb-play">
      <div className="fb-pips" aria-label="Tasks">
        {TASKS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`budget-pip ${best[index] !== null ? 'on' : ''} ${index === step ? 'now' : ''}`}
            disabled={!completed && index > 0 && best[index - 1] === null}
            onClick={() => go(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="budget-target">
        <div>
          <p className="fb-label">Get this answer</p>
          <p className="budget-goal">{task.goal}</p>
        </div>
        <p className="budget-cap">
          budget <b>{task.budget}</b> tokens
        </p>
      </div>

      <p className="budget-hint">{task.hint}</p>
      <SendBox value={prompt} onChange={setPrompt} onSend={() => void send(prompt.trim(), step)} busy={busy} placeholder="Your prompt" rows={task.rows ?? 3} />

      <div className="budget-score">
        <p className="fb-num">
          {busy ? '…' : total ?? '—'}
          <small>/ {task.budget} tokens</small>
        </p>
        {shot && !busy && <Verdict shot={shot} total={total ?? 0} budget={task.budget} />}
        {shot && !busy && !sent && <p className="fb-note">Changed. Press Send.</p>}
        {best[step] !== null && nextOpen !== -1 && (
          <button type="button" className="primary" onClick={() => go(nextOpen)}>
            Next task →
          </button>
        )}
      </div>

      {shot && (
        <div className="fb-split">
          <section className="fb-card cost-in">
            <p className="fb-label">In · {shot.in}</p>
            <Blocks items={pieces(codec, shot.prompt)} extra={shot.overhead} />
          </section>
          <section className="fb-card cost-out">
            <p className="fb-label">Out · {shot.out}</p>
            <Blocks items={pieces(codec, shot.reply)} />
          </section>
        </div>
      )}
      {error && <p className="fb-bad">{error}</p>}
    </div>
  )
}

function Verdict({ shot, total, budget }: { shot: Shot; total: number; budget: number }) {
  if (!shot.ok) return <p className="fb-stamp no">✗ Wrong answer</p>
  if (total <= budget) return <p className="fb-stamp yes">✓ Under budget</p>
  return <p className="fb-stamp no">✗ {total - budget} too many</p>
}
