import assert from 'node:assert/strict'
import { getDb, closeDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, patchClip, insertAsset, getJob, saveSnapshot } from '../src/main/repo'
import { getEditingContext, validateEditingPlan, applyEditingPlan, undoEditingPlan, updateEditorPresence, withEditingEpoch, assertEditingEpoch, startCodexAutoEdit, editorAutomationStatus } from '../src/main/editor-automation'
import { createCutoutScene, createCutoutLayer } from '../src/shared/cutout-timeline'
import { createCutoutMask } from '../src/shared/cutout-mask'
import { cancelJob } from '../src/main/jobs'
import type { ProjectBundle, ProjectSnapshot } from '../src/shared/types'

const g = globalThis as any
const cases: string[] = []
const check = async (name: string, run: () => unknown | Promise<unknown>) => { try { await run(); cases.push(name) } catch (error) { console.error(`FAILED: ${name}`); throw error } }
function snapshot(b: ProjectBundle): ProjectSnapshot {
  const { createdAt: _c, updatedAt: _u, coverAssetId: _v, ...project } = b.project
  return { project, editEpoch: b.editEpoch, characters: b.characters.map(({ sheetAssetId: _s, ...c }) => c), clips: b.clips.map(({ imageAssetId: _i, videoAssetId: _v, audioAssetId: _a, ...c }) => c) }
}
async function until<T>(read: () => T, predicate: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) { const value = read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 10)) }
  throw new Error('Fixture operation timed out')
}

