import type { FirebaseOptions } from 'firebase/app'
import { localSync } from './localSync'
import type { Attempt, ControlPatch, Room, Student, Viewer } from './types'

export type Sync = {
  mode: 'demo' | 'live'
  watch: (code: string, viewer: Viewer, onRoom: (room: Room | null) => void) => () => void
  createRoom: (room: Room, ownerId?: string) => Promise<void>
  updateControl: (code: string, patch: ControlPatch) => Promise<void>
  touchStudent: (code: string, student: Student) => Promise<void>
  report: (code: string, studentId: string, key: string, attempt: Attempt) => Promise<void>
}

export function firebaseConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID
  if (!apiKey || !databaseURL || !projectId || !appId) return null
  return {
    apiKey,
    databaseURL,
    projectId,
    appId,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  }
}

export function syncMode() {
  return firebaseConfig() ? 'live' : 'demo'
}

let pending: Promise<Sync> | null = null

export function getSync() {
  if (!pending) {
    const config = firebaseConfig()
    pending = config
      ? import('./live').then((mod) => {
          const live = mod.liveSync(config)
          return {
            mode: 'live' as const,
            watch: live.watch,
            createRoom: (room: Room, ownerId?: string) => {
              if (!ownerId) throw new Error('Sign in before opening a live room.')
              return live.createRoom(room, ownerId)
            },
            updateControl: live.updateControl,
            touchStudent: live.touchStudent,
            report: live.report,
          }
        })
      : Promise.resolve(localSync satisfies Sync)
  }
  return pending
}
