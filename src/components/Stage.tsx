import { Component, type ReactNode, useEffect } from 'react'
import type { Attempt, Cursor, ExerciseModule, SlideResult } from '../lib/types'

class Boundary extends Component<{ children: ReactNode; resetKey: string }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <p className="banner bad">This slide hit a problem. {this.state.error}</p>
    }
    return this.props.children
  }
}

export function Stage({
  exercise,
  released,
  cursor,
  locked,
  allowAll,
  attempts,
  onNavigate,
  onScore,
}: {
  exercise: ExerciseModule
  released: string[]
  cursor: Cursor | null
  locked: boolean
  allowAll: boolean
  attempts: Record<string, Attempt>
  onNavigate: (cursor: Cursor) => void
  onScore: (key: string, result: SlideResult, kind: 'lesson' | 'challenge') => void
}) {
  const visible = exercise.levels.filter(
    (level) => allowAll || released.includes(level.id) || (locked && level.id === cursor?.levelId),
  )
  const flat = visible.flatMap((level) => level.slides.map((slide) => ({ level, slide })))
  const found = flat.findIndex((item) => item.level.id === cursor?.levelId && item.slide.id === cursor?.slideId)
  const index = found >= 0 ? found : 0
  const current = flat[index]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    const move = (delta: number) => {
      if (locked) return
      const next = flat[index + delta]
      if (!next) return
      onNavigate({ levelId: next.level.id, slideId: next.slide.id })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flat, index, locked, onNavigate])

  if (!current) {
    return (
      <section className="hold slim">
        <p className="kicker">Waiting</p>
        <h1>No levels are open.</h1>
        <p>Publish the exercise, then open the levels you want this class to touch.</p>
      </section>
    )
  }

  const key = `${exercise.id}__${current.level.id}__${current.slide.id}`
  const attempt = attempts[key]
  const done = attempt?.status === 'completed' && attempt.score > 0

  return (
    <div className="stage">
      <nav className="levels" aria-label="Levels">
        {exercise.levels.map((level) => {
          const open = allowAll || released.includes(level.id)
          const slidesDone = level.slides.filter((slide) => {
            const item = attempts[`${exercise.id}__${level.id}__${slide.id}`]
            return slide.kind === 'challenge' && item?.status === 'completed' && item.score > 0
          }).length
          const slidesTotal = level.slides.filter((slide) => slide.kind === 'challenge').length
          return (
            <button
              key={level.id}
              type="button"
              className={level.id === current.level.id ? 'level on' : 'level'}
              disabled={!open || locked}
              onClick={() => onNavigate({ levelId: level.id, slideId: level.slides[0].id })}
            >
              <strong>{level.title}</strong>
              <span>{open ? level.blurb : 'Closed'}</span>
              {slidesTotal > 0 && <em>{slidesDone}/{slidesTotal}</em>}
            </button>
          )
        })}
      </nav>
      <section className="slide" aria-live="polite">
        <header className="slide-head">
          <p className="kicker">
            {current.slide.kind === 'challenge' ? 'Challenge' : 'Lesson'} · {current.level.title}
            {done && current.slide.kind === 'challenge' ? ` · ${attempt?.score ?? 0}` : ''}
          </p>
          <h2>{current.slide.title}</h2>
        </header>
        <Boundary resetKey={key}>
          <current.slide.Component
            completed={Boolean(done)}
            onComplete={(result) => onScore(key, result, current.slide.kind)}
          />
        </Boundary>
        <footer className="slide-nav">
          <button type="button" disabled={locked || index <= 0} onClick={() => {
            const next = flat[index - 1]
            onNavigate({ levelId: next.level.id, slideId: next.slide.id })
          }}>
            Back
          </button>
          <span>
            {locked ? 'Following your instructor' : 'Arrow keys move'} · {index + 1} / {flat.length}
          </span>
          <button type="button" disabled={locked || index >= flat.length - 1} onClick={() => {
            const next = flat[index + 1]
            onNavigate({ levelId: next.level.id, slideId: next.slide.id })
          }}>
            Next
          </button>
        </footer>
      </section>
    </div>
  )
}
