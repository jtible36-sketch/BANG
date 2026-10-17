import type { SkillId } from './skills'

import type { MasterPromptProfile } from './master-prompts'

export interface ResearchInput {
  query: string
  category: string
  skillId: SkillId
  skillVariant?: string
  styleId?: string
  language: string
  masterPrompt?: MasterPromptProfile | null
  /** Six researched story examples tailored to the current style and master snapshot. */
  purpose?: 'style-ideas'
}

export interface ResearchSource {
  title: string
  url: string
  publishedAt?: string
}

/** Editorial estimates, each bounded by its published maximum; never audience metrics. */
export interface TopicScoreFactors {
  curiosity: number
  relevance: number
  visual: number
  novelty: number
  timeliness: number
}

export const SCORE_FACTORS = [
  { key: 'curiosity', label: 'Rasa penasaran', max: 25 },
  { key: 'relevance', label: 'Relevansi penonton', max: 25 },
  { key: 'visual', label: 'Kekuatan visual', max: 20 },
  { key: 'novelty', label: 'Sudut baru', max: 15 },
  { key: 'timeliness', label: 'Momentum', max: 15 }
] as const

export interface TopicIdea {
  id: string
  title: string
  hook: string
  angle: string
  synopsis: string
  /** Explains why the concrete story can be told with the selected visual/master rules. */
  fitReason?: string
}

/** Stable comparison of all context that affects a story-example request. */
export function storyIdeasContextKey(input: ResearchInput): string {
  return JSON.stringify({ query: input.query?.trim() || '', category: input.category || 'Semua', skillId: input.skillId,
    skillVariant: input.skillVariant || '', styleId: input.styleId || '', language: input.language || 'id', masterPrompt: input.masterPrompt ?? null })
}

export function storyIdeaSynopsis(topic: ResearchTopic, idea: TopicIdea): string {
  const evidence = topic.sources.length
    ? `Sumber yang teramati dalam riset (periksa dukungan untuk setiap klaim):\n${topic.sources.slice(0, 4).map((source) => `${source.title}: ${source.url}`).join('\n')}`
    : 'Status riset: ide editorial, sumber faktual belum terverifikasi. Verifikasi klaim sebelum dijadikan narasi faktual.'
  return [idea.title || topic.title, idea.hook ? `Hook: ${idea.hook}` : '', idea.angle ? `Sudut: ${idea.angle}` : '', evidence, idea.synopsis]
    .filter(Boolean).join('\n\n').slice(0, 4000)
}

export interface ResearchThumbnail {
  localPath: string
  url: string
  /** Captured prompt for these exact bytes; preserved when the chosen idea changes. */
  prompt?: string
  styleId?: string
  /** Complete captured request used for these bytes, including the selected style. */
  renderPrompt?: string
  width: number
  height: number
  createdAt: number
}

export interface ResearchTopic {
  id: string
  title: string
  summary: string
  keyword: string
  score: number
  factors: TopicScoreFactors
  scoreReason: string
  evidenceLevel: 'sources' | 'editorial'
  sources: ResearchSource[]
  ideas: TopicIdea[]
  selectedIdeaId: string | null
  selected: boolean
  thumbnailPrompt: string
  thumbnail: ResearchThumbnail | null
  projectId: string | null
  /** The exact idea used by projectId; another selected idea can become a new project. */
  projectIdeaId?: string | null
  updatedAt: number
}

export interface ResearchSession extends ResearchInput {
  id: string
  source: 'codex-web' | 'codex-ideas'
  generatedAt: number
  updatedAt: number
  topics: ResearchTopic[]
}
