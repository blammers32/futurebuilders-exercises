import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { get, getDatabase, onValue, ref, set, update } from 'firebase/database'
import { mergeAttempt, parseReleased, type Attempt, type ControlPatch, type Room, type Student, type Viewer } from './types'

let started = false

export function startFirebase(config: FirebaseOptions) {
  if (!started) {
    initializeApp(config)
    started = true
  }
  return { auth: getAuth(), db: getDatabase() }
}

function controlFrom(raw: Record<string, unknown> | undefined, code: string): Omit<Room, 'roster' | 'progress'> | null {
  if (!raw) return null
  const cursor = raw.cursor as Room['cursor']
  return {
    code,
    title: String(raw.title ?? 'FutureBuilders'),
    instructorName: String(raw.instructorName ?? 'Instructor'),
    published: Boolean(raw.published),
    review: Boolean(raw.review),
    reviewIds: parseReleased(raw.reviewIds),
    follow: Boolean(raw.follow),
    exerciseId: String(raw.exerciseId ?? ''),
    released: parseReleased(raw.released),
    cursor: cursor && typeof cursor.levelId === 'string' ? { levelId: cursor.levelId } : null,
    note: String(raw.note ?? ''),
    updatedAt: Number(raw.updatedAt ?? 0),
  }
}

export function liveSync(config: FirebaseOptions) {
  const { db } = startFirebase(config)

  return {
    mode: 'live' as const,
    watch(code: string, viewer: Viewer, onRoom: (room: Room | null) => void) {
      if (viewer.role === 'instructor') {
        return onValue(
          ref(db, `rooms/${code}`),
          (snap) => {
            const raw = snap.val()
            if (!raw?.control) {
              onRoom(null)
              return
            }
            const control = controlFrom(raw.control, code)
            if (!control) {
              onRoom(null)
              return
            }
            onRoom({
              ...control,
              roster: raw.roster ?? {},
              progress: raw.progress ?? {},
            })
          },
          () => onRoom(null),
        )
      }

      let control: Omit<Room, 'roster' | 'progress'> | null = null
      let progress: Record<string, Attempt> = {}
      const emit = () => {
        if (!control) {
          onRoom(null)
          return
        }
        onRoom({ ...control, roster: {}, progress: { [viewer.id]: progress } })
      }
      const stopControl = onValue(ref(db, `rooms/${code}/control`), (snap) => {
        control = controlFrom(snap.val(), code)
        emit()
      })
      const stopProgress = onValue(ref(db, `rooms/${code}/progress/${viewer.id}`), (snap) => {
        progress = snap.val() ?? {}
        emit()
      })
      return () => {
        stopControl()
        stopProgress()
      }
    },
    async createRoom(room: Room, ownerId: string) {
      await set(ref(db, `rooms/${room.code}`), {
        owner: ownerId,
        control: {
          title: room.title,
          instructorName: room.instructorName,
          published: room.published,
          review: room.review,
          reviewIds: room.reviewIds.join(','),
          follow: room.follow,
          exerciseId: room.exerciseId,
          released: room.released.join(','),
          cursor: room.cursor,
          note: room.note,
          updatedAt: Date.now(),
        },
        roster: {},
        progress: {},
      })
      await set(ref(db, `instructors/${ownerId}/rooms/${room.code}`), {
        title: room.title,
        createdAt: Date.now(),
      })
    },
    async updateControl(code: string, patch: ControlPatch) {
      const next: Record<string, unknown> = { updatedAt: Date.now() }
      if (patch.title !== undefined) next.title = patch.title
      if (patch.instructorName !== undefined) next.instructorName = patch.instructorName
      if (patch.published !== undefined) next.published = patch.published
      if (patch.review !== undefined) next.review = patch.review
      if (patch.reviewIds !== undefined) next.reviewIds = patch.reviewIds.join(',')
      if (patch.follow !== undefined) next.follow = patch.follow
      if (patch.exerciseId !== undefined) next.exerciseId = patch.exerciseId
      if (patch.note !== undefined) next.note = patch.note
      if (patch.released !== undefined) next.released = patch.released.join(',')
      if (patch.cursor !== undefined) next.cursor = patch.cursor
      await update(ref(db, `rooms/${code}/control`), next)
    },
    async touchStudent(code: string, student: Student) {
      await set(ref(db, `rooms/${code}/roster/${student.id}`), student)
    },
    async report(code: string, studentId: string, key: string, attempt: Attempt) {
      const current = await get(ref(db, `rooms/${code}/progress/${studentId}/${key}`))
      const previous = current.val() as Attempt | null
      await set(ref(db, `rooms/${code}/progress/${studentId}/${key}`), mergeAttempt(previous ?? undefined, attempt))
    },
  }
}

export function watchLiveUser(config: FirebaseOptions, onUser: (user: User | null) => void) {
  const { auth } = startFirebase(config)
  return onAuthStateChanged(auth, onUser)
}

export async function signInLive(config: FirebaseOptions, email: string, password: string) {
  const { auth } = startFirebase(config)
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  return cred.user
}

export async function signUpLive(config: FirebaseOptions, email: string, password: string, name: string) {
  const { auth, db } = startFirebase(config)
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await set(ref(db, `instructors/${cred.user.uid}/profile`), { name: name.trim(), email: email.trim() })
  return cred.user
}

export async function instructorName(config: FirebaseOptions, uid: string, email: string) {
  const { db } = startFirebase(config)
  const snap = await get(ref(db, `instructors/${uid}/profile`))
  const name = snap.val()?.name
  return typeof name === 'string' && name.length > 0 ? name : email
}

export async function ownRooms(config: FirebaseOptions, uid: string) {
  const { db } = startFirebase(config)
  const snap = await get(ref(db, `instructors/${uid}/rooms`))
  const value = snap.val() as Record<string, { title?: string }> | null
  if (!value) return []
  return Object.entries(value).map(([code, room]) => ({ code, title: room.title || 'Session' }))
}

export async function signOutLive(config: FirebaseOptions) {
  const { auth } = startFirebase(config)
  await signOut(auth)
}

export function authMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('invalid-email')) return 'That email does not look right.'
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password did not match.'
  }
  if (code.includes('email-already-in-use')) return 'That email already has a desk. Sign in instead.'
  if (code.includes('weak-password')) return 'Use at least 6 characters.'
  if (code.includes('network')) return 'Could not reach Firebase.'
  return error instanceof Error ? error.message : 'Sign-in failed.'
}
