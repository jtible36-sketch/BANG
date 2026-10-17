import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { create } from 'zustand'
import { cutoutAssetIds, evaluateCutoutScene, type CutoutScene } from '@shared/cutout-timeline'
import { cutoutMaskSvg } from '@shared/cutout-mask'
import type { Asset } from '@shared/types'
import { useProject } from '../../../store/project'

export const useCutoutUi = create<{
  clipId: string | null
  layerId: string | null
  select: (clipId: string, layerId: string | null) => void
}>((set) => ({ clipId: null, layerId: null, select: (clipId, layerId) => set({ clipId, layerId }) }))

/** Preview and export both use the shared matrix evaluator, including parent transforms. */
export function CutoutFrame({ scene, clipId, timeMs, width, height, assets, editable = false }: {
  scene: CutoutScene
  clipId: string
  timeMs: number
  width: number
  height: number
  assets: Record<string, Asset>
  editable?: boolean
}) {
  const selection = useCutoutUi()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const [decoded, setDecoded] = useState<Record<string, { url: string; width: number; height: number }>>({})
  const assetIds = useMemo(() => cutoutAssetIds(scene), [scene])
  useEffect(() => {
    let disposed = false
    for (const id of assetIds) {
      const asset = assets[id]
      if (!asset || (asset.meta.cutoutAsset && asset.width && asset.height) || decoded[id]?.url === asset.url) continue
      const image = new Image()
      image.onload = () => {
        if (!disposed && image.naturalWidth && image.naturalHeight) setDecoded(current => ({ ...current, [id]: { url: asset.url, width: image.naturalWidth, height: image.naturalHeight } }))
      }
      image.onerror = () => { if (!disposed) setFailedUrls(urls => urls.includes(asset.url) ? urls : [...urls, asset.url]) }
      image.src = asset.url
    }
    return () => { disposed = true }
  }, [assetIds, assets, decoded])
  const sizes = useMemo(() => Object.fromEntries(assetIds.map(id => [id, decoded[id]?.url === assets[id]?.url ? decoded[id] : assets[id] ?? { width: null, height: null }])), [assetIds, assets, decoded])
  const evaluated = useMemo(() => {
    try { return { items: evaluateCutoutScene(scene, timeMs, width, height, sizes), error: null } }
    catch (error) { return { items: [], error: error instanceof Error ? error.message : String(error) } }
  }, [scene, timeMs, width, height, sizes])
  const missing = evaluated.items.filter(item => !assets[item.assetId] || failedUrls.includes(assets[item.assetId]?.url))

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: scene.backgroundColor }} data-cutout-frame={clipId}>
      {evaluated.items.map(item => {
        const asset = assets[item.assetId]
        if (!asset) return null
        const selected = editable && selection.clipId === clipId && selection.layerId === item.layerId
        const style: CSSProperties = {
          position: 'absolute', left: 0, top: 0, width: item.width, height: item.height, maxWidth: 'none',
          transformOrigin: '0 0', transform: `matrix(${item.matrix.join(',')})`, opacity: item.opacity,
          outline: selected ? '2px solid #F5C642' : undefined, outlineOffset: selected ? 2 : undefined,
          pointerEvents: editable ? 'auto' : 'none',
          ...(item.mask ? { maskImage: `url("data:image/svg+xml,${encodeURIComponent(cutoutMaskSvg(item.mask, item.width / item.height))}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat' } : {})
        }
        return <img
          key={item.layerId} src={asset.url} alt={scene.layers.find(layer => layer.id === item.layerId)?.name ?? ''}
          draggable={false} style={style} data-cutout-layer={item.layerId}
          role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
          className={editable ? 'cursor-pointer select-none' : 'select-none'}
          onError={() => setFailedUrls(urls => urls.includes(asset.url) ? urls : [...urls, asset.url])}
          onClick={editable ? event => { event.stopPropagation(); useProject.getState().select(clipId); selection.select(clipId, item.layerId) } : undefined}
          onKeyDown={editable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); useProject.getState().select(clipId); selection.select(clipId, item.layerId) } } : undefined}
        />
      })}
      {(evaluated.error || missing.length > 0) && <div role="alert" className="pointer-events-none absolute inset-x-2 bottom-2 rounded bg-red-950/90 p-2 text-center text-xs text-white">
        {evaluated.error ?? `${missing.length} gambar layer tidak tersedia. Pilih ulang aset di panel Cutout.`}
      </div>}
      {editable && scene.layers.length === 0 && <div className="pointer-events-none flex size-full items-center justify-center p-6 text-center text-sm text-white/80">Tambahkan gambar atau rig melalui panel Cutout.</div>}
    </div>
  )
}
