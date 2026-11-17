import {
  mergeAttempt,
  parseReleased,
  type Attempt,
  type ControlPatch,
  type Room,
  type Student,
  type Viewer,
} from './types'

const CHANNEL = 'fb-classroom-v1'

function storageKey(code: string) {
  return `fb-room-${code}`
}

function readRoom(code: string): Room | null {
  const raw = localStorage.getItem(storageKey(code))
  if (!raw) return null
  try {
    const room = JSON.parse(raw) as Room
    room.released = parseReleased(room.released)
    room.review = Boolean(room.review)
    room.reviewIds = parseReleased(room.reviewIds)
    room.roster ??= {}
    room.progress ??= {}
    return room
  } catch {
    return null
  }
}

function writeRoom(room: Room) {
  const next = { ...room, updatedAt: Date.now() }
  localStorage.setItem(storageKey(room.code), JSON.stringify(next))
  const bus = new BroadcastChannel(CHANNEL)
  bus.postMessage({ code: room.code })
  bus.close()
  window.dispatchEvent(new CustomEvent('fb-room', { detail: room.code }))
  return next
}

export const localSync = {
  mode: 'demo' as const,
  watch(code: string, viewer: Viewer, onRoom: (room: Room | null) => void) {
    void viewer
    const emit = () => onRoom(readRoom(code))
    emit()
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(code)) emit()
    }
    const bus = new BroadcastChannel(CHANNEL)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.code === code) emit()
    }
    const onLocal = (event: Event) => {
      if ((event as CustomEvent<string>).detail === code) emit()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('fb-room', onLocal)
    bus.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('fb-room', onLocal)
      bus.removeEventListener('message', onMessage)
      bus.close()
    }
  },
  async createRoom(room: Room) {
    writeRoom(room)
  },
  async updateControl(code: string, patch: ControlPatch) {
    const room = readRoom(code)
    if (!room) throw new Error('That room is not on this computer.')
    writeRoom({ ...room, ...patch, released: patch.released ?? room.released })
  },
  async touchStudent(code: string, student: Student) {
    const room = readRoom(code)
    if (!room) return
    room.roster[student.id] = student
    writeRoom(room)
  },
  async report(code: string, studentId: string, key: string, attempt: Attempt) {
    const room = readRoom(code)
    if (!room) return
    const mine = room.progress[studentId] ?? {}
    mine[key] = mergeAttempt(mine[key], attempt)
    room.progress[studentId] = mine
    writeRoom(room)
  },
}
