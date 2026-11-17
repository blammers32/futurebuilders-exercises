import { useRef, useState } from 'react'
import { complete, useModels, type ModelInfo } from './api'
import { Md } from './md'
import { cost } from './money'
import type { LevelProps } from './types'

const JUDGE = 'openai/gpt-4.1-mini'
const THINKERS = new Set(['google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5'])
const GOAL = 2

type Puzzle = { id: string; name: string; text: string; answer: string }

const PUZZLES: Puzzle[] = [
  { id: 'months', name: '📅 Months', text: 'Some months have 31 days. How many months have 28 days?', answer: '12 (every month has at least 28 days)' },
  {
    id: 'goat',
    name: '🐐 Goat',
    text: 'A man and a goat are on one side of a river. They have a boat that can carry one man and one goat. How many trips across the river do they need to get both to the other side?',
    answer: '1 (they go across together, one time)',
  },
  {
    id: 'doors',
    name: '🚪 Glass doors',
    text: 'You are on a game show with 3 glass doors. You can see a car behind door 1. You pick door 1. The host opens door 3 and shows a goat. Should you switch to door 2?',
    answer: 'No (you can see the car is behind door 1)',
  },
  {
    id: 'surgeon',
    name: '🏥 Surgeon',
    text: 'A boy and his father are in a car crash. The surgeon, who is the boy’s father, says "I can’t operate on this boy, he is my son." Who is the surgeon?',
    answer: 'The boy’s father (the puzzle says so)',
  },
  { id: 'sisters', name: '👧 Sisters', text: 'Alice has 3 brothers and 2 sisters. How many sisters does Alice’s brother have?', answer: '3 (Alice and her 2 sisters)' },
  { id: 'decimal', name: '🔢 Decimals', text: 'Which number is bigger: 9.11 or 9.9?', answer: '9.9' },
  {
    id: 'candles',
    name: '🕯️ Candles',
    text: 'There are 10 candles burning. The wind blows out 3. How many candles are left at the end, after the others burn down?',
    answer: '3 (only the blown-out candles are left)',
  },
]

type Pick = { model: string; think: boolean }
type Side = { text: string; thinking: string; think: number; say: number; right: boolean | null }
type Try = { puzzle: string; a: string; b: string; aRight: boolean | null; bRight: boolean | null }

async function solve(pick: Pick, puzzle: string): Promise<Omit<Side, 'right'>> {
  const result = await complete({
    model: pick.model,
    maxTokens: pick.think ? 1200 : 300,
    temperature: 0,
    reasoning: pick.think,
    messages: [{ role: 'user', content: `${puzzle}\nAnswer in one or two short sentences.` }],
  })
  const think = result.usage.reasoning ?? 0
  return { text: result.text.trim(), thinking: (result.thinking ?? '').trim(), think, say: Math.max(0, (result.usage.completion ?? 0) - think) }
}

async function grade(puzzle: string, answer: string, reply: string) {
  const result = await complete({
    model: JUDGE,
    maxTokens: 3,
    temperature: 0,
    messages: [
      { role: 'system', content: 'You grade answers to puzzles. Be strict: a reply that gives a wrong main answer is NO, even if it mentions the right one later.' },
      { role: 'user', content: `Puzzle: ${puzzle}\nRight answer: ${answer}\nReply: ${reply}\nIs the main answer in the reply the right answer? Answer only YES or NO.` },
    ],
  })
  return /^yes/i.test(result.text.trim())
}

