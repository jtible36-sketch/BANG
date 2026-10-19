import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENTS, type StudioApi } from '../shared/api'

const call =
  <T>(channel: string) =>
  (...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args)

const listen =
  <T>(channel: string) =>
  (cb: (payload: T) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }

const api: StudioApi = {
  cutoutAssets: { generateBatch: call('cutoutAssets:generateBatch'), state: call('cutoutAssets:state'), plan: call('cutoutAssets:plan'), save: call('cutoutAssets:save'), status: call('cutoutAssets:status'), generate: call('cutoutAssets:generate'), recover: call('cutoutAssets:recover') },
  cutoutStudio:{preview:call('cutoutStudio:preview'),orphans:call('cutoutStudio:orphans'),linkOrphan:call('cutoutStudio:linkOrphan'),archiveOrphan:call('cutoutStudio:archiveOrphan'),reviewAsset:call('cutoutStudio:reviewAsset'),report:call('cutoutStudio:report'),saveBrief:call('cutoutStudio:saveBrief'),approveCredits:call('cutoutStudio:approveCredits'),upgradePlan:call('cutoutStudio:upgradePlan'),outcomes:call('cutoutStudio:outcomes'),backgrounds:call('cutoutStudio:backgrounds'),comedyProfile:call('cutoutStudio:comedyProfile'),history:call('cutoutStudio:history')},
  cutoutV5: {readiness:call('cutoutV5:readiness'),recordLicense:call('cutoutV5:recordLicense')},
  editorAutomation: { recoverMissingAssets: call('editorAutomation:recoverMissingAssets'), resume: call('editorAutomation:resume'), status: call('editorAutomation:status'), context: call('editorAutomation:context'), run: call('editorAutomation:run'), undo: call('editorAutomation:undo'), presence: call('editorAutomation:presence') },
  flow: {
    status: call('flow:status'), prepare: call('flow:prepare'), clipImage: call('flow:clipImage'), clipVideo: call('flow:clipVideo'),
    characterSheet: call('flow:characterSheet'), missingImages: call('flow:missingImages'), missingVideos: call('flow:missingVideos'), recover: call('flow:recover')
  },
  media: { previousVideoFrame: call('media:previousVideoFrame') },
  masterPrompts: {
    list: call('masterPrompts:list'),
    save: call('masterPrompts:save'),
    remove: call('masterPrompts:remove')
  },
  healthLibrary: {
    list: call('healthLibrary:list'),
    import: call('healthLibrary:import'),
    export: call('healthLibrary:export')
  },
  research: {
    list: call('research:list'),
    get: call('research:get'),
    run: call('research:run'),
    refreshIdeas: call('research:refreshIdeas'),
    selectTopic: call('research:selectTopic'),
    selectIdea: call('research:selectIdea'),
    selectStyle: call('research:selectStyle'),
    updateThumbnailPrompt: call('research:updateThumbnailPrompt'),
    generateThumbnail: call('research:generateThumbnail'),
    exportThumbnail: call('research:exportThumbnail'),
    createProject: call('research:createProject')
  },
  projects: {
    list: call('projects:list'),
    create: call('projects:create'),
    get: call('projects:get'),
    save: call('projects:save'),
    remove: call('projects:remove'),
    duplicate: call('projects:duplicate')
  },
  story: {
    visualNarration: call('story:visualNarration'),
    applyVisualNarration: call('story:applyVisualNarration'),
    script: call('story:script'),
    characters: call('story:characters'),
    cancel: call('story:cancel'),
    visuals: call('story:visuals'),
    musicPrompt: call('story:musicPrompt'),
    exportImagePrompts: call('story:exportImagePrompts')
  },
  generate: {
    syncVoiceover: call('generate:syncVoiceover'),
    clipImage: call('generate:clipImage'),
    clipVideo: call('generate:clipVideo'),
    clipTts: call('generate:clipTts'),
    characterSheet: call('generate:characterSheet'),
    missingImages: call('generate:missingImages'),
    missingVideos: call('generate:missingVideos'),
    missingTts: call('generate:missingTts'),
    narration: call('generate:narration'),
    syncCaptions: call('generate:syncCaptions'),
    cancel: call('generate:cancel'),
    estimate: call('generate:estimate')
  },
  codex: {
    status: call('codex:status'),
    connect: call('codex:connect'),
    models: call('codex:models'),
    videoPrompt: call('codex:videoPrompt'),
    generateClipImage: call('codex:generateClipImage'),
    missingImages: call('codex:missingImages'),
    generateCharacterSheet: call('codex:generateCharacterSheet')
  },
  assets: {
    setActive: call('assets:setActive'),
    pickClipImage: call('assets:pickClipImage'),
    pickClipVideo: call('assets:pickClipVideo'),
    pickCharacterSheet: call('assets:pickCharacterSheet'),
    selectCharacterReference: call('assets:selectCharacterReference'),
    exportImage: call('assets:exportImage'),
    pickMusic: call('assets:pickMusic'),
    pickImage: call('assets:pickImage')
  },
  settings: {
    get: call('settings:get'),
    set: call('settings:set'),
    keys: call('settings:keys'),
    setKey: call('settings:setKey'),
    setCustom: call('settings:setCustom'),
    clearKey: call('settings:clearKey'),
    revealKey: call('settings:revealKey'),
    testKey: call('settings:testKey'),
    voices: call('settings:voices'),
    sharedVoices: call('settings:sharedVoices'),
    addSharedVoice: call('settings:addSharedVoice')
  },
  models: {
    list: call('models:list')
  },
  exporter: {
    capcut: call('export:capcut'),
    start: call('export:start'),
    defaultFolder: call('export:defaultFolder'),
    pickFolder: call('export:pickFolder'),
    reveal: call('export:reveal')
  },
  app: {
    openExternal: call('app:openExternal'),
    copyText: call('app:copyText')
  },
  whisper: {
    status: call('whisper:status'),
    download: call('whisper:download'),
    cancel: call('whisper:cancel'),
    remove: call('whisper:remove'),
    openFolder: call('whisper:openFolder')
  },
  on: {
    editorPresenceRequest: listen(EVENTS.editorPresenceRequest),
    editorAutomation: listen(EVENTS.editorAutomation),
    whisper: listen(EVENTS.whisper),
    job: listen(EVENTS.job),
    clip: listen(EVENTS.clip),
    character: listen(EVENTS.character),
    asset: listen(EVENTS.asset)
  }
}

contextBridge.exposeInMainWorld('api', api)
