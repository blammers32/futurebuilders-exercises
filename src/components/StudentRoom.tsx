import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { exercises } from '../lib/catalog'
import { getSync } from '../lib/sync'
import { exercisesInReview, type LevelResult } from '../lib/types'
import { useRoom } from '../lib/useRoom'
import { Stage } from './Stage'
import { Topbar } from './Chrome'
import { loadWho } from './Join'

export function StudentRoom() {
  const { code = '' } = useParams()
  const who = loadWho()
  const room = useRoom(code, who ? { role: 'student', id: who.id } : null)
  const [levelId, setLevelId] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const openIds = room ? exercisesInReview(room, exercises.map((item) => item.id)) : []
  const shownId = openIds.includes(pickedId ?? '') ? pickedId : openIds[0] ?? room?.exerciseId
  const exercise = exercises.find((item) => item.id === shownId) ?? null

  useEffect(() => {
    if (!room || !who || !exercise) return
    const spot = levelId
    const syncing = window.setInterval(() => {
      void getSync().then((sync) =>
        sync.touchStudent(code, {
          id: who.id,
          name: who.name,
          lastSeen: Date.now(),
          levelId: spot ?? undefined,
          exerciseId: exercise.id,
        }),
      )
    }, 8000)
    void getSync().then((sync) =>
      sync.touchStudent(code, {
        id: who.id,
        name: who.name,
        lastSeen: Date.now(),
        levelId: spot ?? undefined,
        exerciseId: exercise.id,
      }),
    )
    return () => window.clearInterval(syncing)
  }, [code, who?.id, who?.name, levelId, exercise?.id, room?.code])

  if (!who) {
    return (
      <main className="narrow">
        <h1>Join with your name first.</h1>
        <Link to={`/join?code=${code}`}>Join {code}</Link>
      </main>
    )
  }

  if (room === undefined) {
    return (
      <div className="app">
        <Topbar />
        <main className="narrow">
          <p>Connecting…</p>
        </main>
      </div>
    )
  }

  if (!room || !exercise) {
    return (
      <div className="app">
        <Topbar />
        <main className="narrow">
          <h1>This class is not here.</h1>
          <Link to="/join">Try another code</Link>
        </main>
      </div>
    )
  }

  const attempts = room.progress[who.id] ?? {}

  function onScore(key: string, result: LevelResult) {
    void getSync().then((sync) =>
      sync.report(code, who!.id, key, {
        status: result.score > 0 ? 'completed' : 'viewed',
        score: result.score,
        detail: result.detail,
        updatedAt: Date.now(),
      }),
    )
  }

  return (
    <div className="app">
      <Topbar>
        <span className="quiet">{who.name}</span>
        <span className="mono">{room.code}</span>
      </Topbar>
      {!room.published ? (
        <section className="hold">
          <p className="kicker">Pencils down</p>
          <h1>Your instructor has the room.</h1>
          <p>Eyes up front. This screen will open the exercise when it is published.</p>
          <p className="quiet">
            {room.title} · {room.instructorName}
          </p>
        </section>
      ) : (
        <>
          {openIds.length > 1 && (
            <nav className="exercise-switch" aria-label="Exercises">
              {exercises.filter((item) => openIds.includes(item.id)).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === exercise.id ? 'on' : ''}
                  onClick={() => {
                    setPickedId(item.id)
                    setLevelId(item.levels[0]?.id ?? null)
                  }}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          )}
          <Stage
            key={exercise.id}
            exercise={exercise}
            review={openIds.length > 0}
            attempts={attempts}
            onView={setLevelId}
            onScore={onScore}
          />
        </>
      )}
    </div>
  )
}
