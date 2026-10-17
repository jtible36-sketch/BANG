import assert from 'node:assert/strict'
import { CUTOUT_LIMITS, createCutoutLayer, createCutoutScene, cutoutAssetIds, cutoutCameraAt, cutoutPoseAt, cutoutTransformAt, evaluateCutoutScene, normalizeCutoutScene, type CutoutScene } from '../src/shared/cutout-timeline'

const close = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`)
const matrix = (actual: number[], expected: number[]): void => actual.forEach((n, i) => close(n, expected[i]))
const base = createCutoutLayer('body', 'Body', 'pose-a')
base.width = 0.2
base.keyframes = [{ id: 'end', timeMs: 1000, transform: { ...base.transform, x: 0.9, rotation: 90, scale: 2 }, easing: 'linear' }]
close(cutoutTransformAt(base, 500).x, 0.7)
close(cutoutTransformAt(base, 500).rotation, 45)
close(cutoutTransformAt(base, -100).x, 0.5)
close(cutoutTransformAt(base, 5000).scale, 2)
const unsorted = { ...base, keyframes: [base.keyframes[0], { id: 'start', timeMs: 0, transform: { ...base.transform, x: 0.1 }, easing: 'linear' as const }] }
close(cutoutTransformAt(unsorted, 500).x, 0.5)
base.keyframes[0].easing = 'hold'
close(cutoutTransformAt(base, 999).rotation, 0)
close(cutoutTransformAt(base, 1000).rotation, 90)
base.keyframes[0].easing = 'ease-in'
close(cutoutTransformAt(base, 500).x, 0.6)
base.keyframes[0].easing = 'ease-out'
close(cutoutTransformAt(base, 500).x, 0.8)
base.keyframes[0].easing = 'ease-in-out'
close(cutoutTransformAt(base, 250).x, 0.55)
close(cutoutTransformAt(base, 750).x, 0.85)
base.poses = [{ id: 'point', timeMs: 700, assetId: 'pose-b' }]
assert.equal(cutoutPoseAt(base, 699.99), 'pose-a')
assert.equal(cutoutPoseAt(base, 700), 'pose-b')
assert.equal(cutoutPoseAt(base, 9000), 'pose-b')

const scene = createCutoutScene()
scene.layers = [base]
base.keyframes = []
const sizes = { 'pose-a': { width: 100, height: 200 }, 'pose-b': { width: 200, height: 100 } }
let draw = evaluateCutoutScene(scene, 0, 1000, 500, sizes)
matrix(draw[0].matrix, [1, 0, 0, 1, 400, 50])
close(draw[0].width, 200); close(draw[0].height, 400)
draw = evaluateCutoutScene(scene, 700, 1000, 500, sizes)
matrix(draw[0].matrix, [1, 0, 0, 1, 400, 200])
close(draw[0].height, 100)
assert.deepEqual(cutoutAssetIds(scene), ['pose-a', 'pose-b'])

// A hand rotated by its parent stays on the parent's pivot, and a held prop follows the hand.
const shoulder = createCutoutLayer('shoulder', 'Shoulder', null)
shoulder.transform = { x: 0.4, y: 0.5, rotation: 90, scale: 2, opacity: 0.5 }
const hand = createCutoutLayer('hand', 'Hand', 'pose-a')
hand.parentId = 'shoulder'; hand.width = 0.1; hand.pivotX = 0; hand.pivotY = 0
hand.transform = { x: 0.1, y: 0, scale: 1, rotation: -90, opacity: 0.8 }
const prop = createCutoutLayer('prop', 'Held object', 'pose-b')
prop.parentId = 'hand'; prop.pivotX = 0; prop.pivotY = 0
prop.transform = { x: 0.05, y: 0, scale: 0.5, rotation: 0, opacity: 1 }
scene.layers = [prop, shoulder, hand]
draw = evaluateCutoutScene(scene, 0, 1000, 500, sizes)
assert.deepEqual(draw.map(item => item.layerId), ['prop', 'hand'])
matrix(draw[1].matrix, [2, 0, 0, 2, 400, 450])
matrix(draw[0].matrix, [1, 0, 0, 1, 500, 450])
close(draw[0].opacity, 0.4)
shoulder.visible = false
assert.equal(evaluateCutoutScene(scene, 0, 1000, 500, sizes).length, 0)
shoulder.visible = true; shoulder.inMs = 100; shoulder.outMs = 1000
assert.equal(evaluateCutoutScene(scene, 99, 1000, 500, sizes).length, 0)
assert.equal(evaluateCutoutScene(scene, 100, 1000, 500, sizes).length, 2)
assert.equal(evaluateCutoutScene(scene, 1000, 1000, 500, sizes).length, 0)

// Different camera depths shift far/middle/near planes, without breaking a parent's joint.
shoulder.inMs = 0; shoulder.outMs = null; shoulder.depth = 0.25
hand.depth = 2
scene.camera.keyframes = [{ id: 'pan', timeMs: 1000, x: 0.1, y: 0, zoom: 1, easing: 'linear' }]
draw = evaluateCutoutScene(scene, 1000, 1000, 500, sizes)
matrix(draw[1].matrix, [2, 0, 0, 2, 375, 450])
const near = createCutoutLayer('near', 'Foreground', 'pose-b')
near.pivotX = 0; near.pivotY = 0; near.depth = 2
scene.layers.push(near)
draw = evaluateCutoutScene(scene, 1000, 1000, 500, sizes)
close(draw[2].matrix[4], 300)
close(cutoutCameraAt(scene.camera, 500).x, 0.05)
assert.deepEqual(evaluateCutoutScene({ ...scene, enabled: false }, 1000, 1000, 500, sizes), [])
const snapshot = JSON.stringify(scene)
evaluateCutoutScene(scene, 900, 1000, 500, sizes)
assert.equal(JSON.stringify(scene), snapshot, 'Evaluation must not mutate saved state')

// Reject poisoned imports and malformed rigs instead of silently changing their output.
assert.equal(normalizeCutoutScene(null), null)
assert.equal(normalizeCutoutScene(undefined), null)
const roundTrip = normalizeCutoutScene(JSON.parse(snapshot))!
assert.deepEqual(roundTrip, scene)
const reject = (change: (value: CutoutScene) => void, match: RegExp): void => {
  const value = structuredClone(scene); change(value)
  assert.throws(() => normalizeCutoutScene(value), match)
}
reject(s => { s.layers[0].parentId = s.layers[0].id }, /melingkar/)
reject(s => { s.layers[1].parentId = 'prop' }, /melingkar/)
reject(s => { s.layers[0].parentId = 'missing' }, /tidak ditemukan/)
reject(s => { s.layers[0].transform.x = NaN }, /harus angka/)
reject(s => { s.layers[0].assetId = '../foreign.png' }, /tidak valid/)
reject(s => { s.layers[0].outMs = 0 }, /setelah/)
reject(s => { s.layers.push(structuredClone(s.layers[0])) }, /harus unik/)
reject(s => { s.camera.keyframes.push({ ...s.camera.keyframes[0], id: 'duplicate-time' }) }, /Waktu/)
reject(s => { s.layers = Array.from({ length: CUTOUT_LIMITS.layers+1 }, (_, n) => createCutoutLayer(`a${n}`, 'Layer', null)) }, /maksimal/)
assert.throws(() => normalizeCutoutScene({ ...scene, version: 2 }), /Versi/)
assert.throws(() => evaluateCutoutScene(scene, 0, 0, 500, sizes), /Ukuran/)
console.log('Cutout engine passed: interpolation, holds, poses, FK joints, opacity, time gates, parallax, ordering, immutability and import validation.')
