import { useEffect, useState } from 'react'
import type { CodexStatus } from '@shared/types'

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

/** Checks the local Codex connection only in the Codex workflow; users can retry after login. */
export function useCodexStatus(enabled: boolean): { status: CodexStatus | null; checking: boolean; refresh: () => void } {
  const [status, setStatus] = useState<CodexStatus | null>(null)
  const [checking, setChecking] = useState(enabled)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setChecking(false)
      setStatus(null)
      return
    }
    let active = true
    setChecking(true)
    void Promise.resolve().then(() => window.api.codex.status()).then((next) => {
      if (active) setStatus(next)
    }).catch((error: unknown) => {
      if (active) setStatus({
        available: false,
        authenticated: false,
        imageGeneration: false,
        version: null,
        message: `Codex lokal belum bisa diperiksa. ${error instanceof Error ? error.message : String(error)}`
      })
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => { active = false }
  }, [enabled, revision])
  return { status, checking, refresh: () => setRevision((value) => value + 1) }
}
