import { builtInMasterPrompts, validateMasterPrompt, type MasterPromptProfile } from '@shared/master-prompts'
import { getDb } from './db'

export function listMasterPrompts(): MasterPromptProfile[] {
  const rows = getDb().prepare('SELECT data_json FROM master_prompt_profiles ORDER BY updated_at DESC, id').all() as { data_json: string }[]
  return [...builtInMasterPrompts.map(validateMasterPrompt), ...rows.map((row) => validateMasterPrompt(JSON.parse(row.data_json)))]
}

/** New drafts start at v1. Saving a library edit increments its version atomically. */
export function saveMasterPrompt(value: unknown): MasterPromptProfile {
  const incoming = validateMasterPrompt(value)
  if (incoming.id.startsWith('builtin:')) throw new Error('Master bawaan tidak bisa ditimpa. Buat salinan pribadi terlebih dahulu.')
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare('SELECT data_json FROM master_prompt_profiles WHERE id = ?').get(incoming.id) as { data_json: string } | undefined
    const current = row ? validateMasterPrompt(JSON.parse(row.data_json)) : null
    if (current && incoming.version !== current.version) throw new Error('Master prompt ini sudah berubah. Muat versi terbaru sebelum menyimpan lagi.')
    const saved = validateMasterPrompt({ ...incoming, version: current ? current.version + 1 : 1 })
    db.prepare('INSERT INTO master_prompt_profiles (id, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at')
      .run(saved.id, JSON.stringify(saved), Date.now())
    return saved
  })()
}

export function removeMasterPrompt(id: string): void {
  if (typeof id !== 'string' || !/^custom:[a-zA-Z0-9][a-zA-Z0-9._-]{0,112}$/.test(id)) throw new Error('Hanya master prompt pribadi yang bisa dihapus dari pustaka.')
  // Projects retain their snapshot even after its originating library entry has been removed.
  getDb().prepare('DELETE FROM master_prompt_profiles WHERE id = ?').run(id)
}
