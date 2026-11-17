import { useCallback, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Topbar } from '../components/Chrome'
import { Stage } from '../components/Stage'
import { exercises } from '../lib/catalog'
import { mergeAttempt, tally, type Attempt, type LevelResult } from '../lib/types'

const STORE = 'fb-site-progress'

function load(): Record<string, Attempt> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Attempt>
  } catch {
    return {}
  }
}

function useProgress() {
  const [attempts, setAttempts] = useState(load)
  const score = useCallback((key: string, result: LevelResult) => {
    setAttempts((prev) => {
      const next = { ...prev, [key]: mergeAttempt(prev[key], { status: 'completed', score: result.score, detail: result.detail, updatedAt: Date.now() }) }
      localStorage.setItem(STORE, JSON.stringify(next))
      return next
    })
  }, [])
  return { attempts, score }
}

export function Site() {
  const progress = useProgress()
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home attempts={progress.attempts} />} />
        <Route path="/:id" element={<Play {...progress} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="foot">A teaching tool for MIT RAISE FutureBuilders. Not an official MIT site.</footer>
    </div>
  )
}

function Home({ attempts }: { attempts: Record<string, Attempt> }) {
  return (
    <>
      <Topbar />
      <main className="site-home">
        <h1>Interactive Exercises</h1>
        <p className="lede">Play with real AI models. See how they read, count, and guess.</p>
        <ul className="site-list">
          {exercises.map((exercise, index) => {
            const { done, total } = tally(exercise, attempts)
            return (
              <li key={exercise.id}>
                <Link to={`/${exercise.id}`}>
                  <span className="site-num">{index + 1}</span>
                  <span className="site-text">
                    <strong>{exercise.title}</strong>
                    <small>{exercise.summary}</small>
                  </span>
                  <span className="site-done">
                    {done} of {total} done
                  </span>
                  <span className="site-go">Start →</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </>
  )
}

function Play({ attempts, score }: ReturnType<typeof useProgress>) {
  const { id } = useParams()
  const exercise = exercises.find((item) => item.id === id)
  if (!exercise) return <Navigate to="/" replace />
  return (
    <>
      <Topbar>
        <Link className="site-back" to="/">
          ← All exercises
        </Link>
      </Topbar>
      <nav className="site-tabs" aria-label="Exercises">
        {exercises.map((item) => (
          <Link key={item.id} to={`/${item.id}`} className={item.id === exercise.id ? 'on' : ''}>
            {item.title}
          </Link>
        ))}
      </nav>
      <Stage key={exercise.id} exercise={exercise} review attempts={attempts} onScore={score} />
    </>
  )
}
