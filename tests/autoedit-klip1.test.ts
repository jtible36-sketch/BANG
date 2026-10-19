import {cutoutDisplayWordTimings,timelineChunks} from '../src/shared/captions'
import {applyShotMotion} from '../src/shared/cutout-shot-motion'
import {createCutoutLayer,createCutoutScene,cutoutPoseAt} from '../src/shared/cutout-timeline'
import assert from 'node:assert/strict'
import fixture from './fixtures/autoedit-klip1-rejected.json'
import {normalizeCutoutDirector} from '../src/shared/cutout-director'
import {normalizeCutoutAssetItems,type CutoutAssetItem} from '../src/shared/cutout-assets'
import {cutoutGroupKey,groupMotion,poseSpacingWarnings,reconcileMissingClaims} from '../src/shared/cutout-plan-diagnostics'
import {composeCutoutAssets} from '../src/shared/cutout-production'
import {cutoutReadiness} from '../src/shared/cutout-shot-rules'
import type {Asset,Clip,ProjectBundle} from '../src/shared/types'
let count=0;const test=(name:string,fn:()=>void)=>{fn();count++;console.log('PASS '+name)}
const chars=['baf4fd19-e122-4fff-a34e-d3850dbfff46']
test('T0 actual retained recovery item + deterministic rejected director becomes optional candidate without promoting tools',()=>{
 const items=normalizeCutoutAssetItems(fixture.items,fixture.durationMs,chars)
 const recovery=items.find(i=>i.id==='review-846bebd319bce22737ea5fa4da8a')!
 assert.equal(recovery.timeMs,1);assert.equal(recovery.motionRole,'static');assert.equal(recovery.motionRoleSource,'group')
 const director=normalizeCutoutDirector(fixture.director,fixture.durationMs,items,true);assert.deepEqual(director.shots[0].movers,['thomas'])
 const assets=items.map((i,n)=>({id:'generated-'+n,clipId:'c',kind:'image',width:100,height:100,meta:{cutoutAsset:{planId:'plan',itemId:i.id}}})) as Asset[]
 const scene=composeCutoutAssets({id:'c',cutout:null,durationMs:fixture.durationMs} as Clip,{version:1,id:'plan',clipId:'c',sourceHash:'fixture',items},assets,'9:16')
 const tools=scene.layers.find(l=>l.name==='Susunan palu dan pahat')!;assert(tools);assert.equal(tools.motionRole,'static');assert.equal(tools.poses.length,0)
 assert(!scene.layers.flatMap(l=>l.poses).some(p=>p.assetId===assets[assets.length-1].id))
})
const item=(id:string,timeMs=0,motionRole:'mover'|'static'|undefined='static',layerKey='tools'):CutoutAssetItem=>({id,timeMs,motionRole,layerKey,role:'prop',label:'Palu dan pahat',prompt:'Fixture alpha',characterId:null})
function director(items:CutoutAssetItem[],movers:string[]=[]){return {...fixture.director,timing:'provisional',shots:[{...fixture.director.shots[0],startMs:0,endMs:3000,assetIds:items.map(i=>i.id),movers}],specialAssets:[]}}
test('T1 static scheduled change diagnoses shot, group, IDs, times, role and origin',()=>{const items=[item('palu'),item('pahat',1200)];assert.throws(()=>normalizeCutoutDirector(director(items),3000,items,false),e=>{const m=String(e);for(const token of ['shot 1','tools','palu@0','pahat@1200','motionRole=static','sumber: rencana aset','hapus pergantian'])assert(m.includes(token),m);return true})})
test('T2 layerKey defines group regardless ordering or missing role on Thomas',()=>{const items=normalizeCutoutAssetItems([item('prop'),{...item('actor',0,'mover','thomas'),role:'pose'}, {...item('review-extra',1000,undefined,'thomas'),motionRole:null}],3000,[]);assert.equal(cutoutGroupKey(items[2]),'thomas');assert.equal(items[2].motionRole,'mover');assert.equal(groupMotion(items[2],items).source,'turunan grup layerKey');normalizeCutoutDirector(director(items,['thomas']),3000,items,false)})
test('T2 hold/duplicate resolved image identity is not a pose change',()=>{const items=[{...item('a'),assetId:'same'},{...item('b',1000),assetId:'same'}];normalizeCutoutDirector(director(items),3000,items,false);normalizeCutoutDirector(director([item('only')]),3000,[item('only')],false)})
test('T3 static group cannot be silently promoted by director',()=>{const items=[item('a'),item('b',1000)];assert.throws(()=>normalizeCutoutDirector(director(items,['tools']),3000,items,false),/rencana aset/)})
test('T7 maximum two mover groups enforced',()=>{const items=[item('a',0,'mover','a'),item('b',0,'mover','b'),item('c',0,'mover','c')];assert.throws(()=>normalizeCutoutDirector(director(items,['a','b','c']),3000,items,false),/maksimal 2/);assert.throws(()=>normalizeCutoutAssetItems(items,3000,[]),/2 grup mover/)})
test('T4 available hammer claim becomes placement problem; replacement remains genuine request',()=>{const inventory=[{id:'actual-tools',role:'prop',label:'Susunan palu dan pahat',generated:true}];const r=reconcileMissingClaims(fixture.rejection.missingAssets,inventory);assert.equal(r.missingAssets.length,0);assert(r.problems[0].includes('actual-tools'));assert(r.problems[0].includes('penempatan'));assert.equal(reconcileMissingClaims(['Replacement hammer with correct perspective'],inventory).missingAssets.length,1);assert.equal(reconcileMissingClaims(['A hammer is needed'],[{...inventory[0],generated:false}]).missingAssets.length,1);assert.equal(reconcileMissingClaims(['A crate surface is needed'],inventory).missingAssets.length,1)})
test('T5 400ms review variant produces configurable warning, no error',()=>{const items=[item('pose',2000,'mover','thomas'),{...item('review-pose',2400,undefined,'thomas'),motionRole:undefined}];assert.equal(poseSpacingWarnings(items).length,1);assert.equal(poseSpacingWarnings(items,300).length,0);assert.equal(groupMotion(items[1],items).value,'mover')})
test('T7 other presets bypass cutout preflight; no project changes',()=>{for(const styleId of ['stickman','collage','vox-paper','map-animation']){const b={project:{id:'p',styleId,editor:{}},clips:[],assets:[]} as unknown as ProjectBundle;const before=JSON.stringify(b);assert.deepEqual(cutoutReadiness(b),[]);assert.equal(JSON.stringify(b),before)}})

