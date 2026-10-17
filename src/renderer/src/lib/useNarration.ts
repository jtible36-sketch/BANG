import { useEffect } from 'react'
import { create } from 'zustand'
import { geminiVoiceName } from '@shared/models'
import { selectTtsProvider, TTS_NAMES, ttsReadiness, ttsVoiceForProvider } from '@shared/tts'
import { filterVoiceCatalog } from '@shared/voice-catalog'
import type { Clip, KeyStatus, Project, TtsProvider, VoiceOption } from '@shared/types'
import { confirmDialog } from '../components/ui'
import { useApp } from '../store/app'
import { isRunning, jobFor, useProject } from '../store/project'
import { errorText } from './format'

interface VoiceRoute {
  context: string
  keys: KeyStatus[]
  provider: TtsProvider | null
  voice: string
  voices: VoiceOption[]
  error: string | null
}

const contextOf = (project: Project): string => JSON.stringify([project.id, project.ttsProvider, project.ttsVoice])
const useVoiceRoute = create<{ route: VoiceRoute | null; checking: boolean; busyProjectId: string | null }>(() => ({ route: null, checking: false, busyProjectId: null }))
let lookup: { context: string; promise: Promise<VoiceRoute> } | null = null
const starting = new Set<string>()

/** Only key status crosses into the renderer. Opening a project never changes its saved voice. */
async function resolveRoute(project: Project, preferred = project.ttsProvider): Promise<VoiceRoute> {
  const context = JSON.stringify([contextOf(project), preferred])
  if (lookup?.context === context) return lookup.promise
  useVoiceRoute.setState({ checking: true })
  const promise = (async (): Promise<VoiceRoute> => {
    const keys = await window.api.settings.keys()
    const provider = selectTtsProvider(preferred, keys)
    const voice = provider ? ttsVoiceForProvider(provider, project.ttsVoice, project.ttsProvider) : ''
    if (!provider) return { context: contextOf(project), keys, provider, voice: '', voices: [], error: null }
    try {
      const voices = await window.api.settings.voices(provider)
      const selected = voice || filterVoiceCatalog(voices, { language: project.language, category: 'social-media' })[0]?.id || voices[0]?.id || ''
      return { context: contextOf(project), keys, provider, voice: selected, voices, error: selected ? null : 'Belum ada suara yang tersedia. Periksa koneksi suara di Pengaturan.' }
    } catch (error) {
      // An existing provider-compatible voice can still be used when the voice catalogue is unavailable.
      return { context: contextOf(project), keys, provider, voice, voices: [], error: voice ? null : errorText(error) }
    }
  })()
  lookup = { context, promise }
  try {
    const route = await promise
    const current = useProject.getState().project
    if (current && contextOf(current) === contextOf(project)) useVoiceRoute.setState({ route })
    return route
  } finally {
    if (lookup?.promise === promise) {
      lookup = null
      useVoiceRoute.setState({ checking: false })
    }
  }
}

