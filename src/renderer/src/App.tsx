import { useEffect } from 'react'
import { ConfirmHost } from './components/ui'
import { Toasts } from './components/Toasts'
import { Home } from './pages/Home'
import { ProjectPage } from './pages/project/ProjectPage'
import { Settings } from './pages/Settings'
import { TopicResearch } from './pages/TopicResearch'
import { MasterPrompts } from './pages/MasterPrompts'
import { useApp } from './store/app'
import { useProject } from './store/project'
import { subscribeToTheme } from './lib/theme'

const KIND_LABEL: Record<string, string> = {
  image: 'Gambar',
  sheet: 'Lembar karakter',
  video: 'Video AI',
  tts: 'Suara',
  narration: 'Narasi',
  export: 'Ekspor',
  'auto-edit': 'Edit otomatis',
  'cutout-plan': 'Rencana aset', 'cutout-asset': 'Aset Cutout'
}

export function App() {
  const route = useApp((s) => s.route)
  useEffect(subscribeToTheme, [])

  useEffect(() => {
    const p = useProject.getState
    const offs = [
      window.api.on.editorAutomation((event) => {
        if (p().project?.id !== event.projectId) return
        if (p().saveState === 'saved') { p().load(event.bundle); useApp.getState().toast('success', event.summary) }
        else useApp.getState().toast('error', 'Proyek diperbarui melalui Codex/MCP. Edit lokal belum dimuat ulang.', { label: 'Muat hasil terbaru', run: () => { void window.api.projects.get(event.projectId).then(b => { if (p().project?.id === event.projectId) p().load(b) }).catch(error => useApp.getState().toast('error', String(error))) } })
      }),
      window.api.on.job((job) => {
        p().upsertJob(job)
        const { toast } = useApp.getState()
        if (job.status === 'failed' && job.error) toast('error', `${KIND_LABEL[job.kind] ?? 'Proses'} gagal: ${job.error}`)
        if (job.status === 'done' && job.kind === 'export' && job.message) {
          const path = job.message
          toast('success', 'Video selesai diekspor.', { label: 'Buka folder', run: () => void window.api.exporter.reveal(path) })
        }
      }),
      window.api.on.clip((e) => p().applyClip(e.clipId, e.patch)),
      window.api.on.character((e) => p().applyCharacter(e.characterId, e.patch)),
      window.api.on.asset((a) => p().addAsset(a))
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useEffect(() => {
    const publish = (nonce?: string): void => {
      const s = useProject.getState()
      void window.api.editorAutomation.presence({ projectId: s.project?.id ?? null, saveState: s.saveState, ...(nonce?{nonce}:{}) }).catch(() => {})
    }
    publish()
    const off = useProject.subscribe((state, previous) => { if (state.project?.id !== previous.project?.id || state.saveState !== previous.saveState) publish() })
    const query=window.api.on.editorPresenceRequest(({nonce})=>publish(nonce))
    const wake=():void=>publish()
    window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake)
    const timer = setInterval(publish, 5000)
    return () => { off();query();clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake) }
  }, [])

  // Finish any pending save before the window closes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      const s = useProject.getState()
      if (s.saveState === 'dirty' || s.saveState === 'saving') {
        e.preventDefault()
        e.returnValue = ''
        void s.flush().then(() => window.close())
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return (
    <>
      {route.name === 'home' && <Home />}
      {route.name === 'research' && <TopicResearch />}
      {route.name === 'masters' && <MasterPrompts back={route.back} />}
      {route.name === 'settings' && <Settings />}
      {route.name === 'project' && <ProjectPage key={route.id} id={route.id} />}
      <Toasts />
      <ConfirmHost />
    </>
  )
}
