import { Route, Routes } from 'react-router-dom'
import { Join } from './components/Join'
import { Landing } from './components/Landing'
import { Present } from './components/Present'
import { StudentRoom } from './components/StudentRoom'
import { Teach } from './components/Teach'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/teach" element={<Teach />} />
      <Route path="/teach/:code" element={<Teach />} />
      <Route path="/present/:code" element={<Present />} />
      <Route path="/join" element={<Join />} />
      <Route path="/s/:code" element={<StudentRoom />} />
    </Routes>
  )
}
