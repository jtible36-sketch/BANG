import type { ProjectBundle } from './types'

export interface HealthLibraryItem {
  id: string
  name: string
  description: string
  group: string
  tags: string[]
  kind: 'master' | 'sheet'
  previewUrl: string
  members?: string[]
}

export interface HealthLibraryImport {
  bundle: ProjectBundle
  characterId: string
}
