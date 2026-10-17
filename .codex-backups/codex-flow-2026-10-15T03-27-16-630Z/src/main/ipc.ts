import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import type {
  ApiProvider,
  AppSettings,
  AspectRatio,
  ExportOptions,
  KeyTestResult,
  ModelSource,
  NewProjectInput,
  ProjectSnapshot,
  SharedVoiceAddInput,
  SharedVoiceSearchInput,
  TtsProvider,
  VoiceOption
} from '@shared/types'
import { startExport } from './exporter'
import { startCapcutExport } from './capcut-export'
import { readFlowStatus, prepareFlow } from './providers/flow-mcp'
import { generateFlowImage, generateFlowVideo, generateFlowCharacter, missingFlowImages, missingFlowVideos, recoverFlowJobs } from './flow-generation'
import { generateCodexClipImage, generateCodexCharacterSheet, generateMissingCodexImages } from './codex-generation'
import { listCodexModels } from './providers/codex'
import { codexConnectionStatus, setCodexConnection } from './codex-connections'
import { composeStory, composeVisualNarration, cancelStory } from './story-requests'
import { applyVisualNarration } from './visual-narration'
import { syncVoiceover } from './voiceover-sync'
import { generateCodexVideoPrompt } from './codex-video'
import { listHealthLibrary, importHealthCharacter, exportHealthLibraryImage } from './health-library'
import {
  estimateCredits,
  forgetEstimates,
  generateCharacterSheet,
  generateClipImage,
  generateClipTts,
  generateClipVideo,
  generateMissingImages,
  generateMissingVideos,
  generateMissingTts,
  setActiveAsset
} from './generation'
import { cancelJob } from './jobs'
import { exportImage, pickCharacterSheet, pickClipImage, pickClipVideo, previousVideoFrame } from './media-import'
import { generateNarration, syncCaptions } from './narration'
import { cancelDownload, downloadModel, openModelFolder, removeModel, whisperStatus } from './whisper'
import { assetAbsPath } from './paths'
import { createProject, duplicateProject, getBundle, getProject, insertAsset, listProjects, removeProject, saveSnapshot } from './repo'
import { clearSecret, keyStatuses, recordCheck, revealSecret, setSecret } from './secrets'
import { dropCache, getSettings, setSettings } from './settings'
import { probeDurationMs, probeSize } from './services/audio'
import * as eleven from './services/elevenlabs'
import * as gemini from './services/gemini'
import * as hf from './services/higgsfield'
import * as llm from './services/llm'
import { generateMusicPrompt } from './story'
import { exportImagePrompts } from './prompt-export'
import { listMasterPrompts, saveMasterPrompt, removeMasterPrompt } from './master-prompts'
import type { ResearchInput } from '@shared/research'
import {
  listResearch, getResearch, runResearch, refreshTopicIdeas, selectResearchTopic, selectResearchIdea, selectResearchStyle,
  updateThumbnailPrompt, generateTopicThumbnail, exportTopicThumbnail, createTopicProject
} from './research'


type Handler = (...args: any[]) => unknown

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      // Only the message crosses the IPC boundary; keep it readable for the user.
      throw new Error((e as Error)?.message ?? String(e))
    }
  })
}

async function testProvider(provider: ApiProvider, key?: string): Promise<KeyTestResult> {
  if (provider === 'higgsfield') return hf.testCredentials(key)
  if (provider === 'elevenlabs') return eleven.testKey(key)
  return llm.testLlm(provider, key)
}

function defaultExportFolder(): string {
  return getSettings().exportFolder ?? join(app.getPath('videos'), 'Bang Story')
}

