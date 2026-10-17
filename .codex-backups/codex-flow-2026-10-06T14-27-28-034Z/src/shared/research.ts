import type { SkillId } from './skills'

export interface ResearchInput {
  query: string
  category: string
  skillId: SkillId
  skillVariant?: string
  styleId?: string
  language: string
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