test('T5 candidate explicit selection holds from shot boundary, no implicit 1ms change',()=>{const seed=createCutoutScene(),layer=createCutoutLayer('tools','Tools','base');layer.motionRole='static';seed.layers=[layer];const shot:any={id:'s',clipId:'c',startMs:0,endMs:3000,beat:'konteks',action:'Hold',movers:[],startPose:'candidate',endPose:'candidate',motionPattern:'hold',overlays:[],narrationCue:'Hold'};const context={allowedMovers:[],assetIds:['base','candidate'],propLayerIds:['tools'],poseCandidates:{tools:['candidate']}};assert.equal(seed.layers[0].poses.length,0);const result=applyShotMotion(seed,shot,context);assert.equal(cutoutPoseAt(result.layers[0],0),'candidate');assert.equal(cutoutPoseAt(result.layers[0],2999),'candidate');assert.equal(result.layers[0].motionRole,'static');assert.equal(result.layers[0].poses.length,1)})
test('T2 conflicting roles rejected, never silently inherited static/mover',()=>{assert.throws(()=>normalizeCutoutAssetItems([item('a',0,'mover'),item('b',1000,'static')],3000,[]),/bertentangan/)})
test('T8 numeric captions divide display time proportionally; original timing and other presets untouched',()=>{const words=[{text:'1824–1825.',start:6.8,end:10.827}],before=JSON.stringify(words),split=cutoutDisplayWordTimings(words);assert(split.length>5);assert.equal(split[0].start,6.8);assert.equal(split.at(-1)!.end,10.827);assert(split.every(w=>w.end-w.start<1));assert(split.some(w=>w.text==='sampai'));assert.equal(JSON.stringify(words),before);assert.equal(timelineChunks([{start:0,words}])[0].words[0].text,'1824–1825.');assert(timelineChunks([{start:0,words}],true).flatMap(c=>c.words).length>5)})
console.log(JSON.stringify({passed:count,providers:'none',fixture:fixture.provenance}))
