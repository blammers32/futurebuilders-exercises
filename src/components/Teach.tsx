import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { exercises } from '../lib/catalog'
import { createDemoDesk, demoRooms, enterDemoDesk, leaveDemoDesk, rememberDemoRoom } from '../lib/desk'
import { findSlide, makeCode, tally, type ControlPatch, type Room } from '../lib/types'
import { firebaseConfig, getSync, syncMode } from '../lib/sync'
import { useInstructor } from '../lib/useInstructor'
import { useRoom } from '../lib/useRoom'
import { ModeBadge, Topbar } from './Chrome'

export function Teach() {
  const { code } = useParams()
  if (code) return <Desk code={code} />
  return <DeskHome />
}

function DeskHome() {
  const instructor = useInstructor()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'enter' | 'create'>('enter')
  const [name, setName] = useState('')
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rooms, setRooms] = useState<{ code: string; title: string }[]>([])
  const [title, setTitle] = useState('Saturday lab')

  useEffect(() => {
    if (instructor.status !== 'in') return
    if (!instructor.live) {
      setRooms(demoRooms())
      return
    }
    const config = firebaseConfig()
    if (!config || !instructor.uid) return
    void import('../lib/live').then((mod) => mod.ownRooms(config, instructor.uid).then(setRooms))
  }, [instructor.status, instructor.live, instructor.uid])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (instructor.live) {
        const config = firebaseConfig()
        if (!config) throw new Error('Firebase is not configured.')
        const mod = await import('../lib/live')
        if (mode === 'create') await mod.signUpLive(config, email, secret, name)
        else await mod.signInLive(config, email, secret)
      } else if (mode === 'create') {
        await createDemoDesk(name, secret)
        setRooms(demoRooms())
      } else {
        await enterDemoDesk(name, secret)
        setRooms(demoRooms())
      }
    } catch (err) {
      const mod = instructor.live ? await import('../lib/live') : null
      setError(mod ? mod.authMessage(err) : err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  async function openRoom(event: FormEvent) {
    event.preventDefault()
    setError('')
    const exercise = exercises[0]
    if (!exercise) return
    const code = makeCode()
    const room: Room = {
      code,
      title: title.trim() || 'FutureBuilders lab',
      instructorName: instructor.name,
      published: false,
      follow: false,
      exerciseId: exercise.id,
      released: [],
      cursor: { levelId: exercise.levels[0].id, slideId: exercise.levels[0].slides[0].id },
      note: '',
      roster: {},
      progress: {},
      updatedAt: Date.now(),
    }
    try {
      const sync = await getSync()
      await sync.createRoom(room, instructor.uid || undefined)
      if (!instructor.live) rememberDemoRoom(code, room.title)
      navigate(`/teach/${code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the room.')
    }
  }

  async function signOut() {
    if (instructor.live) {
      const config = firebaseConfig()
      if (config) {
        const mod = await import('../lib/live')
        await mod.signOutLive(config)
      }
    } else {
      leaveDemoDesk()
      setRooms([])
    }
    setStateSafe()
  }

  function setStateSafe() {
    window.location.assign('/teach')
  }

  return (
    <div className="app">
      <Topbar>
        <ModeBadge mode={syncMode()} />
      </Topbar>
      <main className="narrow">
        <p className="kicker">Instructor desk</p>
        <h1>{instructor.status === 'in' ? `Hello, ${instructor.name}.` : 'Sign in to run the room.'}</h1>
        {instructor.status === 'loading' && <p>Checking the desk…</p>}
        {instructor.status === 'out' && (
          <>
            <p className="lede">
              {instructor.live
                ? 'This host is using Firebase. The same login works from any laptop, and student screens follow the room.'
                : 'Demo sign-in stays on this computer, which is enough to rehearse with two browser tabs. Add Firebase before a real class on the open internet.'}
            </p>
            <div className="seg" role="tablist">
              <button type="button" className={mode === 'enter' ? 'on' : ''} onClick={() => setMode('enter')}>
                Sign in
              </button>
              <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
                Create desk
              </button>
            </div>
            <form className="stack" onSubmit={submit}>
              {instructor.live ? (
                <label>
                  Email
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="username" />
                </label>
              ) : (
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
                </label>
              )}
              {instructor.live && mode === 'create' && (
                <label>
                  Name students will see
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
              )}
              <label>
                {instructor.live ? 'Password' : 'Passphrase'}
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  required
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                />
              </label>
              {error && <p className="banner bad">{error}</p>}
              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Checking…' : mode === 'create' ? 'Create and enter' : 'Enter'}
              </button>
            </form>
          </>
        )}
        {instructor.status === 'in' && (
          <>
            <form className="stack" onSubmit={openRoom}>
              <label>
                Session title
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              {error && <p className="banner bad">{error}</p>}
              <button className="primary" type="submit">
                Open a new room
              </button>
            </form>
            {rooms.length > 0 && (
              <ul className="room-list">
                {rooms.map((room) => (
                  <li key={room.code}>
                    <Link to={`/teach/${room.code}`}>
                      <strong>{room.title}</strong>
                      <span>{room.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button className="texty" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        )}
      </main>
    </div>
  )
}

function Desk({ code }: { code: string }) {
  const instructor = useInstructor()
  const room = useRoom(code, instructor.status === 'in' ? { role: 'instructor' } : null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const exercise = exercises.find((item) => item.id === room?.exerciseId) ?? exercises[0]

  useEffect(() => {
    if (room) setNote(room.note)
  }, [room?.note])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [])

  async function save(patch: ControlPatch) {
    setError('')
    try {
      const sync = await getSync()
      await sync.updateControl(code, patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the room.')
    }
  }

  async function copyCode() {
    try {
      const link = `${window.location.origin}/join?code=${code}`
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setError('Could not copy. Read the code aloud instead.')
    }
  }

  if (instructor.status === 'loading' || (instructor.status === 'in' && room === undefined)) {
    return (
      <div className="app">
        <Topbar />
        <main className="narrow">
          <p>Opening the desk…</p>
        </main>
      </div>
    )
  }

  if (instructor.status === 'out') {
    return (
      <div className="app">
        <Topbar />
        <main className="narrow">
          <h1>Sign in first.</h1>
          <Link className="primary" to="/teach">
            Back to the desk
          </Link>
        </main>
      </div>
    )
  }

  if (!room || !exercise) {
    return (
      <div className="app">
        <Topbar />
        <main className="narrow">
          <h1>No room {code}.</h1>
          <p>In demo mode the room lives in this browser. On a live host it has to be one you created.</p>
          <Link to="/teach">All rooms</Link>
        </main>
      </div>
    )
  }

  const students = Object.values(room.roster).sort((a, b) => b.lastSeen - a.lastSeen)
  const where = findSlide(exercise, room.cursor)

  return (
    <div className="app">
      <Topbar>
        <ModeBadge mode={syncMode()} />
        <Link to={`/present/${code}`}>Present</Link>
      </Topbar>
      <main className="desk">
        <section className="desk-controls">
          <p className="kicker">{room.title}</p>
          <div className="code-row">
            <p className="code">{room.code}</p>
            <button type="button" onClick={() => void copyCode()}>
              {copied ? 'Link copied' : 'Copy join link'}
            </button>
          </div>
          <p className="quiet">Students open the join link, or type this code.</p>
          <div className="publish-row">
            <button
              type="button"
              className={room.published ? 'primary hot' : 'primary'}
              onClick={() => void save({ published: !room.published })}
            >
              {room.published ? 'Unpublish' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={() =>
                void save({
                  published: true,
                  follow: false,
                  released: exercise.levels.map((level) => level.id),
                  note: 'Review is open. Walk back through anything you want to keep.',
                })
              }
            >
              Open for review
            </button>
          </div>
          <p className="quiet">
            {room.published
              ? 'Students can work the open levels.'
              : 'You have the room. Their screens are holding, and their progress stays put.'}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={room.follow}
              onChange={(event) => void save({ follow: event.target.checked })}
            />
            Drive their screens from Present
          </label>
          <label>
            Exercise
            <select
              value={exercise.id}
              onChange={(event) => {
                const next = exercises.find((item) => item.id === event.target.value)
                if (!next) return
                void save({
                  exerciseId: next.id,
                  released: [],
                  published: false,
                  cursor: { levelId: next.levels[0].id, slideId: next.levels[0].slides[0].id },
                })
              }}
            >
              {exercises.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Open levels</legend>
            <div className="level-picks">
              {exercise.levels.map((level) => {
                const on = room.released.includes(level.id)
                return (
                  <button
                    key={level.id}
                    type="button"
                    className={on ? 'pick on' : 'pick'}
                    onClick={() => {
                      const released = on ? room.released.filter((id) => id !== level.id) : [...room.released, level.id]
                      void save({ released })
                    }}
                  >
                    {level.title}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label>
            Note on their screen
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                if (note !== room.note) void save({ note })
              }}
              maxLength={180}
              placeholder="Eyes up for a minute."
            />
          </label>
          <div className="where">
            <span>Presenting</span>
            <strong>{where ? where.slide.title : 'First slide'}</strong>
            <div className="row">
              <button type="button" onClick={() => void step(exercise, room, -1, save)}>
                Previous slide
              </button>
              <button type="button" onClick={() => void step(exercise, room, 1, save)}>
                Next slide
              </button>
            </div>
          </div>
          {error && <p className="banner bad">{error}</p>}
        </section>
        <section className="roster-wrap">
          <header className="roster-head">
            <h2>Room</h2>
            <span>{students.length} joined</span>
          </header>
          {students.length === 0 ? (
            <p className="quiet">When a student joins with the code, they show up here.</p>
          ) : (
            <table className="roster">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Where</th>
                  <th>Challenges</th>
                  <th>Seen</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const spot = findSlide(exercise, student.levelId && student.slideId ? { levelId: student.levelId, slideId: student.slideId } : null)
                  const score = tally(exercise, room.progress[student.id])
                  const away = now - student.lastSeen > 30000
                  return (
                    <tr key={student.id} className={away ? 'away' : ''}>
                      <td>{student.name}</td>
                      <td>{spot ? spot.slide.title : '—'}</td>
                      <td>
                        {score.done}/{score.total}
                      </td>
                      <td>{ago(student.lastSeen, now)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  )
}

function step(exercise: (typeof exercises)[number], room: Room, delta: number, save: (patch: ControlPatch) => Promise<void>) {
  const flat = exercise.levels.flatMap((level) => level.slides.map((slide) => ({ level, slide })))
  const index = flat.findIndex((item) => item.level.id === room.cursor?.levelId && item.slide.id === room.cursor?.slideId)
  const next = flat[Math.min(flat.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))]
  if (!next) return
  return save({ cursor: { levelId: next.level.id, slideId: next.slide.id } })
}

function ago(time: number, now: number) {
  const seconds = Math.max(0, Math.round((now - time) / 1000))
  if (seconds < 8) return 'here'
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)}m`
}
