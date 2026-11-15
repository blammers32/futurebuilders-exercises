import type { ComponentType } from 'react'

export type SlideResult = { score: number; detail?: string }

export type SlideProps = {
  onComplete: (result: SlideResult) => void
  completed: boolean
}

export type SlideDef = {
  id: string
  title: string
  kind: 'lesson' | 'challenge'
  Component: ComponentType<SlideProps>
}

export type LevelDef = {
  id: string
  title: string
  blurb: string
  slides: SlideDef[]
}

export type ExerciseModule = {
  id: string
  title: string
  kicker: string
  summary: string
  minutes: number
  levels: LevelDef[]
}

export type Cursor = { levelId: string; slideId: string }

export type Student = {
  id: string
  name: string
  lastSeen: number
  levelId?: string
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
  Pick<Room, 'title' | 'instructorName' | 'published' | 'follow' | 'exerciseId' | 'released' | 'cursor' | 'note'>
>

export type Viewer = { role: 'instructor' } | { role: 'student'; id: string }

export function slideKey(exerciseId: string, levelId: string, slideId: string) {
  return `${exerciseId}__${levelId}__${slideId}`
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

export function challengeKeys(exercise: ExerciseModule) {
  return exercise.levels.flatMap((level) =>
    level.slides
      .filter((slide) => slide.kind === 'challenge')
      .map((slide) => slideKey(exercise.id, level.id, slide.id)),
  )
}

export function tally(exercise: ExerciseModule, attempts: Record<string, Attempt> | undefined) {
  const keys = challengeKeys(exercise)
  const done = keys.filter((key) => {
    const attempt = attempts?.[key]
    return attempt?.status === 'completed' && attempt.score > 0
  }).length
  return { done, total: keys.length }
}

export function findSlide(exercise: ExerciseModule, cursor: Cursor | null) {
  if (!cursor) return null
  const level = exercise.levels.find((item) => item.id === cursor.levelId)
  const slide = level?.slides.find((item) => item.id === cursor.slideId)
  if (!level || !slide) return null
  return { level, slide }
}
