import type { SkillId } from './skills'

export type ProjectStatus = 'draft' | 'script' | 'storyboard' | 'editing' | 'exported'
export type AspectRatio = '16:9' | '9:16'
export type TtsProvider = 'gemini' | 'elevenlabs'
export type LlmProvider = 'gemini' | 'openrouter' | 'groq' | 'custom'
export type ApiProvider = 'higgsfield' | 'gemini' | 'elevenlabs' | 'openrouter' | 'groq' | 'custom'
/** Where a live model list comes from: an LLM provider, or a TTS catalog. */
export type ModelSource = LlmProvider | 'gemini-tts' | 'elevenlabs'
export type MotionType = 'camera' | 'video'
export type CameraPresetId = 'zoomin' | 'zoomout' | 'panleft' | 'panright' | 'kenburns' | 'shake' | 'static'
export type MotionStrength = 'halus' | 'sedang' | 'kuat'
export type TransitionId = 'cut' | 'fade' | 'slideleft' | 'zoomin'
export type CaptionStyleId = 'karaoke' | 'tebal' | 'minimal' | 'subtitle' | 'none'
export type CaptionPosition = 'atas' | 'tengah' | 'bawah'
export type CaptionSize = 'kecil' | 'sedang' | 'besar'
/** 1 idea, 2 script, 3 storyboard, 4 editor */
export type Step = 1 | 2 | 3 | 4

export interface EditorSettings {
  /** Voice is the timeline clock. Omitted on old projects means enabled. */
  autoSyncVoiceover?: boolean
  captionStyle: CaptionStyleId
  captionPosition: CaptionPosition
  captionSize: CaptionSize
  /** Caption size as a multiple of the style's size (0.5–1.8); overrides captionSize when set. */
  captionScale?: number
  /** Custom look on top of the chosen caption style; unset fields keep the style's own. */
  captionFont?: string
  captionColor?: string
  captionHighlight?: string
  /** Box behind the caption: a color and opacity, or null for no box. */
  captionBg?: { color: string; opacity: number } | null
  musicAssetId: string | null
  musicVolumeDb: number
  duckMusic: boolean
  /** Logos, watermarks and text placed over the video. */
  overlays: Overlay[]
  /** Last prompt written for making background music in an outside AI (Suno, Udio, …). */
  musicPrompt?: MusicPrompt | null
  /** Sound effects placed on the absolute project timeline (milliseconds). */
  sfx?: import('./sfx').SoundEffectCue[]
}

export interface MusicPrompt {
  /** Suno "Style of Music": comma-separated English tags. */
  style: string
  /** Suno "Exclude styles". */
  exclude: string
  title: string
  /** One paragraph for other music AIs (Udio, ElevenLabs Music, Stable Audio, …). */
  description: string
  /** Why this music fits, in Indonesian, for the user. */
  reason: string
  /** Video length when it was written, in seconds. */
  durationSec: number
}

/**
 * Where an overlay sits: `anchor` is a numpad position on the overlay itself (7 top-left, 5 center,
 * 3 bottom-right, the same numbering as ASS n), and `x`/`y` place that point as a fraction of the frame.
 */
interface OverlayBase {
  id: string
  anchor: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  x: number
  y: number
  /** Seconds on the final timeline; `end` null means until the video ends. */
  start: number
  end: number | null
}

export interface ImageOverlay extends OverlayBase {
  kind: 'image'
  assetId: string
  /** Width as a fraction of the frame width. */
  width: number
  opacity: number
}

export type TextOverlayStyle = 'plain' | 'outline' | 'box'

export interface TextOverlay extends OverlayBase {
  kind: 'text'
  text: string
  /** Font size as a fraction of the frame height. */
  size: number
  color: string
  style: TextOverlayStyle
  bold: boolean
}

export type Overlay = ImageOverlay | TextOverlay

export interface Project {
  id: string
  title: string
  synopsis: string
  /** Subject of the story, independent of the visual style and content skill. Empty on older projects. */
  subjectNiche: string
  durationSec: number
  language: string
  aspectRatio: AspectRatio
  styleId: string
  skillId?: SkillId
  skillVariant?: string
  /** Versioned production rules copied into this project; null uses its existing style and skill. */
  masterPrompt?: import('./master-prompts').MasterPromptProfile | null
  ttsProvider: TtsProvider
  ttsVoice: string
  /** Higgsfield endpoint ids; null falls back to the app default. */
  imageModel: string | null
  videoModel: string | null
  /** One of the video model's resolutions, e.g. "720p"; null or unsupported uses the default (1080p when offered). */
  videoResolution: string | null
  status: ProjectStatus
  step: Step
  coverAssetId: string | null
  editor: EditorSettings
  createdAt: number
  updatedAt: number
}

