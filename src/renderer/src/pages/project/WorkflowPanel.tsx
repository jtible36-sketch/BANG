import { useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, CircleDashed, FileText, Layers, ListChecks, SlidersHorizontal } from 'lucide-react'
import { resolveMasterPrompt } from '@shared/master-prompts'
import { needsVisual, wordCount } from '@shared/script'
import { getStyle } from '@shared/styles'
import type { Asset, Clip, Project, Step } from '@shared/types'
import { cx } from '../../components/ui'
import { mmss } from '../../lib/format'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'

export interface ProductionStage {
  id: Step
  label: string
  state: 'empty' | 'partial' | 'ready' | 'review'
  detail: string
}

/** Describes what is actually present, without implying approval or completed media generation. */
export function productionStages(project: Project, clips: Clip[], assets: Record<string, Asset>): ProductionStage[] {
  const total = clips.length
  const written = clips.filter((clip) => clip.narration.trim()).length
  const planned = clips.filter((clip) => !needsVisual(clip)).length
  const media = clips.filter((clip) => clip.motionType === 'video'
    ? !!clip.videoAssetId && assets[clip.videoAssetId]?.kind === 'video'
    : !!clip.imageAssetId && assets[clip.imageAssetId]?.kind === 'image').length
  const voiced = clips.filter((clip) => !!clip.audioAssetId && assets[clip.audioAssetId]?.kind === 'audio'
    && (assets[clip.audioAssetId].prompt ?? '').trim() === clip.narration.trim()).length
  const profile = resolveMasterPrompt(project)
  const target = profile?.timing.wordsPerSecond ? Math.round(profile.timing.wordsPerSecond * project.durationSec) : null
  const words = clips.reduce((n, clip) => n + wordCount(clip.narration), 0)
  const wordReview = target !== null && (words < Math.ceil(target * 0.95) || words > Math.floor(target * 1.05))
  return [
    { id: 1, label: 'Brief', state: project.synopsis.trim() ? 'ready' : 'empty', detail: project.synopsis.trim() ? `${project.aspectRatio} · ${project.durationSec} detik` : 'Isi topik dan arah cerita' },
    { id: 2, label: 'Naskah', state: !total ? 'empty' : written < total ? 'partial' : wordReview ? 'review' : 'ready', detail: !total ? 'Belum ada adegan' : `${written}/${total} narasi · ${words} kata${wordReview ? ', tinjau durasi' : ''}` },
    { id: 3, label: 'Visual', state: !total || !planned ? 'empty' : planned < total ? 'review' : 'ready', detail: total ? `${planned}/${total} prompt sesuai naskah` : 'Susun dari naskah' },
    { id: 4, label: 'Produksi', state: !total || !media ? 'empty' : planned < total ? 'review' : media === total && voiced >= written ? 'ready' : 'partial', detail: total ? `${media}/${total} media · ${voiced}/${written} suara terkini${planned < total && media ? ', tinjau visual' : ''}` : 'Gambar, video dan suara' }
  ]
}

export function WorkflowPanel() {
  const { project, clips, assets, updateProject, flush } = useProject()
  const { go, toast } = useApp()
  const [expanded, setExpanded] = useState(false)
  if (!project) return null
  const profile = resolveMasterPrompt(project)
  const stages = productionStages(project, clips, assets)
  const style = getStyle(project.styleId)
  const totalMs = clips.reduce((n, clip) => n + clip.durationMs, 0)
  const rules = [
    profile?.timing.wordsPerSecond ? `${profile.timing.wordsPerSecond.toLocaleString('id-ID')} kata/detik` : 'Durasi mengikuti narasi',
    profile?.timing.beatSeconds ? `Beat ±${profile.timing.beatSeconds.toLocaleString('id-ID')} detik` : 'Adegan bebas',
    profile?.lockedCamera ? 'Kamera terkunci' : 'Kamera sesuai adegan',
    profile?.videoMode === 'universal' ? `Prompt video universal${profile.timing.sourceVideoSeconds ? ` · sumber ${profile.timing.sourceVideoSeconds} detik` : ''}` : 'Prompt video per adegan'
  ]
  const viewMaster = async (): Promise<void> => {
    await flush()
    const saved = useProject.getState()
    if (saved.saveState === 'error' || saved.saveState === 'dirty') {
      toast('error', saved.saveError || 'Perubahan proyek belum tersimpan. Coba simpan lagi sebelum membuka aturan.')
      return
    }
    go({ name: 'masters', back: { name: 'project', id: project.id } })
  }
  return <section data-production-workflow className="shrink-0 border-b border-line bg-paper">
    <div className="flex items-center gap-4 px-6 py-2.5">
      <button type="button" aria-expanded={expanded} aria-controls="production-rules" onClick={() => setExpanded(!expanded)} className="flex min-w-0 max-w-[250px] items-center gap-2 text-left">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-line-2 bg-surface"><ListChecks className="size-4 text-accent-dark" /></span>
        <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Aturan produksi</span><span className="block truncate text-[12px] font-semibold">{profile?.name ?? 'Gaya pilihanmu'}{profile ? <span className="ml-1.5 font-mono text-[10px] text-muted">v{profile.version}</span> : null}</span></span>
        <ChevronDown className={cx('size-3.5 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
      </button>
      <span className="h-7 w-px shrink-0 bg-line" />
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-2">
        {stages.map((stage) => <button key={stage.id} type="button" title={stage.detail} onClick={() => updateProject({ step: stage.id })} aria-current={project.step === stage.id ? 'step' : undefined} className={cx('flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left', project.step === stage.id ? 'bg-surface ring-1 ring-line-2' : 'hover:bg-surface')}>
          <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]', stage.state === 'ready' ? 'bg-ok-soft text-ok-ink' : stage.state === 'review' ? 'bg-sun-soft text-sun-ink' : 'bg-sand text-muted')}>{stage.state === 'ready' ? <Check className="size-3" /> : stage.state === 'review' ? '!' : <CircleDashed className="size-3" />}</span>
          <span className="min-w-0"><span className="block text-[11px] font-semibold">{stage.label}</span><span className="block truncate text-[10px] text-muted">{stage.detail}</span></span>
        </button>)}
      </div>
    </div>
    {expanded && <div id="production-rules" className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-line px-6 py-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-2">{profile?.description || 'Gaya visual dan skill proyek menentukan arahan setiap tahap. Kamu tetap bisa mengubah naskah dan susunan adegan.'}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted"><span className="inline-flex items-center gap-1"><Layers className="size-3" />{style.name}</span><span className="inline-flex items-center gap-1"><FileText className="size-3" />{clips.length} adegan · ±{mmss(totalMs)}</span>{rules.map((rule) => <span key={rule}>{rule}</span>)}</div>
        <p className="mt-2 text-[10px] text-muted">Status menunjukkan isi yang tersedia, bukan persetujuan atau hasil render. {project.masterPrompt ? 'Master proyek memakai salinan versinya sendiri.' : 'Mode otomatis mengikuti skill dan gaya yang dipilih.'}</p>
      </div>
      <button type="button" onClick={() => void viewMaster()} className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-line-2 bg-surface px-3 text-xs font-semibold hover:border-ink-2"><SlidersHorizontal className="size-3.5" />Lihat aturan<ArrowUpRight className="size-3" /></button>
    </div>}
  </section>
}
