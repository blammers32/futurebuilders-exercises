import type { ComponentType } from 'react'

export type LevelResult = { score: number; detail?: string }

export type LevelProps = {
  onComplete: (result: LevelResult) => void
  completed: boolean
}

export type LevelDef = {
  id: string
  title: string
  blurb: string
  steps?: string[]
  Component: ComponentType<LevelProps>
}

export type ExerciseModule = {
  id: string
  title: string
  kicker: string
  summary: string
  minutes: number
  levels: LevelDef[]
}

export type Cursor = { levelId: string }

export type Student = {
  id: string
  name: string
  lastSeen: number
  levelId?: string
  exerciseId?: string
  slideId?: string
}

export type Attempt = {
  status: 'viewed' | 'completed'
  score: number
  detail?: string
  updatedAt: number
}

export type Room = {
  code: string
  title: string
  instructorName: string
  published: boolean
  review: boolean
  reviewIds: string[]
  follow: boolean
  exerciseId: string
  released: string[]
  cursor: Cursor | null
  note: string
  roster: Record<string, Student>
  progress: Record<string, Record<string, Attempt>>
  updatedAt: number
}

export type ControlPatch = Partial<
  Pick<Room, 'title' | 'instructorName' | 'published' | 'review' | 'reviewIds' | 'follow' | 'exerciseId' | 'released' | 'cursor' | 'note'>
>

export type Viewer = { role: 'instructor' } | { role: 'student'; id: string }

export function levelKey(exerciseId: string, levelId: string) {
  return `${exerciseId}__${levelId}`
}

export function exercisesInReview(room: Pick<Room, 'review' | 'reviewIds'>, allIds: string[]) {
  const listed = room.reviewIds.filter((id) => allIds.includes(id))
  if (listed.length > 0) return listed
  return room.review ? allIds : []
}

export function parseReleased(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.length > 0)
  if (typeof value !== 'string' || value.length === 0) return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')
}

export function mergeAttempt(previous: Attempt | undefined, next: Attempt): Attempt {
  if (!previous) return next
  if (previous.status === 'completed' && next.status !== 'completed') return previous
  if (previous.status === 'completed' && next.status === 'completed' && next.score < previous.score) return previous
  return next
}

export function tally(exercise: ExerciseModule, attempts: Record<string, Attempt> | undefined) {
  const keys = exercise.levels.map((level) => levelKey(exercise.id, level.id))
  const done = keys.filter((key) => {
    const attempt = attempts?.[key]
    return attempt?.status === 'completed' && attempt.score > 0
  }).length
  return { done, total: keys.length }
}

export function findLevel(exercise: ExerciseModule, levelId: string | null | undefined) {
  if (!levelId) return null
  return exercise.levels.find((item) => item.id === levelId) ?? null
}

export function levelPassed(attempts: Record<string, Attempt> | undefined, exerciseId: string, levelId: string) {
  const attempt = attempts?.[levelKey(exerciseId, levelId)]
  return Boolean(attempt && attempt.status === 'completed' && attempt.score > 0)
}
