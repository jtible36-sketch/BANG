import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { getDb, closeDb } from '../src/main/db/index'
import { createProject, replaceScript, getBundle, saveSnapshot, insertAsset, duplicateProject } from '../src/main/repo'
import { normalizeSoundEffects, soundEffectDurationMs, soundEffectGainAt, soundEffectFades, type SoundEffectCue } from '../src/shared/sfx'
import { projectSoundEffects, soundEffectFilter } from '../src/main/sfx'
import type { ProjectBundle, ProjectSnapshot } from '../src/shared/types'

const checks: string[] = []
const check = (name: string, fn: () => void): void => { fn(); checks.push(name) }
const data = process.env.SFX_TEST_DATA!
const ffmpeg = process.env.SFX_TEST_FFMPEG!
// Let the runner close handles even when an assertion fails before normal teardown.
;(globalThis as typeof globalThis & { closeSfxTestDb?: () => void }).closeSfxTestDb = closeDb
const cue: SoundEffectCue = { id: 'hit', assetId: 'tone', startMs: 750, offsetMs: 500, durationMs: 1000, volumeDb: -6, fadeInMs: 200, fadeOutMs: 200 }
function snapshot(bundle: ProjectBundle): ProjectSnapshot {
  const { createdAt, updatedAt, coverAssetId, ...project } = bundle.project
  return { project, characters: bundle.characters.map(({ sheetAssetId, ...c }) => c), clips: bundle.clips.map(({ imageAssetId, videoAssetId, audioAssetId, ...c }) => c) }
}
function encode(args: string[]): Buffer {
  const fileOutput = args[args.length - 1] === 'pipe:1' ? path.join(data, 'samples.f32') : null
  const outputArgs = fileOutput ? [...args.slice(0, -1), fileOutput] : args
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...outputArgs], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 })
  assert.equal(result.status, 0, result.stderr?.toString()); return fileOutput ? fs.readFileSync(fileOutput) : result.stdout
}
check('schema validation and legacy default', () => {
  assert.deepEqual(normalizeSoundEffects(undefined), [])
  assert.deepEqual(normalizeSoundEffects([cue]), [cue])
  for (const bad of [null, [cue, cue], [{ ...cue, startMs: -1 }], [{ ...cue, volumeDb: 1 }], [{ ...cue, durationMs: Infinity }], [{ ...cue, fadeOutMs: 900 }], [{ ...cue, assetId: '../escape' }], Array(129).fill(cue)]) assert.throws(() => normalizeSoundEffects(bad))
})
check('preview boundaries and proportional shortened fades', () => {
  assert.equal(soundEffectGainAt(cue, 749), 0); assert.equal(soundEffectGainAt(cue, 1750), 0)
  assert(Math.abs(soundEffectGainAt(cue, 850) - Math.pow(10, -6 / 20) * 0.5) < 1e-8)
  assert.equal(soundEffectDurationMs(cue, 1100, 3000), 600)
  assert.equal(soundEffectDurationMs(cue, 3000, 900), 150)
  assert.deepEqual(soundEffectFades(cue, 100), { fadeInMs: 50, fadeOutMs: 50 })
})
const p = createProject({ title: 'SFX isolated test', durationSec: 60 })
replaceScript(p.id, p.title, [{ title: 'Single', story: '', narration: '', durationMs: 3000 }])
const foreign = createProject({ durationSec: 60 })
insertAsset({ id: 'tone', projectId: p.id, kind: 'music', localPath: 'audio/tone.wav', durationMs: 2000 })
insertAsset({ id: 'foreign-tone', projectId: foreign.id, kind: 'audio', localPath: 'audio/tone.wav', durationMs: 2000 })
insertAsset({ id: 'picture', projectId: p.id, kind: 'image', localPath: 'image/a.png' })
check('save, reload and omitted field preserve absolute cue timing', () => {
  assert.deepEqual(getBundle(p.id).project.editor.sfx, [])
  const snap = snapshot(getBundle(p.id)); snap.project.editor.sfx = [cue]; saveSnapshot(snap)
  closeDb(); assert.deepEqual(getBundle(p.id).project.editor.sfx, [cue])
  const oldClient = snapshot(getBundle(p.id)); delete oldClient.project.editor.sfx; saveSnapshot(oldClient)
  assert.deepEqual(getBundle(p.id).project.editor.sfx, [cue])
})
check('invalid references or trim fail atomically', () => {
  for (const invalid of [{ ...cue, assetId: 'foreign-tone' }, { ...cue, assetId: 'picture' }, { ...cue, assetId: 'missing' }, { ...cue, offsetMs: 2000 }]) {
    const snap = snapshot(getBundle(p.id)); snap.project.title = 'Must not save'; snap.project.editor.sfx = [invalid]
    assert.throws(() => saveSnapshot(snap)); assert.equal(getBundle(p.id).project.title, p.title)
    assert.deepEqual(getBundle(p.id).project.editor.sfx, [cue])
  }
})
const root = path.join(data, 'projects', p.id); fs.mkdirSync(path.join(root, 'audio'), { recursive: true })
const source = path.join(root, 'audio/tone.wav')
// The first 500 ms are silence. A missing source trim would shift audible onset by half a second.
encode(['-f', 'lavfi', '-i', 'aevalsrc=if(lt(t\\,0.5)\\,0\\,0.2*sin(2*PI*480*t)):s=48000:d=2', '-ac', '2', '-c:a', 'pcm_s16le', source])
check('clone remaps cues and preserves imported media', () => {
  const cloned = duplicateProject(p.id), bundle = getBundle(cloned.id), copiedCue = bundle.project.editor.sfx![0]
  assert.notEqual(copiedCue.id, cue.id); assert.notEqual(copiedCue.assetId, cue.assetId)
  assert.equal(copiedCue.startMs, 750); assert.equal(copiedCue.offsetMs, 500)
  assert(bundle.assets.some(a => a.id === copiedCue.assetId && a.projectId === cloned.id))
  assert(fs.existsSync(path.join(data, 'projects', cloned.id, 'audio/tone.wav')))
  saveSnapshot(snapshot(bundle))
})
check('managed source guards and project-end trimming', () => {
  assert.equal(projectSoundEffects(getBundle(p.id), 900)[0].durationMs, 150)
  assert.equal(projectSoundEffects(getBundle(p.id), 500).length, 0)
  const bundle = getBundle(p.id); bundle.assets.find(a => a.id === 'tone')!.localPath = '../../escape.wav'
  fs.copyFileSync(source, path.join(data, 'escape.wav'))
  assert.throws(() => projectSoundEffects(bundle, 3000), /Lokasi|hilang/)
  bundle.assets.find(a => a.id === 'tone')!.localPath = 'audio/missing.wav'
  assert.throws(() => projectSoundEffects(bundle, 3000), /hilang/)
})
function rms(samples: Buffer, start: number, end: number): number {
  let sum = 0, n = 0
  for (let i = Math.floor(start * 48000); i < Math.floor(end * 48000); i++) { const v = samples.readFloatLE(i * 4); sum += v * v; n++ }
  return Math.sqrt(sum / n)
}
let audioEvidence: Record<string, number> = {}
check('actual FFmpeg waveform obeys source trim, absolute delay, gain and fades', () => {
  const buffer = encode(['-i', source, '-af', soundEffectFilter(cue, 1000) + ',apad,atrim=0:3', '-ar', '48000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
  assert.equal(buffer.length / 4, 3 * 48000)
  const before = rms(buffer, 0.1, 0.74), attack = rms(buffer, 0.77, 0.82), plateau = rms(buffer, 1.05, 1.25), release = rms(buffer, 1.68, 1.73), after = rms(buffer, 1.8, 2.9)
  assert(before < 1e-6); assert(after < 1e-6)
  assert(plateau > 0.069 && plateau < 0.073, String(plateau))
  assert(attack > 0.005 && attack < plateau * 0.4)
  assert(release > 0.005 && release < plateau * 0.4)
  audioEvidence = { before, attack, plateau, release, after }
  const processed = encode(['-i', source, '-af', soundEffectFilter(cue, 1000, false), '-ar', '48000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
  assert.equal(processed.length / 4, 48000)
  assert(Math.abs(rms(processed, .3, .5) - plateau) < 1e-6)
  const second = { ...cue, id: 'overlap', startMs: 1000, volumeDb: -12, fadeInMs: 0, fadeOutMs: 0 }
  const mixed = encode(['-i', source, '-i', source, '-filter_complex', `[0:a]${soundEffectFilter(cue, 1000)}[a];[1:a]${soundEffectFilter(second, 1000)}[b];[a][b]amix=inputs=2:normalize=0:dropout_transition=0,apad,atrim=0:3[out]`, '-map', '[out]', '-ar', '48000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
  assert(rms(mixed, 1.05, 1.25) > plateau * 1.45)
})
check('explicit empty cue list clears effects', () => { const snap = snapshot(getBundle(p.id)); snap.project.editor.sfx = []; saveSnapshot(snap); assert.deepEqual(getBundle(p.id).project.editor.sfx, []) })
closeDb()
const report = { status: 'passed', checks, audioEvidence, isolatedDatabase: data, userDataTouched: false }
if (process.env.SFX_TEST_REPORT) fs.writeFileSync(process.env.SFX_TEST_REPORT, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
