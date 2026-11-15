import { useEffect, useState } from 'react'
import { getSync } from './sync'
import type { Room, Viewer } from './types'

export function useRoom(code: string | undefined, viewer: Viewer | null) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined)
  const viewerKey = viewer ? (viewer.role === 'student' ? `student:${viewer.id}` : 'instructor') : ''

  useEffect(() => {
    if (!code || !viewer) return
    let stop = () => {}
    let cancelled = false
    getSync()
      .then((sync) => {
        if (cancelled) return
        stop = sync.watch(code, viewer, (next) => {
          if (!cancelled) setRoom(next)
        })
      })
      .catch(() => {
        if (!cancelled) setRoom(null)
      })
    return () => {
      cancelled = true
      stop()
    }
    // viewer is reduced to viewerKey so a new object each render does not resubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, viewerKey])

  return room
}
