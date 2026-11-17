import { Component, type ReactNode, useEffect, useState } from 'react'
import { levelKey, levelPassed, type Attempt, type ExerciseModule, type LevelResult } from '../lib/types'

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
      return <p className="banner bad">This level hit a problem. {this.state.error}</p>
    }
    return this.props.children
  }
}

export function Stage({
  exercise,
  review,
  attempts,
  onScore,
  onView,
}: {
  exercise: ExerciseModule
  review: boolean
  attempts: Record<string, Attempt>
  onScore: (key: string, result: LevelResult) => void
  onView?: (levelId: string) => void
}) {
  const [picked, setPicked] = useState(exercise.levels[0]?.id ?? '')
  const open = (index: number) => review || exercise.levels.slice(0, index).every((level) => levelPassed(attempts, exercise.id, level.id))
  const current = exercise.levels.find((level) => level.id === picked && open(exercise.levels.indexOf(level))) ?? exercise.levels.find((_, index) => open(index))
  if (!current) return null
  const index = exercise.levels.indexOf(current)
  const key = levelKey(exercise.id, current.id)
  const done = levelPassed(attempts, exercise.id, current.id)
  const next = exercise.levels[index + 1]

  useEffect(() => {
    onView?.(current.id)
  }, [current.id, onView])

  return (
    <div className="stage">
      <div className="play-card">
        <nav className="level-tabs" aria-label="Levels">
          {exercise.levels.map((level, levelIndex) => {
            const unlocked = open(levelIndex)
            const passed = levelPassed(attempts, exercise.id, level.id)
            const on = level.id === current.id
            return (
              <button
                key={level.id}
                type="button"
                className={`level-tab tone-${levelIndex} ${on ? 'on' : ''} ${passed ? 'done' : ''}`}
                disabled={!unlocked}
                onClick={() => setPicked(level.id)}
              >
                <small>Level {levelIndex + 1}</small>
                <strong>{['Exercise', 'Challenge', 'Extra time'][levelIndex] ?? level.title}</strong>
              </button>
            )
          })}
        </nav>
        <section className="slide" aria-live="polite">
          <header className="how">
            <h2>{current.title}</h2>
            <p className="mission">🎯 {current.blurb}</p>
            {current.steps && current.steps.length > 0 && (
              <ol className="how-steps">
                {current.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </header>
          <Boundary resetKey={key}>
            <current.Component completed={done} onComplete={(result) => onScore(key, result)} />
          </Boundary>
          {done && (
            <div className="level-win">
              <p>
                <b>🎉 Level {index + 1} complete!</b>
                {!next && <span> You finished every level.</span>}
              </p>
              {next && (
                <button type="button" className="primary" onClick={() => setPicked(next.id)}>
                  Level {index + 2} →
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
