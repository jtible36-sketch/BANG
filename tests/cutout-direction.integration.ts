// Legacy free-scene regressions. The new default shot contract has its own eight-clip suite.
import assert from 'node:assert/strict'
import { app, nativeImage } from 'electron'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { closeDb, getDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, getJob, insertAsset, patchClip } from '../src/main/repo'
import { getEditingContext, startCodexAutoEdit as startAgentComposer, resumeCodexAutoEdit } from '../src/main/editor-automation'
import { projectDir } from '../src/main/paths'
import { cutoutAssetState } from '../src/main/cutout-assets'
import { builtInMasterPrompts, masterStageDirection, resolveMasterPrompt } from '../src/shared/master-prompts'
import { CUTOUT_FACT_DIRECTION, CUTOUT_FACT_SOURCE } from '../src/shared/cutout-facts'
import { cutoutRuntimeStage } from '../src/shared/cutout-reference-profile'
import { createCutoutScene, createCutoutLayer, cutoutAssetIds, cutoutCameraAt, cutoutTransformAt } from '../src/shared/cutout-timeline'
import { DEFAULT_CUTOUT_PRODUCTION, bakeCutoutFrames } from '../src/shared/cutout-production'
import { cutoutIkAt } from '../src/shared/cutout-ik'
import { DEFAULT_SPECIAL_CLIPS } from '../src/shared/special-clips'

const root = resolve(process.argv[2]), g = globalThis as any, checks: string[] = []
mkdirSync(root, { recursive: true })
app.setPath('userData', join(root, 'isolated-user-data'))
app.commandLine.appendSwitch('disable-gpu')
app.on('window-all-closed', () => {})

