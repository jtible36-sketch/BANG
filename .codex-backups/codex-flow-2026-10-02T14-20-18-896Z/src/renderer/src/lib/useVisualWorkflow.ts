import { useEffect, useState } from 'react'

/** Manual media stays available while settings load, including when no API key is configured. */
export function useVisualWorkflow(): boolean {
  const [higgsfield, setHiggsfield] = useState(false)
  useEffect(() => {
    let active = true
    void window.api.settings.get().then((settings) => {
      if (active) setHiggsfield(settings.visualWorkflow === 'higgsfield')
    }).catch(() => {
      // A settings read failure must not turn on paid generation.
    })
    return () => { active = false }
  }, [])
  return higgsfield
}