export interface Character {
  id: string
  projectId: string
  name: string
  description: string
  sheetAssetId: string | null
  sort: number
}

export interface Clip {
  id: string
  projectId: string
  sort: number
  title: string
  /** What happens in the scene, in the script's language (the Naskah step). */
  story: string
  visualPrompt: string
  /** The story text the current visual plan was written from; null before any plan. */
  visualSource: string | null
  narration: string
  durationMs: number
  characterIds: string[]
  motionType: MotionType
  cameraPreset: CameraPresetId
  motionStrength: MotionStrength
  videoPrompt: string
  transition: TransitionId
  imageAssetId: string | null
  videoAssetId: string | null
  audioAssetId: string | null
  /** Optional per-object animation; null restores the clip's normal image/video playback. */
  cutout?: import('./cutout-timeline').CutoutScene | null
}

export type AssetKind = 'image' | 'video' | 'audio' | 'music' | 'overlay' | 'export'

export interface WordTiming {
  text: string
  start: number
  end: number
}

export interface AssetMeta {
  words?: WordTiming[]
  estimatedTimings?: boolean
  voice?: string
  [key: string]: unknown
}

export interface Asset {
  id: string
  projectId: string
  clipId: string | null
  characterId: string | null
  kind: AssetKind
  provider: string | null
  model: string | null
  prompt: string | null
  remoteId: string | null
  remoteUrl: string | null
  localPath: string
  url: string
  durationMs: number | null
  width: number | null
  height: number | null
  meta: AssetMeta
  createdAt: number
}

/** "narration" voices several scenes in one take and cuts it per scene. */
export type JobKind = 'story' | 'image' | 'sheet' | 'video' | 'tts' | 'narration' | 'align' | 'export' | 'auto-edit' | 'cutout-plan' | 'cutout-asset'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

export interface Job {
  id: string
  projectId: string
  clipId: string | null
  characterId: string | null
  kind: JobKind
  provider: string
  status: JobStatus
  progress: number
  message: string | null
  error: string | null
  resultAssetId: string | null
  createdAt: number
  updatedAt: number
}

export interface ProjectBundle {
  editEpoch?: number
  project: Project
  characters: Character[]
  clips: Clip[]
  assets: Asset[]
  jobs: Job[]
}

export interface ProjectSummary {
  id: string
  title: string
  styleId: string
  status: ProjectStatus
  step: Step
  clipCount: number
  totalMs: number
  coverUrl: string | null
  updatedAt: number
}

/** What the renderer sends on save. Asset links are owned by the main process and never overwritten by a save. */
export interface ProjectSnapshot {
  editEpoch?: number
  project: Omit<Project, 'createdAt' | 'updatedAt' | 'coverAssetId'>
  characters: Omit<Character, 'sheetAssetId'>[]
  clips: Omit<Clip, 'imageAssetId' | 'videoAssetId' | 'audioAssetId'>[]
}

export interface NewProjectInput {
  synopsis?: string
  subjectNiche?: string
  durationSec?: number
  language?: string
  aspectRatio?: AspectRatio
  styleId?: string
  skillId?: SkillId
  skillVariant?: string
  masterPrompt?: import('./master-prompts').MasterPromptProfile | null
  ttsProvider?: TtsProvider
}

export interface KeyStatus {
  provider: ApiProvider
  configured: boolean
  lastOk: boolean | null
  lastMessage: string | null
  checkedAt: number | null
  /** Masked key for display, e.g. "sk-or-v1…9f3c". Null when there is no readable key. */
  preview: string | null
  /** A key is stored but can no longer be decrypted and must be entered again. */
  unreadable: boolean
}

export interface KeyTestResult {
  ok: boolean
  message: string
}

export interface VoiceOption {
  id: string
  name: string
  description: string
  previewUrl?: string | null
  /** Language metadata reported by the provider; model multilingual support is not voice verification. */
  languages?: string[]
  verifiedLanguages?: { language: string; locale?: string; accent?: string; modelId?: string; previewUrl?: string | null }[]
  accents?: string[]
  categories?: string[]
  category?: string
  gender?: string
  age?: string
  labels?: Record<string, string>
  source?: 'account' | 'library'
  /** Library entries must be explicitly added before their returned account ID is used for speech. */
  sharedVoice?: { publicOwnerId: string; voiceId: string }
}

