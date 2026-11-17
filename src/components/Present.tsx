import { Link, useParams } from 'react-router-dom'
import { exercises } from '../lib/catalog'
import { getSync } from '../lib/sync'
import { useInstructor } from '../lib/useInstructor'
import type { ControlPatch } from '../lib/types'
import { useRoom } from '../lib/useRoom'
import { Stage } from './Stage'

export function Present() {
  const { code = '' } = useParams()
  const instructor = useInstructor()
  const room = useRoom(code, instructor.status === 'in' ? { role: 'instructor' } : null)
  const exercise = exercises.find((item) => item.id === room?.exerciseId) ?? exercises[0]

  async function save(patch: ControlPatch) {
    const sync = await getSync()
    await sync.updateControl(code, patch)
  }

  if (instructor.status === 'loading') {
    return (
      <main className="narrow">
        <p>Opening the screen…</p>
      </main>
    )
  }

  if (instructor.status !== 'in') {
    return (
      <main className="narrow">
        <h1>Sign in on the desk first.</h1>
        <Link to="/teach">Instructor desk</Link>
      </main>
    )
  }

  if (room === undefined) return <main className="narrow"><p>Opening the screen…</p></main>
  if (!room || !exercise) {
    return (
      <main className="narrow">
        <h1>This room is not open.</h1>
        <Link to="/teach">Desk</Link>
      </main>
    )
  }

  return (
    <div className="app present">
      <header className="present-bar">
        <Link to={`/teach/${code}`}>Desk</Link>
        <strong>{room.title}</strong>
        <span className="mono">{room.code}</span>
        <button
          type="button"
          className={room.published ? 'primary hot' : 'primary'}
          onClick={() =>
            void save(
              room.published
                ? { published: false, review: false, reviewIds: [] }
                : {
                    published: true,
                    review: false,
                    reviewIds: [],
                    exerciseId: exercise.id,
                    cursor: { levelId: exercise.levels[0].id },
                  },
            )
          }
        >
          {room.published ? 'Unpublish' : 'Publish'}
        </button>
      </header>
      <Stage exercise={exercise} review attempts={{}} onScore={() => {}} />
    </div>
  )
}
