import { Blend, ChevronsLeft, Copy, Maximize2, Move, Play, Scissors } from 'lucide-react'
import { isVoxMaster, resolveMasterPrompt } from '@shared/master-prompts'
import { CAMERA_PRESETS, MOTION_STRENGTHS, TRANSITIONS, TRANSITION_SEC } from '@shared/motion'
import type { Clip, TransitionId } from '@shared/types'
import { Select } from '../../../components/Select'
import { Button, cx } from '../../../components/ui'
import { clipNumber } from '../../../lib/format'
import { useApp } from '../../../store/app'
import { useProject } from '../../../store/project'
import { usePlayback } from './engine'

const TRANSITION_ICONS: Record<TransitionId, typeof Blend> = { fade: Blend, slideleft: ChevronsLeft, zoomin: Maximize2, cut: Scissors }
const TRANSITION_NOTES: Record<TransitionId, string> = {
  fade: 'Pergantian waktu yang lembut',
  slideleft: 'Geser menuju adegan berikutnya',
  zoomin: 'Tekankan perubahan atau momen penting',
  cut: 'Potong langsung tanpa efek'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3 border-b border-line px-[18px] py-4"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>
}

/** These controls use the same saved clip fields as the preview and MP4 exporter. */
export function EffectsPanel({ clip, index }: { clip: Clip | null; index: number }) {
  const { project, clips, updateClip, select } = useProject()
  const { toast } = useApp()
  if (!project) return null
  const vox = isVoxMaster(project)
  const locked = resolveMasterPrompt(project)?.lockedCamera ?? false
  const joints = clips.slice(0, -1)
  const next = clip && index >= 0 ? clips[index + 1] : null
  const currentTransition = vox ? 'cut' : clip?.transition ?? 'cut'
  const allSame = joints.every((joint) => joint.transition === currentTransition)
  const cameras = clips.filter((item) => item.motionType === 'camera')
  const preview = (): void => {
    if (!clip || !next) return
    const boundary = clips.slice(0, index + 1).reduce((sum, item) => sum + item.durationMs / 1000, 0)
    const playback = usePlayback.getState()
    playback.seek(Math.max(0, boundary - 0.65))
    playback.play()
  }

  return (
    <>
      <Section title="Transisi antaradegan">
        <p className="text-[13px] leading-relaxed text-ink-2">Pilih sambungan, lalu lihat hasilnya di pratinjau. Efek ini ikut tersimpan dalam video ekspor.</p>
        {joints.length ? <Select
          label="Sambungan"
          size="sm"
          value={next ? clip!.id : ''}
          onChange={select}
          options={[{ value: '', label: 'Pilih sambungan', disabled: true }, ...joints.map((joint, i) => ({ value: joint.id, label: `${clipNumber(i)} ${joint.title} → ${clips[i + 1].title}` }))]}
        /> : <p className="rounded-xl bg-sand p-3 text-[13px] text-muted">Tambahkan sedikitnya dua adegan untuk memakai transisi.</p>}
        {vox && <p className="rounded-xl bg-sun-soft p-3 text-[13px] leading-relaxed text-sun-ink">Master VOX memakai potong langsung agar ritme kolasenya tetap terjaga.</p>}
        {next && clip && <>
          <div className="grid grid-cols-2 gap-2">
            {TRANSITIONS.map((transition) => {
              const Icon = TRANSITION_ICONS[transition.id]
              const selected = transition.id === currentTransition
              return <button
                key={transition.id}
                type="button"
                aria-pressed={selected}
                disabled={vox}
                onClick={() => updateClip(clip.id, { transition: transition.id })}
                className={cx('flex min-h-[100px] flex-col items-start gap-1.5 rounded-xl border p-3 text-left disabled:cursor-not-allowed', selected ? 'border-ink bg-sun-soft' : 'border-line-2 bg-surface enabled:hover:border-ink-2', vox && !selected && 'opacity-40')}
              >
                <Icon className="size-5" />
                <span className="text-[13px] font-semibold">{transition.label}</span>
                <span className="text-xs leading-relaxed text-muted">{TRANSITION_NOTES[transition.id]}</span>
              </button>
            })}
          </div>
          <span className="text-xs text-muted">{currentTransition === 'cut' ? 'Tanpa tumpang tindih.' : `Lama efek ${TRANSITION_SEC.toLocaleString('id-ID')} detik. Durasi narasi tetap utuh.`}</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Play className="size-4" />} onClick={preview}>Pratinjau sambungan</Button>
            <Button size="sm" icon={<Copy className="size-4" />} disabled={vox || allSame} onClick={() => {
              joints.forEach((joint) => { if (joint.transition !== currentTransition) updateClip(joint.id, { transition: currentTransition }) })
              toast('success', `Transisi diterapkan ke ${joints.length} sambungan.`)
            }}>Terapkan ke semua</Button>
          </div>
        </>}
        {!next && joints.length > 0 && <p className="text-[13px] text-muted">Adegan terakhir tidak mempunyai sambungan keluar. Pilih sambungan di atas.</p>}
      </Section>
      <Section title="Gerak gambar">
        {locked ? <p className="rounded-xl bg-sand p-3 text-[13px] leading-relaxed text-ink-2">Kamera terkunci oleh master. Gerak di dalam adegan memakai video yang diimpor dari storyboard.</p> : clip?.motionType === 'camera' ? <>
          <Select label="Gerak kamera" size="sm" value={clip.cameraPreset} onChange={(value) => updateClip(clip.id, { cameraPreset: value })} options={CAMERA_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} />
          <Select label="Kekuatan gerak" size="sm" value={clip.motionStrength} onChange={(value) => updateClip(clip.id, { motionStrength: value })} options={MOTION_STRENGTHS.map((strength) => ({ value: strength.id, label: strength.label }))} />
          <Button size="sm" className="self-start" icon={<Move className="size-4" />} disabled={cameras.every((item) => item.cameraPreset === clip.cameraPreset && item.motionStrength === clip.motionStrength)} onClick={() => {
            cameras.forEach((item) => updateClip(item.id, { cameraPreset: clip.cameraPreset, motionStrength: clip.motionStrength }))
            toast('success', `Gerak diterapkan ke ${cameras.length} adegan gambar.`)
          }}>Pakai untuk semua gambar</Button>
          <p className="text-xs leading-relaxed text-muted">Adegan yang memakai video tetap mengikuti gerak video aslinya.</p>
        </> : <p className="text-[13px] leading-relaxed text-muted">Pilih adegan gambar di timeline untuk mengatur gerak kamera.</p>}
      </Section>
    </>
  )
}