export function useNarration() {
  const project = useProject((state) => state.project)
  const clips = useProject((state) => state.clips)
  const assets = useProject((state) => state.assets)
  const jobs = useProject((state) => state.jobs)
  const routing = useVoiceRoute()
  const { toast, go } = useApp()
  const job = jobFor(jobs, 'narration', {})
  const context = project ? contextOf(project) : ''
  const route = routing.route?.context === context ? routing.route : null

  useEffect(() => {
    if (!project) return
    void resolveRoute(project).catch((error) => {
      if (useProject.getState().project?.id === project.id) {
        useVoiceRoute.setState({ route: { context: contextOf(project), keys: [], provider: null, voice: '', voices: [], error: errorText(error) } })
      }
    })
  }, [context])

  const outdated = (clip: Clip): boolean => {
    if (!clip.narration.trim()) return false
    const voice = clip.audioAssetId ? assets[clip.audioAssetId] : null
    return !voice || (voice.prompt ?? '').trim() !== clip.narration.trim()
      || !!route?.provider && (voice.provider !== route.provider || !!voice.meta.voice && voice.meta.voice !== route.voice)
  }
  const voiced = clips.filter((clip) => clip.audioAssetId).length
  const running = isRunning(job) || !!project && routing.busyProjectId === project.id

  const start = async (): Promise<void> => {
    const initial = useProject.getState()
    const id = initial.project?.id
    if (!initial.project || !id || starting.has(id) || isRunning(jobFor(initial.jobs, 'narration', {}))) return
    starting.add(id)
    useVoiceRoute.setState({ busyProjectId: id })
    try {
      if (initial.clips.some((clip) => clip.audioAssetId)) {
        const ok = await confirmDialog({
          title: 'Rekam ulang suara narasi?',
          body: 'Narasi semua adegan direkam ulang dalam satu kali jalan lalu dipotong per adegan, supaya suaranya tetap konsisten. Suara lama tetap tersimpan di riwayat.',
          confirm: 'Rekam ulang'
        })
        if (!ok) return
      }
      const current = useProject.getState().project
      if (!current || current.id !== id) return
      const resolved = await resolveRoute(current)
      const fresh = useProject.getState()
      if (!fresh.project || fresh.project.id !== id || contextOf(fresh.project) !== contextOf(current)) return
      if (!resolved.provider) {
        toast('error', resolved.error || 'Hubungkan ElevenLabs atau Gemini TTS di Pengaturan sebelum membuat suara narasi.')
        go({ name: 'settings' })
        return
      }
      if (!resolved.voice || resolved.error) throw new Error(resolved.error || 'Pilih suara narasi terlebih dahulu.')
      if (fresh.project.ttsProvider !== resolved.provider || fresh.project.ttsVoice !== resolved.voice) {
        fresh.updateProject({ ttsProvider: resolved.provider, ttsVoice: resolved.voice })
      }
      await fresh.flush()
      const saved = useProject.getState()
      if (!saved.project || saved.project.id !== id) return
      if (saved.saveState !== 'saved') throw new Error(saved.saveError || 'Perubahan narasi belum tersimpan. Simpan proyek lalu coba lagi.')
      if (saved.project.ttsProvider !== resolved.provider || saved.project.ttsVoice !== resolved.voice) throw new Error('Pilihan suara berubah. Coba buat narasi lagi.')
      if (!saved.clips.some((clip) => clip.narration.trim())) throw new Error('Isi naskah narasi terlebih dahulu.')
      const nextJob = await window.api.generate.narration(id, 'all')
      if (useProject.getState().project?.id === id) useProject.getState().upsertJob(nextJob)
    } catch (error) {
      toast('error', errorText(error))
    } finally {
      starting.delete(id)
      if (useVoiceRoute.getState().busyProjectId === id) useVoiceRoute.setState({ busyProjectId: null })
    }
  }

  const chooseProvider = async (provider: TtsProvider): Promise<void> => {
    const current = useProject.getState().project
    if (!current || starting.has(current.id) || useVoiceRoute.getState().checking) return
    starting.add(current.id)
    useVoiceRoute.setState({ busyProjectId: current.id })
    try {
      const resolved = await resolveRoute(current, provider)
      const fresh = useProject.getState()
      if (!fresh.project || contextOf(fresh.project) !== contextOf(current)) return
      if (resolved.provider !== provider) throw new Error(ttsReadiness(resolved.keys)[provider].reason || 'Layanan suara belum tersambung.')
      if (!resolved.voice || resolved.error) throw new Error(resolved.error || 'Belum ada suara yang tersedia.')
      fresh.updateProject({ ttsProvider: provider, ttsVoice: resolved.voice })
      useVoiceRoute.setState({ route: { ...resolved, context: contextOf(useProject.getState().project!) } })
    } catch (error) { toast('error', errorText(error)) }
    finally {
      starting.delete(current.id)
      if (useVoiceRoute.getState().busyProjectId === current.id) useVoiceRoute.setState({ busyProjectId: null })
    }
  }

  const chooseVoice = (voice: string): void => {
    const current = useProject.getState()
    if (!current.project || !route?.provider || running || routing.checking || !route.voices.some((option) => option.id === voice)) return
    current.updateProject({ ttsProvider: route.provider, ttsVoice: voice })
    useVoiceRoute.setState({ route: { ...route, voice, context: contextOf(useProject.getState().project!) } })
  }
  const refresh = async (): Promise<void> => {
    const current = useProject.getState().project
    if (!current || running || routing.checking) return
    try { await resolveRoute(current) } catch (error) { toast('error', errorText(error)) }
  }
  const adoptAddedVoice = async (voice: VoiceOption): Promise<void> => {
    const current = useProject.getState().project
    if (!current || (current.ttsProvider !== 'elevenlabs' && route?.provider !== 'elevenlabs') || running || routing.checking || starting.has(current.id)) return
    starting.add(current.id)
    useVoiceRoute.setState({ busyProjectId: current.id })
    try {
      const resolved = await resolveRoute(current, 'elevenlabs')
      const fresh = useProject.getState()
      if (!fresh.project || contextOf(fresh.project) !== contextOf(current)) return
      if (resolved.provider !== 'elevenlabs' || !voice.id || voice.source !== 'account') {
        throw new Error('Koneksi ElevenLabs berubah. Suara sudah tersimpan di akun; periksa koneksi sebelum menggunakannya.')
      }
      fresh.updateProject({ ttsProvider: 'elevenlabs', ttsVoice: voice.id })
      const voices = resolved.voices.some(item => item.id === voice.id) ? resolved.voices : [...resolved.voices, voice]
      useVoiceRoute.setState({ route: { ...resolved, voices, voice: voice.id, error: null, context: contextOf(useProject.getState().project!) } })
    } finally {
      starting.delete(current.id)
      if (useVoiceRoute.getState().busyProjectId === current.id) useVoiceRoute.setState({ busyProjectId: null })
    }
  }
  const voiceName = route?.provider === 'gemini' ? geminiVoiceName(route.voice)
    : route?.voices.find((voice) => voice.id === route.voice)?.name || (route?.voice ? 'Suara tersimpan' : 'Pilih suara')

  return {
    running,
    checking: routing.checking,
    progress: job?.progress ?? 0,
    message: isRunning(job) ? job?.message ?? null : running ? 'Menyiapkan suara' : null,
    stale: clips.filter(outdated).length,
    isStale: outdated,
    voiced,
    provider: route?.provider ?? null,
    providerName: route?.provider ? TTS_NAMES[route.provider] : 'Belum tersambung',
    voice: route?.voice ?? '',
    voiceName,
    voices: route?.voices ?? [],
    readiness: ttsReadiness(route?.keys ?? []),
    routeError: route?.error ?? null,
    fallback: !!route?.provider && route.provider !== project?.ttsProvider,
    start,
    chooseProvider,
    chooseVoice,
    refresh,
    adoptAddedVoice,
    language: project?.language ?? 'id'
  }
}

export type NarrationControls = ReturnType<typeof useNarration>
