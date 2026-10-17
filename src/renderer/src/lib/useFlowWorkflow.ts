import { useEffect, useState } from 'react'

export function useFlowWorkflow(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    const update = (): void => { void window.api.settings.get().then(s => { if (active) setEnabled(s.visualWorkflow === 'flow-mcp') }).catch(() => {}) }
    update(); window.addEventListener('naraflow-workflow', update)
    return () => { active = false; window.removeEventListener('naraflow-workflow', update) }
  }, [])
  return enabled
}
