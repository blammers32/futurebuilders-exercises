import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getSync } from '../lib/sync'
import { Topbar } from './Chrome'

const WHO = 'fb-who'

export type Who = { id: string; name: string }

export function loadWho(): Who | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(WHO) || 'null') as Who | null
    if (parsed?.id && parsed?.name) return parsed
  } catch {
    /* ignore bad local data */
  }
  return null
}

export function saveWho(name: string): Who {
  const existing = loadWho()
  const who = { id: existing?.id ?? crypto.randomUUID(), name: name.trim() }
  localStorage.setItem(WHO, JSON.stringify(who))
  return who
}

export function Join() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(params.get('code')?.toUpperCase() ?? '')
  const [name, setName] = useState(loadWho()?.name ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const cleanCode = code.trim().toUpperCase()
    const who = saveWho(name)
    try {
      const sync = await getSync()
      let found = false
      let stop = () => {}
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error('timeout')), 4000)
          stop = sync.watch(cleanCode, { role: 'student', id: who.id }, (room) => {
            window.clearTimeout(timer)
            found = Boolean(room)
            resolve()
          })
        })
      } finally {
        stop()
      }
      if (!found) {
        setError(
          sync.mode === 'demo'
            ? 'No room with that code on this computer. Open the instructor tab here, or connect Firebase for a class across laptops.'
            : 'No room with that code. Check the board and try again.',
        )
        return
      }
      await sync.touchStudent(cleanCode, { id: who.id, name: who.name, lastSeen: Date.now() })
      navigate(`/s/${cleanCode}`)
    } catch {
      setError('Could not reach the room.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <Topbar />
      <main className="narrow">
        <p className="kicker">Student</p>
        <h1>Join the class.</h1>
        <form className="stack" onSubmit={submit}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} />
          </label>
          <label>
            Class code
            <input
              className="code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
              minLength={4}
              maxLength={8}
              autoCapitalize="characters"
            />
          </label>
          {error && <p className="banner bad">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Looking…' : 'Join'}
          </button>
        </form>
        <p className="quiet">
          Already teaching? <Link to="/teach">Open the desk</Link>
        </p>
      </main>
    </div>
  )
}
