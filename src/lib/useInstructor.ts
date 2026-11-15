import { useEffect, useMemo, useState } from 'react'
import { demoSession } from './desk'
import { firebaseConfig } from './sync'

export function useInstructor() {
  const config = useMemo(() => firebaseConfig(), [])
  const [state, setState] = useState<{ status: 'loading' | 'out' | 'in'; name: string; uid: string }>({
    status: 'loading',
    name: '',
    uid: '',
  })

  useEffect(() => {
    if (!config) {
      const apply = () => {
        const session = demoSession()
        setState(session ? { status: 'in', name: session.name, uid: '' } : { status: 'out', name: '', uid: '' })
      }
      apply()
      window.addEventListener('fb-desk', apply)
      return () => window.removeEventListener('fb-desk', apply)
    }
    let stop = () => {}
    let cancelled = false
    void import('./live').then((mod) => {
      if (cancelled) return
      stop = mod.watchLiveUser(config, (user) => {
        if (!user) {
          setState({ status: 'out', name: '', uid: '' })
          return
        }
        void mod.instructorName(config, user.uid, user.email || 'Instructor').then((name) => {
          if (!cancelled) setState({ status: 'in', name, uid: user.uid })
        })
      })
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [config])

  return { ...state, live: Boolean(config) }
}