export async function run(): Promise<void> {
  try {
    const p = createProject({ skillId: 'animasi-cutout', styleId: 'cutout-facts', durationSec: 60 })
    replaceScript(p.id, 'Automation fixture', [{ title: 'Reaction', story: 'A character reacts.', narration: 'Narasi asli tetap utuh.', durationMs: 5000 }, { title: 'Result', story: 'Result.', narration: 'Selesai.', durationMs: 5000 }])
    const foreign = createProject({ durationSec: 60 })
    replaceScript(foreign.id, 'Foreign fixture', [{ title: 'Other', story: '', narration: '', durationMs: 5000 }])
    const clipId = getBundle(p.id).clips[0].id, foreignClip = getBundle(foreign.id).clips[0].id
    const image = insertAsset({ id: 'image', projectId: p.id, clipId, kind: 'image', localPath: 'images/actor.png', width: 100, height: 150 })
    insertAsset({ id: 'pose', projectId: p.id, kind: 'image', localPath: 'images/react.png', width: 100, height: 150 })
    insertAsset({ id: 'foreign-image', projectId: foreign.id, kind: 'image', localPath: 'images/foreign.png' })
    insertAsset({ id: 'effect', projectId: p.id, kind: 'music', localPath: 'audio/pop.wav', durationMs: 2000 })
    insertAsset({ id: 'foreign-effect', projectId: foreign.id, kind: 'music', localPath: 'audio/foreign.wav', durationMs: 2000 })
    patchClip(clipId, { imageAssetId: image.id })
    const scene = createCutoutScene(), rig = createCutoutLayer('rig', 'Rig', null), actor = createCutoutLayer('actor', 'Actor', image.id)
    actor.parentId = rig.id; actor.transform.x = 0; actor.transform.y = 0
    actor.keyframes = [{ id: 'move', timeMs: 1000, transform: { ...actor.transform, x: .1, rotation: 10 }, easing: 'ease-out' }]
    actor.poses = [{ id: 'react', timeMs: 1500, assetId: 'pose' }]
    scene.layers = [rig, actor]
    const cue = { id: 'pop', assetId: 'effect', startMs: 1500, offsetMs: 200, durationMs: 800, volumeDb: -12, fadeInMs: 20, fadeOutMs: 100 }
    const plan = { summary: 'Gerak dan reaksi', clips: [{ clipId, cutout: scene }], editor: { captionHighlight: '#55FF44', sfx: [cue] } }
    const rev = () => getEditingContext(p.id).revision
    const initialRevision = rev(), initial = getBundle(p.id)

    await check('context exposes editorial schema and timings without settings, paths or credential payloads', () => {
      const context = getEditingContext(p.id)
      assert.equal(context.clips[1].startMs, initial.clips[0].durationMs)
      const json = JSON.stringify(context)
      assert(!json.includes('localPath')); assert(!json.includes('remoteUrl')); assert(!json.includes('apiKey'))
      assert.equal(context.schema.type, 'object')
    })
    await check('validate and no-op apply do not alter saved revision or epoch', () => {
      assert.equal(validateEditingPlan(p.id, initialRevision, plan).valid, true)
      assert.equal(rev(), initialRevision)
      const empty = { summary: 'Tidak perlu edit', clips: [] }
      assert.equal(validateEditingPlan(p.id, initialRevision, empty).changed, false)
      const noop = applyEditingPlan(p.id, initialRevision, empty)
      assert.equal(noop.undoId, ''); assert.equal(noop.bundle.editEpoch, 0); assert.equal(noop.revision, initialRevision)
    })
    await check('apply saves rig, keyframes, pose schedule and SFX atomically while preserving media and narration', () => {
      const result = applyEditingPlan(p.id, rev(), plan), stored = getBundle(p.id)
      assert(result.undoId); assert.equal(result.bundle.editEpoch, 1)
      assert.deepEqual(stored.clips[0].cutout, scene); assert.deepEqual(stored.project.editor.sfx, [cue])
      assert.equal(stored.clips[0].narration, initial.clips[0].narration)
      assert.equal(stored.clips[0].imageAssetId, image.id)
      assert.equal(g.__fixtureEvents.length, 1)
      assert.equal(getEditingContext(p.id).undoAvailable, true)
    })
    await check('stale revisions and pre-automation save epochs reject lost updates', () => {
      assert.throws(() => applyEditingPlan(p.id, initialRevision, plan), /Revisi proyek berubah/)
      assert.throws(() => assertEditingEpoch(snapshot(initial)), /diperbarui/)
      assert.doesNotThrow(() => assertEditingEpoch(snapshot(withEditingEpoch(getBundle(p.id)))))
    })
    await check('saved rig and undo backup survive SQLite close and reopen', () => {
      closeDb(); assert.deepEqual(getBundle(p.id).clips[0].cutout, scene)
      assert.equal(getEditingContext(p.id).undoAvailable, true)
      const undone = undoEditingPlan(p.id, rev())
      assert.equal(undone.bundle.editEpoch, 2); assert.equal(undone.bundle.clips[0].cutout, null)
      assert.deepEqual(undone.bundle.project.editor.sfx, initial.project.editor.sfx)
      assert.equal(undone.bundle.clips[0].imageAssetId, image.id)
      assert.equal(getEditingContext(p.id).undoAvailable, false)
      assert.throws(() => undoEditingPlan(p.id, rev()), /Undo tidak tersedia/)
    })
    await check('dirty/saving/error and stale editor heartbeat block automation; fresh saved allows it', () => {
      for (const saveState of ['dirty', 'saving', 'error']) {
        updateEditorPresence(1, { projectId: p.id, saveState })
        assert.throws(() => validateEditingPlan(p.id, rev(), plan), /belum tersimpan/)
      }
      updateEditorPresence(1, { projectId: p.id, saveState: 'saved' })
      const originalNow = Date.now, original = originalNow()
      try { Date.now = () => original + 25_000; assert.throws(() => validateEditingPlan(p.id, rev(), plan), /belum merespons/) }
      finally { Date.now = originalNow }
      updateEditorPresence(1, { projectId: p.id, saveState: 'saved' })
      assert.equal(validateEditingPlan(p.id, rev(), plan).valid, true)
    })
    await check('foreign/missing assets, foreign clips, cyclic rigs and out-of-range keys reject without writes', () => {
      const before = rev()
      for (const assetId of ['foreign-image', 'missing', 'effect']) {
        const invalid = structuredClone(plan); invalid.clips[0].cutout.layers[1].poses[0].assetId = assetId
        assert.throws(() => applyEditingPlan(p.id, rev(), invalid), /Aset layer/)
      }
      assert.throws(() => applyEditingPlan(p.id, rev(), { summary: 'foreign', clips: [{ clipId: foreignClip, transition: 'fade' }] }), /di luar proyek/)
      const cyclic = structuredClone(plan); cyclic.clips[0].cutout.layers[0].parentId = 'actor'
      assert.throws(() => applyEditingPlan(p.id, rev(), cyclic), /melingkar/)
      const late = structuredClone(plan); late.clips[0].cutout.layers[1].keyframes[0].timeMs = 1_000_000
      assert.throws(() => applyEditingPlan(p.id, rev(), late), /melewati durasi/)
      assert.equal(rev(), before)
    })
    await check('invalid SFX ownership, source trim and project times reject atomically', () => {
      for (const change of [{ assetId: 'foreign-effect' }, { offsetMs: 2000 }, { startMs: 999999 }]) {
        assert.throws(() => applyEditingPlan(p.id, rev(), { summary: 'invalid effect', clips: [], editor: { sfx: [{ ...cue, ...change }] } }))
      }
      assert.deepEqual(getBundle(p.id).project.editor.sfx, initial.project.editor.sfx)
    })
    await check('undo refuses to overwrite intervening manual changes', () => {
      applyEditingPlan(p.id, rev(), plan)
      const manual = snapshot(withEditingEpoch(getBundle(p.id))); manual.clips[0].title = 'Manual title'; saveSnapshot(manual)
      assert.equal(getEditingContext(p.id).undoAvailable, false)
      assert.throws(() => undoEditingPlan(p.id, rev()), /Undo tidak tersedia/)
      assert.equal(getBundle(p.id).clips[0].title, 'Manual title')
    })
    await check('duration-only edits validate existing keyframes and poses against the shortened clip', () => {
      assert.throws(() => validateEditingPlan(p.id, rev(), { summary: 'Shorten', clips: [{ clipId, durationMs: 500 }] }), /melewati durasi/)
    })
    await check('mask keys persist atomically, reject shortened duration, and undo restores the original scene',()=>{
      const q=createProject({durationSec:60});replaceScript(q.id,'Mask fixture',[{title:'Reveal',story:'',narration:'',durationMs:3000}]);const c=getBundle(q.id).clips[0].id
      insertAsset({id:'mask-track-source',projectId:q.id,clipId:c,kind:'image',localPath:'images/mask.png',width:100,height:100})
      const scene=createCutoutScene(),layer=createCutoutLayer('mask-track','Reflection','mask-track-source');layer.mask=createCutoutMask();layer.maskKeyframes=[{id:'mask-track-key',timeMs:2500,mask:{...layer.mask,width:.3},easing:'linear'}];scene.layers=[layer]
      applyEditingPlan(q.id,getEditingContext(q.id).revision,{summary:'Animated mask',clips:[{clipId:c,cutout:scene}]})
      assert.equal(getBundle(q.id).clips[0].cutout?.layers[0].maskKeyframes?.[0].timeMs,2500)
      assert.throws(()=>validateEditingPlan(q.id,getEditingContext(q.id).revision,{summary:'Shorten',clips:[{clipId:c,durationMs:2000}]}),/melewati durasi/)
      undoEditingPlan(q.id,getEditingContext(q.id).revision);assert.equal(getBundle(q.id).clips[0].cutout,null)
    })
    await check('shortening project duration checks existing SFX and labels even when omitted from the patch', () => {
      const q = createProject({ durationSec: 60 }); replaceScript(q.id, 'Shorten fixture', [{ title: 'One', story: '', narration: '', durationMs: 5000 }])
      const c = getBundle(q.id).clips[0].id
      insertAsset({ id: 'late-effect', projectId: q.id, kind: 'music', localPath: 'audio/late.wav', durationMs: 1000 })
      applyEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Late cue', clips: [], editor: { sfx: [{ ...cue, assetId: 'late-effect', startMs: 4000 }] } })
      assert.throws(() => validateEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Shorten', clips: [{ clipId: c, durationMs: 2000 }] }), /SFX melewati/)
      applyEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Late label', clips: [], editor: { sfx: [], overlays: [{ id: 'late-label', kind: 'text', text: 'Reaksi', anchor: 5, x: .5, y: .5, start: 4, end: 4.5, size: .05, color: '#FFFFFF', style: 'box', bold: true }] } })
      assert.throws(() => validateEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Shorten', clips: [{ clipId: c, durationMs: 2000 }] }), /Label melewati/)
    })
    await check('reviewed narration audio locks duration while retaining cutout timing', () => {
      const q = createProject({ durationSec: 60 }); replaceScript(q.id, 'Voice fixture', [{ title: 'One', story: '', narration: 'Narasi.', durationMs: 3000 }])
      const c = getBundle(q.id).clips[0].id
      insertAsset({ id: 'reviewed-voice', projectId: q.id, clipId: c, kind: 'audio', prompt: 'Narasi.', localPath: 'audio/voice.wav', durationMs: 3000 })
      patchClip(c, { audioAssetId: 'reviewed-voice' })
      assert.throws(() => validateEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Shorten speech', clips: [{ clipId: c, durationMs: 1000 }] }), /Durasi terkunci/)
      assert.equal(validateEditingPlan(q.id, getEditingContext(q.id).revision, { summary: 'Keep speech', clips: [{ clipId: c, durationMs: 3000 }] }).valid, true)
    })
    await check('stale reviewed voice timing blocks even caption-only edits before storage can retime clips', () => {
      const q = createProject({ durationSec: 60 }); replaceScript(q.id, 'Stale timing', [{ title: 'One', story: '', narration: 'Narasi.', durationMs: 5000 }])
      const c = getBundle(q.id).clips[0].id
      insertAsset({ id: 'stale-voice', projectId: q.id, clipId: c, kind: 'audio', prompt: 'Narasi.', localPath: 'audio/stale.wav', durationMs: 2000 })
      patchClip(c, { audioAssetId: 'stale-voice', durationMs: 5000 })
      const revision = getEditingContext(q.id).revision
      assert.throws(() => applyEditingPlan(q.id, revision, { summary: 'Caption only', clips: [], editor: { captionColor: '#FFFFFF' } }), /Timing narasi tersimpan belum sinkron/)
      assert.equal(getBundle(q.id).clips[0].durationMs, 5000)
      assert.equal(getEditingContext(q.id).revision, revision)
    })
    await check('caption/overlay validation blocks foreign images and malformed periods', () => {
      const base = { id: 'label', kind: 'image', assetId: 'foreign-image', anchor: 5, x: .5, y: .5, start: 0, end: null, width: .3, opacity: 1 }
      assert.throws(() => validateEditingPlan(p.id, rev(), { summary: 'bad label', clips: [], editor: { overlays: [base] } }), /Aset label/)
      assert.throws(() => validateEditingPlan(p.id, rev(), { summary: 'bad label', clips: [], editor: { overlays: [{ ...base, assetId: 'image', start: 3, end: 1 }] } }), /setelah awal/)
    })
    await check('raw unsupported keys cannot modify protected narration or run arbitrary commands', () => {
      assert.throws(() => validateEditingPlan(p.id, rev(), { summary: 'inject', clips: [{ clipId, narration: 'changed' }] }), /field tidak didukung/)
      assert.throws(() => validateEditingPlan(p.id, rev(), { summary: 'inject', clips: [], command: 'shell' }), /field tidak didukung/)
    })
    await check('real job cancellation aborts mocked Codex generation before any edit', async () => {
      let entered = false
      g.__generateCodex = ({ signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => { entered = true; signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }) })
      const before = rev(), job = startCodexAutoEdit({ projectId: p.id, instruction: 'Move actor' })
      await until(() => entered, Boolean)
      assert.throws(() => startCodexAutoEdit({ projectId: p.id, instruction: 'duplicate' }), /masih berjalan/)
      await cancelJob(job.id)
      const done = await until(() => getJob(job.id)!, j => j.status === 'canceled')
      assert.equal(done.error, null); assert.equal(rev(), before)
    })
    await check('content changes during Codex generation reject the delayed plan', async () => {
      let release: ((value: unknown) => void) | undefined
      g.__generateCodex = () => new Promise(resolve => { release = resolve })
      const job = startCodexAutoEdit({ projectId: p.id, instruction: 'Move actor' })
      await until(() => release, Boolean)
      const manual = snapshot(withEditingEpoch(getBundle(p.id))); manual.clips[0].title = 'Concurrent edit'; saveSnapshot(manual)
      const afterManual = rev()
      release!({ summary: 'Late plan', clips: [{ clipId, cutout: scene, transition: 'fade', durationMs: null }], editor: null })
      const done = await until(() => getJob(job.id)!, j => j.status === 'failed')
      assert.match(done.error!, /Revisi proyek berubah/); assert.equal(rev(), afterManual)
    })
    await check('scoped Codex edits cannot touch another clip', async () => {
      const otherClip = getBundle(p.id).clips[1].id, before = rev()
      g.__generateCodex = async () => ({ summary: 'Out of scope', clips: [{ clipId: otherClip, cutout: null, transition: 'fade', durationMs: null }], editor: null })
      const job = startCodexAutoEdit({ projectId: p.id, clipId, instruction: 'Only current clip' })
      const done = await until(() => getJob(job.id)!, j => j.status === 'failed')
      assert.match(done.error!, /di luar adegan/); assert.equal(rev(), before)
    })
    await check('successful Codex structured plan saves through the real transaction and creates undo', async () => {
      g.__generateCodex = async () => ({ summary: 'Pindah pada akhir shot', clips: [{ clipId, cutout: scene, transition: 'cut', durationMs: null }], editor: null })
      const job = startCodexAutoEdit({ projectId: p.id, clipId, instruction: 'Move actor' })
      const done = await until(() => getJob(job.id)!, j => j.status === 'done' || j.status === 'failed')
      assert.equal(done.status, 'done', done.error ?? undefined)
      assert.equal(getBundle(p.id).clips[0].transition, 'cut')
      assert.equal(getEditingContext(p.id).undoAvailable, true)
    })
    await check('status and saved snapshots use clean fixture services and current epoch', async () => {
      const status = await editorAutomationStatus(); assert.equal(status.codexReady, true)
      const snap = snapshot(withEditingEpoch(getBundle(p.id))); assertEditingEpoch(snap); saveSnapshot(snap)
      assert(getDb().prepare('SELECT COUNT(*) AS n FROM editor_automation_undo').get())
    })
    console.log(JSON.stringify({ status: 'passed', cases, realSQLite: true, realJobQueue: true, liveUserDatabaseTouched: false }, null, 2))
  } finally { closeDb() }
}
