import {scheduledItem} from '@shared/cutout-plan-diagnostics'
import {requireAssetConsent} from './cutout-studio'
import type { CutoutVisualBatchInput } from '@shared/cutout-visual'
import { generatedForItem } from '@shared/cutout-production'
import { backgroundReuseKey, reusableCutoutBackground, cutoutAssetState, cutoutProviderStatus, generateCutoutAsset } from './cutout-assets'
import { getBundle, insertJob } from './repo'
import { runJob } from './jobs'
import { waitChild } from './cutout-auto-production'

/** A durable coordinator; repeat after interruption resumes only unfinished items. */
export function generateVisualCutoutBatch(input: CutoutVisualBatchInput) {
  if (!input || !Array.isArray(input.clipIds) || !input.clipIds.length || input.clipIds.length > 500 || new Set(input.clipIds).size !== input.clipIds.length
    || !['codex','flow-mcp'].includes(input.provider) || !['png','webp'].includes(input.format)
    || !Number.isInteger(input.maxNewAssets) || input.maxNewAssets < 1 || input.maxNewAssets > 2048) throw new Error('Pilihan antrean aset Visual tidak valid.')
  const bundle = getBundle(input.projectId)
  if (input.clipIds.some(id => !bundle.clips.some(c => c.id === id))) throw new Error('Klip bukan bagian proyek ini.')
  const running = bundle.jobs.find(j => ['cutout-batch','auto-edit'].includes(j.kind) && ['queued','running'].includes(j.status))
  if (running) throw new Error('Tunggu atau batalkan antrean aset/edit otomatis yang sedang berjalan.')
  const plans = input.clipIds.map(id => {
    const state = cutoutAssetState(id)
    if (!state.plan || state.stale) throw new Error('Susun kebutuhan terbaru untuk setiap adegan yang dipilih sebelum generate.')
    return state.plan
  })
  const missing = plans.flatMap(plan => plan.items.filter(item => scheduledItem(item)&&!generatedForItem(bundle.assets, plan, item.id)).map(item => ({plan,item})))
  for(const {plan,item} of missing)requireAssetConsent(plan.clipId,plan.id,item.id)
  const backgrounds = new Set<string>()
  const submissions = missing.filter(({plan,item}) => {
    const key = backgroundReuseKey(plan.clipId,item)
    if (!key) return true
    if (reusableCutoutBackground(plan.clipId,item) || backgrounds.has(key)) return false
    backgrounds.add(key); return true
  }).length
  if (submissions > input.maxNewAssets) throw new Error(`Perlu ${submissions} gambar baru, melebihi batas proses ${input.maxNewAssets}. Naikkan batas atau pilih lebih sedikit adegan. Belum ada gambar dikirim.`)
  const job = insertJob({projectId:input.projectId,kind:'cutout-batch',provider:input.provider})
  return runJob(job,'automation',async ctx => {
    const failures: string[] = []; let finished = 0
    if (missing.length) { const status = await cutoutProviderStatus(input.provider); if (!status.ready) throw new Error(status.message) }
    for (let i=0;i<missing.length;i++) {
      ctx.signal.throwIfAborted()
      const {plan,item} = missing[i], current = cutoutAssetState(plan.clipId)
      if (current.stale || current.plan?.id !== plan.id) throw new Error('Narasi atau paket aset berubah. Aset selesai tersimpan; tinjau paket terbaru sebelum melanjutkan.')
      if (generatedForItem(getBundle(input.projectId).assets,plan,item.id)) { finished++; continue }
      ctx.progress(i/Math.max(1,missing.length),`Aset ${i+1}/${missing.length} · ${bundle.clips.find(c=>c.id===plan.clipId)?.title}: ${item.label}`)
      try {
        await waitChild(generateCutoutAsset({clipId:plan.clipId,planId:plan.id,itemId:item.id,provider:input.provider,format:input.format}).id,ctx.signal)
        finished++
      } catch (error) {
        ctx.signal.throwIfAborted()
        failures.push(`${item.label}: ${error instanceof Error?error.message:String(error)}`)
      }
    }
    if (failures.length) throw new Error(`${finished}/${missing.length} aset selesai; ${failures.length} gagal. Klik Generate aset yang kurang untuk melanjutkan.\n${failures.join('\n')}`)
    return {message:missing.length?`${finished} aset selesai. Tinjau alpha, identitas dan pose, lalu lanjut Produksi.`:'Semua aset sudah tersedia; tidak ada gambar baru dikirim.'}
  })
}
