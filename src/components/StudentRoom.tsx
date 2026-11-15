import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { exercises } from '../lib/catalog'
import { getSync } from '../lib/sync'
import type { Cursor, SlideResult } from '../lib/types'
import { useRoom } from '../lib/useRoom'
import { Stage } from './Stage'
import { Topbar } from './Chrome'
import { loadWho } from './Join'

export function StudentRoom() {
  const { code = '' } = useParams()
  const who = loadWho()
  const room = useRoom(code, who ? { role: 'student', id: who.id } : null)
  const [localCursor, setLocalCursor] = useState<Cursor | null>(null)
  const followRef = useRef(false)
  const exercise = exercises.find((item) => item.id === room?.exerciseId) ?? null

  useEffect(() => {
    if (!room) return
    if (followRef.current && !room.follow) setLocalCursor(room.cursor)
    followRef.current = room.follow
  }, [room?.follow, room?.cursor, room])

  useEffect(() => {
    if (!room || !who || !exercise) return
    const cursor = room.follow ? room.cursor : localCursor ?? room.cursor
    const syncing = window.setInterval(() => {
      void getSync().then((sync) =>
        sync.touchStudent(code, {
          id: who.id,
          name: who.name,
          lastSeen: Date.now(),
          levelId: cursor?.levelId,
          slideId: cursor?.slideId,
        }),
      )
    }, 8000)
    void getSync().then((sync) =>
      sync.touchStudent(code, {
        id: who.id,
        name: who.name,
        lastSeen: Date.now(),
        levelId: cursor?.levelId,
        slideId: cursor?.slideId,
      }),
    )
    return () => window.clearInterval(syncing)
  }, [code, who?.id, who?.name, room?.follow, room?.cursor?.levelId, room?.cursor?.slideId, localCursor?.levelId, localCursor?.slideId, exercise?.id])

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

  const cursor = room.follow ? room.cursor : localCursor ?? room.cursor
  const attempts = room.progress[who.id] ?? {}

  function navigate(next: Cursor) {
    if (room && room.follow) return
    setLocalCursor(next)
  }

  function onScore(key: string, result: SlideResult, kind: 'lesson' | 'challenge') {
    const passed = kind === 'lesson' || result.score > 0
    void getSync().then((sync) =>
      sync.report(code, who!.id, key, {
        status: passed ? 'completed' : 'viewed',
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
          <p>{room.note || 'Eyes up front. This screen will open the exercise when it is published.'}</p>
          <p className="quiet">
            {room.title} · {room.instructorName}
          </p>
        </section>
      ) : (
        <>
          {room.note && <p className="banner">{room.note}</p>}
          <Stage
            exercise={exercise}
            released={room.released}
            cursor={cursor}
            locked={room.follow}
            allowAll={false}
            attempts={attempts}
            onNavigate={navigate}
            onScore={onScore}
          />
        </>
      )}
    </div>
  )
}
