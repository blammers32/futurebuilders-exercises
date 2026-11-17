import { Link } from 'react-router-dom'
import { exercises } from '../lib/catalog'
import { syncMode } from '../lib/sync'
import { Topbar } from './Chrome'

export function Landing() {
  const mode = syncMode()
  return (
    <div className="app">
      <Topbar>
        <span className={mode === 'live' ? 'badge live' : 'badge'}>{mode === 'live' ? 'Firebase connected' : 'Demo sync'}</span>
      </Topbar>
      <main className="landing">
        <p className="kicker">MIT FutureBuilders, Interactive Exercises</p>
        <h1>Hand the work to the class. Take the room back when you need it.</h1>
        <p className="lede">
          An instructor desk with a sign-in, a class code, and a live picture of every student. Publish an exercise
          when they should work. Unpublish when you want their eyes up front. Publish it again at the end so they can
          walk the levels again on their own.
        </p>
        <div className="doors">
          <Link className="door" to="/teach">
            <span>Instructor</span>
            <strong>Open the desk</strong>
            <p>Sign in, publish levels, and watch the room move.</p>
          </Link>
          <Link className="door alt" to="/join">
            <span>Student</span>
            <strong>Join with a code</strong>
            <p>Your name, the code on the board, then the exercise if it is open.</p>
          </Link>
        </div>
        <ul className="catalog">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <span>{exercise.kicker}</span>
              <strong>{exercise.title}</strong>
              <p>{exercise.summary}</p>
              <em>{exercise.minutes} min · {exercise.levels.length} levels</em>
            </li>
          ))}
        </ul>
      </main>
      <footer className="foot">
        A teaching tool for FutureBuilders sessions. Not an official MIT site. Exercises are git submodules, so a new
        lesson can be added without rewriting the desk.
      </footer>
    </div>
  )
}