async function check(name: string, run: () => unknown | Promise<unknown>): Promise<void> {
  console.log('CHECK', name)
  await run()
  checks.push(name)
  console.log('PASS', name)
}
async function done(id: string) {
  const until = Date.now() + 60000
  while (Date.now() < until) {
    const job = getJob(id)!
    if (['done', 'failed', 'canceled'].includes(job.status)) return job
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw Error('Fixture job timed out: ' + id)
}
function png(transparent = false): Buffer {
  const bytes = Buffer.alloc(90 * 160 * 4)
  for (let y = 0; y < 160; y++) for (let x = 0; x < 90; x++) {
    const i = (y * 90 + x) * 4
    bytes[i] = 40; bytes[i + 1] = transparent ? 190 : 70; bytes[i + 2] = 190
    bytes[i + 3] = transparent && (x < 10 || x > 79 || y < 10 || y > 149) ? 0 : 255
  }
  return nativeImage.createFromBitmap(bytes, { width: 90, height: 160 }).toPNG()
}
const current = builtInMasterPrompts.find(profile => profile.id === 'builtin:cutout-facts')!
// An authored old snapshot deliberately has distinguishable source/stage content.
const old = { ...structuredClone(current), version: 2, sourceText: 'Saved original v2 instructions.', stages: { ...current.stages, script: 'Saved v2 script.', visual: 'Saved v2 visual.', video: 'Saved v2 video.', voice: 'Saved v2 voice.' } }
function project(count = 1) {
  const p = createProject({ durationSec: 60, styleId: 'cutout-facts', skillId: 'animasi-cutout', masterPrompt: old, synopsis: 'Pintu troli berengsel membuka ketika troli bersarang.' })
  replaceScript(p.id, 'Fixture', Array.from({ length: count }, (_, index) => ({
    title: 'Aksi ' + (index + 1), story: 'Arthur menunjuk pintu troli, lalu menahan pose.', narration: 'Arthur menunjuk pintu troli.', durationMs: 2000
  })))
  for (const clip of getBundle(p.id).clips) patchClip(clip.id, { transition: 'fade' })
  return { id: p.id, clipId: getBundle(p.id).clips[0].id }
}
const production = { ...DEFAULT_CUTOUT_PRODUCTION,beatTemplate:false, maxAssetsPerClip: 12, maxNewAssets: 24, motion: 'keyframes' as const }
function direction(items: { id: string }[]) {
  return { timing: 'provisional', shots: [{
    startMs: 0, endMs: 2000, narrationCue: 'Arthur menunjuk pintu troli.', action: 'menunjuk lalu menahan pose',
    location: 'Toko di Kansas City tahun 1947', focus: 'pintu troli', startPose: 'menunjuk pintu', endPose: 'menahan pose menunjuk',
    reaction: 'penasaran', camera: 'medium', occlusion: 'tidak diperlukan', contact: 'tidak diperlukan', sfxCue: 'tidak diperlukan', assetIds: items.map(item => item.id)
  }], specialAssets: [] }
}
function planner(state: { plans: number; reviews: number; approved: boolean }) {
  return async (options: any) => {
    if (options.schema?.properties?.approved) {
      state.reviews++
      assert(options.images.length >= 3)
      assert(options.images.every((file: string) => existsSync(file)))
      return state.approved ? { approved: true, problems: [], missingAssets: [] }
        : { approved: false, problems: ['The supplied pose does not communicate the narrated pointing action.'], missingAssets: ['Pose menunjuk pintu yang sesuai narasi'] }
    }
    if (options.schema?.properties?.items) {
      state.plans++
      const items = [
        { id: 'bg', role: 'background', layerKey: 'bg', label: 'Toko kosong 1947', prompt: 'A 1947 shop without any person or shopping cart.', characterId: null, timeMs: 0 },
        { id: 'actor', role: 'character', layerKey: 'actor', label: 'Arthur menunjuk', prompt: 'The approved Arthur character pointing at a cart gate. Isolated real alpha.', characterId: null, timeMs: 0 },
        { id: 'cart', role: 'prop', layerKey: 'cart', label: 'Troli 1947', prompt: 'A 1947 two-basket shopping cart. Isolated real alpha.', characterId: null, timeMs: 0 },
        { id: 'reaction', role: 'pose', layerKey: 'actor', label: 'Arthur penasaran', prompt: 'The same Arthur identity holds the pointing pose with one curious reaction. Isolated real alpha.', characterId: null, timeMs: 1000 }
      ]
      return { items, director: direction(items) }
    }
    if (options.schema?.properties?.shots) {
      const payload = JSON.parse(options.prompt)
      return direction(payload.items)
    }
    const payload = JSON.parse(options.prompt)
    assert(payload.seedComposition)
    return { summary: 'Arthur menunjuk dan menahan pose. SFX pop belum tersedia; tidak ada audio baru yang diklaim dibuat.', clips: [{
      clipId: payload.scope.clipId, cutout: payload.seedComposition, transition: null, durationMs: null
    }], editor: null }
  }
}

void app.whenReady().then(async () => {
  await check('frame baking preserves off-grid hard cuts and held contacts at both 30 and 60 fps', () => {
    const scene=createCutoutScene(),layer=createCutoutLayer('actor','Actor','actor')
    layer.keyframes=[{id:'cut',timeMs:987,transform:{...layer.transform,x:.8},easing:'hold'}]
    scene.layers=[layer]
    scene.camera.keyframes=[{id:'cut',timeMs:987,x:.1,y:0,zoom:1.2,easing:'hold'}]
    scene.ik=[{id:'contact',name:'Contact',enabled:true,upperId:'actor',lowerId:'lower',endX:.1,endY:0,targetX:.5,targetY:.5,bend:1,weight:1,keyframes:[{id:'change',timeMs:987,targetX:.8,targetY:.5,weight:1,easing:'hold'}]}]
    for(const fps of [30,60] as const){
      // IK graph validity is tested separately; baking preserves authored tracks.
      const lower=createCutoutLayer('lower','Lower','lower');lower.parentId='actor';lower.transform.x=.1;scene.layers=[layer,lower]
      const baked=bakeCutoutFrames(scene,2000,fps)
      for(const time of [0,980,986.999,987,990,1200,1999]){
        assert.deepEqual(cutoutTransformAt(baked.layers[0],time),cutoutTransformAt(layer,time))
        assert.deepEqual(cutoutCameraAt(baked.camera,time),cutoutCameraAt(scene.camera,time))
        assert.deepEqual(cutoutIkAt(baked.ik![0],time),cutoutIkAt(scene.ik[0],time))
      }
    }
  })
  await check('v5 builtin preserves the user direction and runtime upgrades old snapshots without changing their asset fingerprint', () => {
    assert.equal(current.version, 5)
    assert.equal(current.sourceText, CUTOUT_FACT_SOURCE)
    for (const phrase of ['Dafiology', '3 detik pertama', 'hard cut', 'Sasaran maksimal 2 layer', 'Dilarang memakai kamera shake', 'setiap assetId', 'klip khusus']) {
      assert(CUTOUT_FACT_SOURCE.includes(phrase), 'Source omitted user rule: ' + phrase)
      assert(CUTOUT_FACT_DIRECTION.includes(phrase), 'Production direction omitted user rule: ' + phrase)
    }
    const context = { masterPrompt: old, styleId: 'cutout-facts' }
    const before = JSON.stringify(old)
    for (const stage of ['script', 'visual', 'video', 'voice'] as const) {
      assert(cutoutRuntimeStage(context, stage).includes('Dafiology'), 'Old snapshot lacks v5 ' + stage + ' runtime protocol')
      assert(masterStageDirection(context, stage).includes('Sasaran maksimal 2 layer'), 'Stage did not receive latest motion constraints: ' + stage)
    }
    assert.deepEqual(resolveMasterPrompt(context), old)
    assert.equal(JSON.stringify(old), before)
    const custom = { ...old, id: 'custom:project-direction', sourceText: 'My authored direction.' }
    for (const stage of ['script', 'visual', 'video', 'voice'] as const) {
      assert.equal(cutoutRuntimeStage({ masterPrompt: custom, styleId: 'cutout-facts' }, stage), '')
      assert(!masterStageDirection({ masterPrompt: custom, styleId: 'cutout-facts' }, stage).includes('Dafiology'))
    }
  })
  await check('failed visual review keeps completed PNGs and checkpoint; explicit resume reuses them after SQLite reopen and applies hard cuts', async () => {
    const p = project(), state = { plans: 0, reviews: 0, approved: false }
    let generated = 0
    g.__assetPlan = planner(state)
    g.__assetGenerate = async (options: any) => { generated++; return { bytes: png(!options.prompt.includes('Role: background')) } }
    const before = getBundle(p.id).clips[0]
    // Exhaust the initial four-image budget so this case tests explicit review
    // rejection/resume rather than entering the separate automatic asset repair.
    const first = await done(startCodexAutoEdit({ projectId: p.id, instruction: 'Satu aksi menunjuk; pose ditahan, tanpa shake.', production: { ...production, maxNewAssets: 4 } }).id)
    assert.equal(first.status, 'failed')
    assert.match(first.error ?? '', /tinjauan|visual|pose/i)
    assert.equal(generated, 4)
    assert.equal(getBundle(p.id).clips[0].cutout, null)
    assert.equal(getBundle(p.id).clips[0].transition, before.transition)
    const completedIds = getBundle(p.id).assets.map(asset => asset.id).sort()
    const planId = cutoutAssetState(p.clipId).plan!.id
    closeDb()
    state.approved = true
    const retry = await done(resumeCodexAutoEdit(p.id, first.id).id)
    assert.equal(retry.status, 'done', retry.error ?? '')
    assert.equal(generated, 4, 'Resume regenerated a completed asset')
    assert.equal(state.plans, 1, 'Resume replaced the reviewed asset plan')
    assert.equal(cutoutAssetState(p.clipId).plan!.id, planId)
    const after = getBundle(p.id)
    assert.deepEqual(after.assets.map(asset => asset.id).sort(), completedIds)
    assert.deepEqual([...cutoutAssetIds(after.clips[0].cutout)].sort(), completedIds)
    assert.equal(after.clips[0].cutout?.layers.length, 3)
    assert.equal(after.clips[0].transition, 'cut')
    assert.equal(after.clips[0].narration, before.narration)
    assert.equal(after.clips[0].durationMs, before.durationMs)
    assert.equal(after.project.editor.captionStyle, 'karaoke')
    assert.equal(after.project.editor.captionHighlight, '#73F96C')
  })
  await check('edit-only rejects a whole-photo composition and does not apply an earlier valid clip or global caption changes', async () => {
    const p = project(2), initial = getBundle(p.id), file = 'single-photo.png'
    writeFileSync(join(projectDir(p.id), file), png())
    const image = insertAsset({ projectId: p.id, clipId: initial.clips[1].id, kind: 'image', provider: 'codex', localPath: file, width: 90, height: 160 })
    patchClip(initial.clips[1].id, { imageAssetId: image.id })
    writeFileSync(join(projectDir(p.id), 'clean-plate.png'), png())
    writeFileSync(join(projectDir(p.id), 'actor.png'), png(true))
    const bg = insertAsset({ projectId: p.id, clipId: initial.clips[0].id, kind: 'image', provider: 'local', localPath: 'clean-plate.png', width: 90, height: 160, meta: {cutoutAsset: {role:'background',transparentFraction:0}} })
    const actor = insertAsset({ projectId: p.id, clipId: initial.clips[0].id, kind: 'image', provider: 'local', localPath: 'actor.png', width: 90, height: 160, meta: {cutoutAsset: {role:'character',transparentFraction:.3}} })
    const valid = createCutoutScene()
    valid.layers = [createCutoutLayer('bg','Clean plate',bg.id),createCutoutLayer('actor','Actor',actor.id)]
    valid.layers[0].width=1
    patchClip(initial.clips[0].id, {cutout:valid})
    const before = getEditingContext(p.id), saved = getBundle(p.id)
    const one = createCutoutScene()
    one.layers = [createCutoutLayer('flat', 'Whole photograph', image.id)]
    let generations = 0
    g.__assetGenerate = async () => { generations++; throw Error('Edit-only cannot generate') }
    g.__assetPlan = async () => ({ summary: 'No missing assets claimed.', clips: [
      { clipId: saved.clips[0].id, transition: 'cut', durationMs: null },
      { clipId: saved.clips[1].id, cutout: one, transition: 'cut', durationMs: null }
    ], editor: { captionStyle: 'karaoke' } })
    const job = await done(startCodexAutoEdit({ projectId: p.id, instruction: 'Pakai arahan Cutout terbaru dengan aset tersedia.' }).id)
    assert.equal(job.status, 'failed')
    assert.match(job.error ?? '', /Minimal dua layer/i)
    assert.equal(generations, 0)
    assert.equal(getEditingContext(p.id).revision, before.revision)
    assert.deepEqual(getBundle(p.id).clips, saved.clips)
    assert.deepEqual(getBundle(p.id).project.editor, saved.project.editor)
  })
  await check('existing dedicated continuous-action video is exempt from PNG layering and receives a hard cut without live generation', async () => {
    const p = project(), file = 'continuous-action.mp4'
    execFileSync(process.env.CUTOUT_FFMPEG!, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=90x160:r=30:d=2', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', join(projectDir(p.id), file)], { windowsHide: true })
    const video = insertAsset({ projectId: p.id, clipId: p.clipId, kind: 'video', localPath: file, width: 90, height: 160, durationMs: 2000 })
    patchClip(p.clipId, { videoAssetId: video.id, motionType: 'video' })
    g.__assetPlan = async () => ({ required: true, action: 'Satu perubahan ekspresi kontinu', prompt: 'One continuous action, fixed camera, same identity, no text.' })
    g.__assetGenerate = async () => { throw Error('Dedicated existing video must not generate PNGs') }
    const before = getBundle(p.id)
    const result = await done(startCodexAutoEdit({ projectId: p.id, clipId: p.clipId, instruction: 'Gunakan klip khusus yang tersedia untuk aksi kontinu.', specialClips: { ...DEFAULT_SPECIAL_CLIPS, enabled: true, mode: 'continuous', source: 'existing' } }).id)
    assert.equal(result.status, 'done', result.error ?? '')
    const after = getBundle(p.id)
    assert.equal(after.clips[0].cutout?.specialVideo?.assetId, video.id)
    assert.equal(after.clips[0].cutout?.layers.length, 0)
    assert.equal(after.clips[0].transition, 'cut')
    assert.equal(after.assets.length, before.assets.length)
    assert.equal(after.clips[0].durationMs, before.clips[0].durationMs)
    assert.equal(after.clips[0].narration, before.clips[0].narration)
  })
  const result = { status: 'passed', checks, actualElectron: true, actualSQLite: true, actualCanvasReviewFrames: true, actualFfmpegFixture: true, externalProviders: 'controlled; no generation requests or credits consumed', liveUserDatabaseTouched: false }
  writeFileSync(join(root, 'cutout-direction-check.json'), JSON.stringify(result, null, 2))
  closeDb(); app.quit()
}).catch(error => { console.error(error); closeDb(); app.exit(1) })

// Explicit optional-agent regression; default baseline/consent covered by cutout-permanent integration.
function startCodexAutoEdit(input:Parameters<typeof startAgentComposer>[0]){return startAgentComposer({...input,productionStrategy:'agent'})}