export type VoiceUseCategory = 'social-media' | 'narration' | 'education' | 'characters' | 'advertising' | 'conversational'
export interface SharedVoiceSearchInput {
  language?: 'id' | 'ms'
  search?: string
  category?: VoiceUseCategory
  page?: number
  pageSize?: number
}
export interface SharedVoiceSearchResult {
  voices: VoiceOption[]
  hasMore: boolean
  totalCount?: number
  page: number
}
export interface SharedVoiceAddInput {
  publicOwnerId: string
  voiceId: string
  name: string
}

export interface AppSettings {
  /** Appearance preference; system follows the operating system's color scheme. */
  theme: 'light' | 'dark' | 'system'
  defaultTtsProvider: TtsProvider
  defaultLanguage: string
  exportFolder: string | null
  /** Which LLM writes stories and narration. */
  llmProvider: LlmProvider
  llmSource: 'api' | 'codex'
  visualPlannerSource: 'follow-story' | 'codex'
  codexConnections: Record<CodexChannel, boolean>
  /** Empty selects the current default from the account's native model catalog. */
  codexModel: string
  codexVisualModel: string
  storyTimeoutSec: number
  /** Visual planning may build a whole continuous chain; its limit is independent of script writing. */
  visualTimeoutSec: number
  /** Chosen model per LLM provider, so switching providers keeps each choice. */
  llmModels: Record<LlmProvider, string>
  /** Base URL of an OpenAI-compatible endpoint, e.g. http://localhost:11434/v1 */
  customBaseUrl: string
  geminiTtsModel: string
  elevenModel: string
  /** Local Codex image generation and Flow videos in the browser, or Higgsfield API. */
  visualWorkflow: 'codex-flow' | 'higgsfield' | 'flow-mcp'
  /** Local Flow owner process; credentials remain in the main process. */
  flowMcpPort: number
  flowChromePort: number
  flowRuntimeVersion: number
  flowVideoMaxCredits: number
  flowShotMedia: 'video' | 'image'
  /** Higgsfield models for new projects: the last ones picked in the Idea step. */
  imageModel: string
  videoModel: string
  /** Time captions against the real voice with Whisper after narration is made (when the model is present). */
  whisperAuto: boolean
}

/** What one Higgsfield request would cost, from the API's estimate endpoint. */
export interface CreditEstimate {
  credits: number
  usd: number | null
}

/** Local Codex availability; no account identifiers or credentials cross IPC. */
export interface CodexStatus {
  available: boolean
  authenticated: boolean
  imageGeneration: boolean
  version: string | null
  message: string
  connections?: Record<CodexChannel, boolean>
}

export type CodexChannel = 'story' | 'visual' | 'image' | 'video'

/** The local Whisper model used to time caption words. */
export interface WhisperStatus {
  state: 'missing' | 'downloading' | 'verifying' | 'ready'
  received: number
  total: number
  error: string | null
}

export interface ModelOption {
  id: string
  name: string
  description?: string
  contextLength?: number | null
  /** USD per 1M input / output tokens, when the provider publishes it. */
  priceIn?: number | null
  priceOut?: number | null
  /** Short labels the picker can filter on, e.g. "JSON", "Gratis", "Gambar". */
  tags: string[]
  /** Model family, e.g. "Kling", for a brand mark next to the name. */
  family?: string
  /** Higgsfield credits (and dollars) for one request; undefined while unknown, null when it cannot be estimated. */
  credits?: number | null
  usd?: number | null
  /** What the credits pay for, e.g. "10 dtk". */
  supportedEfforts?: string[]
  defaultEffort?: string
  isDefault?: boolean
  creditUnit?: string
}

export interface CodexEditOptions { model?: string; effort?: string }
export interface ModelList {
  models: ModelOption[]
  fetchedAt: number
}

export interface ExportOptions {
  /** Optional half-open project range; output timestamps begin at zero. */
  range?: import('./export-range').ExportRange
  fileName: string
  resolution: 720 | 1080 | 2160
  fps: 30 | 60
  burnCaptions: boolean
  writeSrt: boolean
  normalizeAudio: boolean
  duckMusic: boolean
  folder: string
}

export interface ClipPatchEvent {
  clipId: string
  patch: Partial<Clip>
}

export interface CharacterPatchEvent {
  characterId: string
  patch: Partial<Character>
}
