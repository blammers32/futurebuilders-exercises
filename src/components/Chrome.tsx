import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export function Topbar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <Mark />
        <span>
          <strong>MIT FutureBuilders</strong>
          <small>Interactive Exercises</small>
        </span>
      </Link>
      <div className="top-actions">{children}</div>
    </header>
  )
}

export function ModeBadge({ mode }: { mode: 'demo' | 'live' }) {
  return <span className={mode === 'live' ? 'badge live' : 'badge'}>{mode === 'live' ? 'Live room' : 'This computer'}</span>
}