export function registerIpc(): void {
  handle('flow:status', readFlowStatus)
  handle('flow:prepare', prepareFlow)
  handle('flow:clipImage', generateFlowImage)
  handle('flow:clipVideo', generateFlowVideo)
  handle('flow:characterSheet', generateFlowCharacter)
  handle('flow:missingImages', missingFlowImages)
  handle('flow:missingVideos', missingFlowVideos)
  handle('flow:recover', recoverFlowJobs)
  handle('export:capcut', startCapcutExport)
  handle('media:previousVideoFrame', (clipId: string) => previousVideoFrame(clipId))
  handle('masterPrompts:list', () => listMasterPrompts())
  handle('masterPrompts:save', (profile: unknown) => saveMasterPrompt(profile))
  handle('masterPrompts:remove', (id: string) => removeMasterPrompt(id))
  handle('healthLibrary:list', () => listHealthLibrary())
  handle('healthLibrary:import', (projectId: string, itemId: string, characterId?: string) => importHealthCharacter(projectId, itemId, characterId))
  handle('healthLibrary:export', (itemId: string) => exportHealthLibraryImage(itemId))
  handle('research:list', () => listResearch())
  handle('research:get', (id: string) => getResearch(id))
  handle('research:run', (input: ResearchInput) => runResearch(input))
  handle('research:refreshIdeas', (sessionId: string, topicId: string) => refreshTopicIdeas(sessionId, topicId))
  handle('research:selectTopic', (sessionId: string, topicId: string, selected: boolean) => selectResearchTopic(sessionId, topicId, selected))
  handle('research:selectIdea', (sessionId: string, topicId: string, ideaId: string) => selectResearchIdea(sessionId, topicId, ideaId))
  handle('research:selectStyle', (sessionId: string, styleId: string) => selectResearchStyle(sessionId, styleId))
  handle('research:updateThumbnailPrompt', (sessionId: string, topicId: string, prompt: string) => updateThumbnailPrompt(sessionId, topicId, prompt))
  handle('research:generateThumbnail', (sessionId: string, topicId: string) => generateTopicThumbnail(sessionId, topicId))
  handle('research:exportThumbnail', (sessionId: string, topicId: string) => exportTopicThumbnail(sessionId, topicId))
  handle('research:createProject', (sessionId: string, topicId: string, input: NewProjectInput) => createTopicProject(sessionId, topicId, input))
  handle('projects:list', () => listProjects())
  handle('projects:create', (input: NewProjectInput) => getBundle(createProject(input).id))
  handle('projects:get', (id: string) => getBundle(id))
  handle('projects:save', (snap: ProjectSnapshot) => {
    const kept = new Set(snap.clips.map(clip => clip.id))
    const removedJobs = getBundle(snap.project.id).jobs.filter(job => job.clipId && !kept.has(job.clipId) && (job.status === 'queued' || job.status === 'running'))
    const updatedAt = saveSnapshot(snap)
    // Abort local work as soon as deletion commits. Remote cancellation may finish later.
    void Promise.allSettled(removedJobs.map(job => cancelJob(job.id)))
    return { updatedAt }
  })
  handle('projects:remove', (id: string) => removeProject(id))
  handle('projects:duplicate', (id: string) => duplicateProject(id))

  handle('story:script', (projectId: string) => composeStory(projectId))
  handle('story:visualNarration', composeVisualNarration)
  handle('story:applyVisualNarration', applyVisualNarration)
  handle('generate:syncVoiceover', syncVoiceover)
  handle('story:characters', (projectId: string) => composeStory(projectId, 'characters'))
  handle('story:cancel', (projectId: string) => cancelStory(projectId))
  handle('story:musicPrompt', (projectId: string) => generateMusicPrompt(projectId))
  handle('story:exportImagePrompts', (projectId: string) => exportImagePrompts(projectId))
  handle('story:visuals', (projectId: string, mode: 'missing' | 'all') => composeStory(projectId, 'visuals', mode === 'all' ? 'all' : 'missing'))

  handle('generate:clipImage', (clipId: string) => generateClipImage(clipId))
  handle('codex:status', () => codexConnectionStatus())
  handle('codex:connect', setCodexConnection)
  handle('codex:models', () => listCodexModels())
  handle('codex:videoPrompt', generateCodexVideoPrompt)
  handle('codex:generateClipImage', (clipId: string) => generateCodexClipImage(clipId))
  handle('codex:missingImages', (projectId: string) => generateMissingCodexImages(projectId))
  handle('codex:generateCharacterSheet', (characterId: string) => generateCodexCharacterSheet(characterId))
  handle('generate:clipVideo', (clipId: string) => generateClipVideo(clipId))
  handle('generate:clipTts', (clipId: string) => generateClipTts(clipId))
  handle('generate:characterSheet', (characterId: string) => generateCharacterSheet(characterId))
  handle('generate:missingImages', (projectId: string) => generateMissingImages(projectId))
  handle('generate:missingVideos', (projectId: string) => generateMissingVideos(projectId))
  handle('generate:missingTts', (projectId: string) => generateMissingTts(projectId))
  handle('generate:narration', (projectId: string, mode: 'missing' | 'all') => generateNarration(projectId, mode === 'all' ? 'all' : 'missing'))
  handle('generate:syncCaptions', (projectId: string) => syncCaptions(projectId))

  handle('whisper:status', () => whisperStatus())
  // The download runs in the background and reports through whisper events.
  handle('whisper:download', () => {
    void downloadModel().catch(() => {})
  })
  handle('whisper:cancel', () => cancelDownload())
  handle('whisper:remove', () => removeModel())
  handle('whisper:openFolder', () => openModelFolder())
  handle('generate:cancel', (jobId: string) => cancelJob(jobId))
  handle('generate:estimate', (kind: 'image' | 'video', modelId: string, aspect: AspectRatio, seconds?: number, resolution?: string | null) =>
    estimateCredits(kind, modelId, aspect, seconds, resolution)
  )

  handle('assets:setActive', (clipId: string, assetId: string) => setActiveAsset(clipId, assetId))
  handle('assets:pickClipImage', (clipId: string) => pickClipImage(clipId))
  handle('assets:pickClipVideo', (clipId: string) => pickClipVideo(clipId))
  handle('assets:pickCharacterSheet', (characterId: string) => pickCharacterSheet(characterId))
  handle('assets:exportImage', (assetId: string) => exportImage(assetId))
  handle('assets:pickMusic', async (projectId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih musik latar',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `music/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const durationMs = await probeDurationMs(abs).catch(() => null)
    return insertAsset({
      projectId,
      kind: 'music',
      provider: 'local',
      prompt: src.split(/[\\/]/).pop() ?? 'musik',
      localPath: rel,
      durationMs
    })
  })

  handle('assets:pickImage', async (projectId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih gambar logo atau watermark',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    getProject(projectId)
    const src = res.filePaths[0]
    const rel = `overlays/${randomUUID()}${extname(src).toLowerCase()}`
    const abs = assetAbsPath(projectId, rel)
    mkdirSync(dirname(abs), { recursive: true })
    copyFileSync(src, abs)
    const size = await probeSize(abs).catch(() => null)
    if (!size) throw new Error('Gambar tidak bisa dibaca. Pakai file PNG, JPG, atau WebP.')
    return insertAsset({
      projectId,
      kind: 'overlay',
      provider: 'local',
      prompt: basename(src),
      localPath: rel,
      width: size.width,
      height: size.height
    })
  })

  handle('settings:get', () => getSettings())
  handle('settings:set', (patch: Partial<AppSettings>) => setSettings(patch))
  handle('settings:keys', () => keyStatuses())
  handle('settings:setKey', async (provider: ApiProvider, key: string) => {
    const clean = key.trim()
    if (!clean) throw new Error('Kunci masih kosong')
    setSecret(provider, clean)
    dropCache(`models:${provider}`)
    if (provider === 'gemini') dropCache('models:gemini-tts')
    if (provider === 'higgsfield') forgetEstimates()
    const result = await testProvider(provider, clean)
    recordCheck(provider, result.ok, result.message)
    return result
  })
  handle('settings:setCustom', async (baseUrl: string, key: string) => {
    const url = baseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Alamat endpoint harus diawali http:// atau https://')
    setSettings({ customBaseUrl: url })
    if (key.trim()) setSecret('custom', key.trim())
    dropCache('models:custom')
    const result = await llm.testLlm('custom', key.trim() || undefined, url)
    recordCheck('custom', result.ok, result.message)
    return result
  })
  handle('settings:clearKey', (provider: ApiProvider) => {
    clearSecret(provider)
    dropCache(`models:${provider}`)
    if (provider === 'higgsfield') forgetEstimates()
    if (provider === 'custom') setSettings({ customBaseUrl: '' })
  })
  handle('models:list', (source: ModelSource, refresh?: boolean) => llm.listModels(source, !!refresh))
  handle('settings:testKey', async (provider: ApiProvider) => {
    const result = await testProvider(provider).catch((e): KeyTestResult => ({ ok: false, message: (e as Error).message }))
    recordCheck(provider, result.ok, result.message)
    return result
  })
  handle('settings:revealKey', (provider: ApiProvider) => revealSecret(provider))
  handle('settings:voices', async (provider: TtsProvider): Promise<VoiceOption[]> => {
    if (provider === 'gemini') return gemini.listVoices()
    return eleven.listVoices()
  })
  handle('settings:sharedVoices', (input: SharedVoiceSearchInput) => eleven.searchSharedVoices(input))
  handle('settings:addSharedVoice', (input: SharedVoiceAddInput) => eleven.addSharedVoice(input))

  handle('export:start', (projectId: string, opts: ExportOptions) => startExport(projectId, opts))
  handle('export:defaultFolder', () => defaultExportFolder())
  handle('export:pickFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Pilih folder ekspor',
      defaultPath: defaultExportFolder(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    setSettings({ exportFolder: res.filePaths[0] })
    return res.filePaths[0]
  })
  handle('export:reveal', (path: string) => shell.showItemInFolder(path))

  handle('app:copyText', (text: string) => clipboard.writeText(String(text)))
  handle('app:openExternal', (url: string) => {
    if (/^https:\/\//i.test(url)) return shell.openExternal(url)
    return undefined
  })
}
