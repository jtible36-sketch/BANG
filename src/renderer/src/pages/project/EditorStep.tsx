import { useEffect, useState } from 'react'
import { cx } from '../../components/ui'
import { useProject } from '../../store/project'
import { useOverlayUi, usePlayback, usePlaybackEngine, useSfxUi, useTimeline } from './editor/engine'
import { INSPECTOR_TABS, Inspector, type InspectorTab } from './editor/Inspector'
import { Player } from './editor/Player'
import { Timeline } from './editor/Timeline'
import { CUTOUT_FACT_STYLE_ID } from '@shared/cutout-facts'

export function EditorStep() {
  const { project, assets, selectedClipId, select, clips } = useProject()
  const { items, total, chunks } = useTimeline()
  const [tab, setTab] = useState<InspectorTab>('klip')
  const selectedOverlayId = useOverlayUi((s) => s.selectedId)
  const selectOverlay = useOverlayUi((s) => s.select)
  const selectedSfxId = useSfxUi(s => s.selectedId)
  const selectSfx = useSfxUi(s => s.select)
  const music = project?.editor.musicAssetId ? (assets[project.editor.musicAssetId] ?? null) : null
  usePlaybackEngine(items, total, music, project?.editor.musicVolumeDb ?? -18, project?.editor.duckMusic ?? true, project?.editor.sfx, assets)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target instanceof HTMLElement ? e.target : null
      const control = target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="textbox"], [role="combobox"]')
      if (e.code === 'Space' && !e.defaultPrevented && !control) {
        e.preventDefault()
        const s = usePlayback.getState()
        if (!s.playing && s.t >= total - 0.05) s.seek(0)
        s.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  if (!project) return null
  const selIndex = clips.findIndex((c) => c.id === selectedClipId)
  const sel = selIndex >= 0 ? clips[selIndex] : null

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_330px]">
      <div className="grid min-h-0 grid-cols-[84px_minmax(0,1fr)_360px]">
        <nav aria-label="Panel editor" className="scroll-thin flex flex-col items-center gap-1 overflow-y-auto border-r border-line bg-surface py-3">
          {INSPECTOR_TABS.filter(t => t.id !== 'cutout' || project.styleId === CUTOUT_FACT_STYLE_ID || clips.some(clip => clip.cutout != null)).map((t) => {
            const Icon = t.icon
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTab(t.id)
                  if (t.id === 'cutout' && selectedClipId) {
                    const selected = items.find(item => item.clip.id === selectedClipId)
                    const playback = usePlayback.getState()
                    playback.pause()
                    if (selected && (playback.t < selected.start || playback.t >= selected.end)) playback.seek(selected.start)
                  }
                }}
                className={cx(
                  'flex h-[62px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-xs',
                  on ? 'border-[1.5px] border-ink bg-sun-soft font-semibold text-ink' : 'font-medium text-ink-2 hover:bg-sand'
                )}
              >
                <Icon className="size-5" />
                {t.label}
              </button>
            )
          })}
        </nav>
        <Player
          items={items}
          total={total}
          chunks={chunks}
          aspect={project.aspectRatio}
          editor={project.editor}
          assets={assets}
          editOverlays={tab === 'overlay'}
          editCutout={tab === 'cutout'}
        />
        <Inspector tab={tab} clip={sel} index={selIndex} total={total} />
      </div>
      <Timeline
        items={items}
        chunks={project.editor.captionStyle === 'none' ? [] : chunks}
        music={music}
        total={total}
        selectedId={selectedClipId}
        onSelect={(id) => {
          select(id)
          setTab((current) => current === 'efek' || current === 'cutout' || current === 'otomatis' ? current : 'klip')
          if (tab === 'cutout') {
            const item = items.find(item => item.clip.id === id)
            usePlayback.getState().pause()
            if (item) usePlayback.getState().seek(item.start)
          }
        }}
        sfx={project.editor.sfx ?? []}
        selectedSfxId={selectedSfxId}
        onSelectSfx={id => { selectSfx(id); setTab('sfx') }}
        overlays={project.editor.overlays ?? []}
        assets={assets}
        selectedOverlayId={selectedOverlayId}
        onSelectOverlay={(id) => {
          selectOverlay(id)
          setTab('overlay')
        }}
      />
    </div>
  )
}