export function Reason({ onComplete }: LevelProps) {
  const { configured, models, error: loadError } = useModels()
  const [puzzleId, setPuzzleId] = useState(PUZZLES[0].id)
  const [ownText, setOwnText] = useState('')
  const [ownAnswer, setOwnAnswer] = useState('')
  const [a, setA] = useState<Pick>({ model: 'openai/gpt-4o-mini', think: false })
  const [b, setB] = useState<Pick>({ model: 'anthropic/claude-haiku-4.5', think: true })
  const [left, setLeft] = useState<Side | null>(null)
  const [right, setRight] = useState<Side | null>(null)
  const [shown, setShown] = useState<{ text: string; answer: string } | null>(null)
  const [tries, setTries] = useState<Try[]>([])
  const [found, setFound] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = useRef(onComplete)
  finish.current = onComplete

  const own = puzzleId === 'own'
  const puzzle = own ? { id: 'own', name: '✏️ Your own', text: ownText.trim(), answer: ownAnswer.trim() } : PUZZLES.find((item) => item.id === puzzleId) ?? PUZZLES[0]
  const ready = puzzle.text.length > 0 && puzzle.answer.length > 0 && models.length > 0

  async function ask() {
    if (!ready || busy) return
    const asked = { ...puzzle }
    setBusy(true)
    setError('')
    setLeft(null)
    setRight(null)
    setShown(null)
    try {
      const [one, two] = await Promise.all([solve(a, asked.text), solve(b, asked.text)])
      const [oneRight, twoRight] = await Promise.all([grade(asked.text, asked.answer, one.text), grade(asked.text, asked.answer, two.text)])
      setLeft({ ...one, right: oneRight })
      setRight({ ...two, right: twoRight })
      setShown({ text: asked.text, answer: asked.answer })
      setTries((prev) => [{ puzzle: asked.name, a: label(models, a), b: label(models, b), aRight: oneRight, bRight: twoRight }, ...prev].slice(0, 12))
      if (oneRight !== twoRight) {
        const key = asked.id === 'own' ? `own:${asked.text.toLowerCase()}` : asked.id
        setFound((prev) => {
          if (prev.includes(key)) return prev
          const next = [...prev, key]
          if (next.length === GOAL) finish.current({ score: 100, detail: next.join(', ').slice(0, 300) })
          return next
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The model request failed.')
    } finally {
      setBusy(false)
    }
  }

  if (configured === false) return <p className="fb-bad">No OpenRouter key on this server.</p>

  const scale = Math.max(1, (left?.think ?? 0) + (left?.say ?? 0), (right?.think ?? 0) + (right?.say ?? 0))
  const rate = (id: string) => models.find((item) => item.id === id)?.completionPrice ?? null

  return (
    <div className="fb-play">
      <div className="fb-pips">
        {Array.from({ length: GOAL }, (_, index) => (
          <i key={index} className={found[index] ? 'on' : ''}>
            {index + 1}
          </i>
        ))}
        <span className="fb-note">One model right, one model wrong</span>
      </div>

      <p className="fb-label">1 · Pick a puzzle</p>
      <div className="reason-puzzles">
        {PUZZLES.map((item) => (
          <button key={item.id} type="button" className={item.id === puzzleId ? 'on' : ''} onClick={() => setPuzzleId(item.id)}>
            {item.name}
            {found.includes(item.id) && ' ✓'}
          </button>
        ))}
        <button type="button" className={own ? 'on' : ''} onClick={() => setPuzzleId('own')}>
          ✏️ Your own
        </button>
      </div>
      {own ? (
        <div className="reason-own">
          <textarea className="fb-big" rows={3} value={ownText} placeholder="Your puzzle" onChange={(event) => setOwnText(event.target.value)} maxLength={600} />
          <input className="fb-big" value={ownAnswer} placeholder="The right answer" onChange={(event) => setOwnAnswer(event.target.value)} maxLength={200} />
        </div>
      ) : (
        <p className="reason-question">{puzzle.text}</p>
      )}

      <p className="fb-label">2 · Pick two models</p>
      <div className="fb-split">
        <ModelBox name="A" pick={a} onPick={setA} models={models} />
        <ModelBox name="B" pick={b} onPick={setB} models={models} />
      </div>

      <button type="button" className="primary reason-go" disabled={!ready || busy} onClick={() => void ask()}>
        {busy ? 'Thinking…' : '3 · ▶ Ask both'}
      </button>

      {shown && (
        <p className="reason-answer">
          Right answer: <b>{shown.answer}</b>
        </p>
      )}
      {(busy || left) && (
        <div className="fb-split">
          <Column name="A" title={label(models, a)} side={left} scale={scale} rate={rate(a.model)} busy={busy} />
          <Column name="B" title={label(models, b)} side={right} scale={scale} rate={rate(b.model)} busy={busy} />
        </div>
      )}

      {tries.length > 0 && (
        <section className="fb-card">
          <p className="fb-label">Your tries</p>
          <table className="reason-tries">
            <tbody>
              {tries.map((item, index) => (
                <tr key={index} className={item.aRight !== item.bRight ? 'hit' : ''}>
                  <td>{item.puzzle}</td>
                  <td>
                    {mark(item.aRight)} {item.a}
                  </td>
                  <td>
                    {mark(item.bRight)} {item.b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {(error || loadError) && <p className="fb-bad">{error || loadError}</p>}
    </div>
  )
}

function mark(right: boolean | null) {
  return right === null ? '·' : right ? '✓' : '✗'
}

function label(models: ModelInfo[], pick: Pick) {
  const name = models.find((item) => item.id === pick.model)?.label ?? pick.model
  return pick.think ? `${name} 🧠` : name
}

function ModelBox({ name, pick, onPick, models }: { name: string; pick: Pick; onPick: (pick: Pick) => void; models: ModelInfo[] }) {
  const canThink = THINKERS.has(pick.model)
  return (
    <section className="fb-card reason-model">
      <p className="fb-label">Model {name}</p>
      <select value={pick.model} onChange={(event) => onPick({ model: event.target.value, think: pick.think && THINKERS.has(event.target.value) })}>
        {models.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <div className="reason-mode">
        <button type="button" className={!pick.think ? 'on' : ''} onClick={() => onPick({ ...pick, think: false })}>
          ⚡ Answer fast
        </button>
        <button type="button" className={pick.think ? 'on' : ''} disabled={!canThink} onClick={() => onPick({ ...pick, think: true })}>
          🧠 Think first
        </button>
      </div>
      {!canThink && <p className="fb-note">This model cannot think first.</p>}
    </section>
  )
}

function Column({ name, title, side, scale, rate, busy }: { name: string; title: string; side: Side | null; scale: number; rate: number | null; busy: boolean }) {
  return (
    <section className={`fb-card reason-col ${side?.right === true ? 'right' : side?.right === false ? 'wrong' : ''}`}>
      <h3>
        {name} · {title}
      </h3>
      {side ? (
        <>
          <p className={side.right ? 'fb-stamp yes' : 'fb-stamp no'}>{side.right ? '✓ Right' : '✗ Wrong'}</p>
          <Md text={side.text} />
          <div className="fb-bar" aria-hidden="true">
            <i className="reason-think" style={{ width: `${(side.think / scale) * 100}%` }} />
            <i className="reason-say" style={{ width: `${(side.say / scale) * 100}%` }} />
          </div>
          <p className="fb-note">
            <b className="reason-key think">think {side.think}</b> <b className="reason-key say">answer {side.say}</b> · {cost(side.think + side.say, rate)}
          </p>
          {side.thinking && (
            <details className="reason-thinking">
              <summary>See the thinking (summary)</summary>
              <Md text={side.thinking} />
            </details>
          )}
        </>
      ) : (
        <p className="fb-note">{busy ? '…' : '—'}</p>
      )}
    </section>
  )
}
