import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { CodexChannel } from '@shared/types'
import { withCodexConnection } from './codex-connections'
import { researchWithCodex } from './providers/codex'
import { extractJson } from './services/json'
import { getSettings } from './settings'

export interface CodexTextRequest { system: string; prompt: string; schema: object; signal?: AbortSignal }

export async function generateCodexJson<T>(request: CodexTextRequest, channel: CodexChannel = 'story'): Promise<T> {
  return withCodexConnection(channel, async (signal) => {
    const root = realpathSync(tmpdir())
    const path = mkdtempSync(join(root, 'bang-story-text-'))
    const actual = realpathSync(path)
    try {
      const result = await researchWithCodex({ prompt: `${request.system}\n\n${request.prompt}`,
        outputDirectory: path, outputSchema: request.schema as Record<string, unknown>,
        webSearch: false, model: getSettings().codexModel, signal })
      signal.throwIfAborted()
      return extractJson(result.text) as T
    } catch (error) {
      if (request.signal?.aborted) throw request.signal.reason
      throw error
    } finally {
      // Exact private workspace only; never remove project media or user Codex data.
      if (dirname(actual) === root && basename(actual).startsWith('bang-story-text-')) {
        try { if (realpathSync(path) === actual) rmSync(path, { recursive: true, force: true }) } catch { /* best-effort cleanup */ }
      }
    }
  }, request.signal)
}
