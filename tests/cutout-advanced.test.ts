import assert from 'node:assert/strict'
import { createCutoutLayer, createCutoutScene, evaluateCutoutScene, normalizeCutoutScene, type CutoutScene } from '../src/shared/cutout-timeline'
import { cutoutIkAt, type CutoutIkChain } from '../src/shared/cutout-ik'
import { createCutoutMask, cutoutMaskSvg, normalizeCutoutMask } from '../src/shared/cutout-mask'
import { cutoutAlpha } from '../src/shared/cutout-alpha'
import { normalizeEditorEditPlan } from '../src/shared/editor-automation'
const checks:string[]=[]
const check=(name:string,fn:()=>void)=>{fn();checks.push(name)}
function fixture():CutoutScene {
  const scene=createCutoutScene(),upper=createCutoutLayer('upper','Upper','upper-image'),lower=createCutoutLayer('lower','Lower','lower-image')
  upper.transform.x=.3;upper.transform.y=.4;upper.pivotX=lower.pivotX=0;upper.pivotY=lower.pivotY=0
  lower.parentId=upper.id;lower.transform.x=.2;lower.transform.y=0
  scene.layers=[upper,lower]
  scene.ik=[{id:'arm',name:'Arm',upperId:'upper',lowerId:'lower',enabled:true,endX:.2,endY:0,targetX:.55,targetY:.5,bend:1,weight:1,keyframes:[]}]
  return scene
}
function endpoint(scene:CutoutScene,w:number,h:number,t=0){
  const items=evaluateCutoutScene(scene,t,w,h,{'upper-image':{width:100,height:20},'lower-image':{width:100,height:20}}),item=items.find(x=>x.layerId==='lower')!,layer=scene.layers.find(l=>l.id==='lower')!,ik=scene.ik![0]
  const x=layer.pivotX*item.width+ik.endX*w,y=layer.pivotY*item.height+ik.endY*h,m=item.matrix
  return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}
}
check('two-bone IK reaches scene target in portrait and landscape',()=>{
  for(const [w,h] of [[180,320],[320,180]]){const s=fixture(),p=endpoint(s,w,h);assert(Math.abs(p.x-.55*w)<1e-4);assert(Math.abs(p.y-.5*h)<1e-4)}
})
check('IK accounts for ancestor rotation, translation and uniform scale',()=>{
  const s=fixture(),root=createCutoutLayer('root','Root',null);root.transform={x:.1,y:.1,scale:1.2,rotation:30,opacity:1};s.layers[0].parentId='root';s.layers[0].transform.x=.1;s.layers[0].transform.y=.1;s.layers.unshift(root)
  s.ik![0].targetX=.45;s.ik![0].targetY=.45
  const p=endpoint(s,320,180);assert(Math.abs(p.x-.45*320)<1e-4);assert(Math.abs(p.y-.45*180)<1e-4)
})
check('opposite bend preserves endpoint and chooses different elbow',()=>{
  const a=fixture(),b=fixture();b.ik![0].bend=-1
  assert(Math.abs(endpoint(a,320,180).x-endpoint(b,320,180).x)<1e-5)
  const ma=evaluateCutoutScene(a,0,320,180,{}).find(i=>i.layerId==='lower')!.matrix,mb=evaluateCutoutScene(b,0,320,180,{}).find(i=>i.layerId==='lower')!.matrix
  assert(Math.hypot(ma[4]-mb[4],ma[5]-mb[5])>10)
})
check('unreachable target clamps to limb reach, IK disable retains FK',()=>{
  const s=fixture();s.ik![0].targetX=5;s.ik![0].targetY=5
  const p=endpoint(s,320,180);assert(Math.hypot(p.x-.3*320,p.y-.4*180)<=.4*320+.001)
  s.ik![0].enabled=false;const fk=endpoint(s,320,180);assert(Math.abs(fk.x-.7*320)<1e-6);assert(Math.abs(fk.y-.4*180)<1e-6)
})
check('keyframed IK targets interpolate and hold deterministically',()=>{
  const s=fixture(),c=s.ik![0];c.keyframes=[{id:'target',timeMs:1000,targetX:.6,targetY:.6,weight:.5,easing:'linear'}]
  assert.equal(cutoutIkAt(c,500).targetX,.575);assert.equal(cutoutIkAt(c,500).weight,.75)
  c.keyframes[0].easing='hold';assert.equal(cutoutIkAt(c,999).targetX,.55);assert.equal(cutoutIkAt(c,1000).targetX,.6)
})
check('bad IK topology, shared bones, singular limbs and duplicate target times reject',()=>{
  for(const alter of [(c:CutoutIkChain)=>{c.lowerId='upper'},(c:CutoutIkChain)=>{c.endX=0;c.endY=0},(c:CutoutIkChain)=>{c.keyframes=[{id:'k',timeMs:0,targetX:.5,targetY:.5,weight:1,easing:'linear'},{id:'k2',timeMs:0,targetX:.6,targetY:.5,weight:1,easing:'linear'}]}]){const s=fixture();alter(s.ik![0]);assert.throws(()=>normalizeCutoutScene(s))}
  const s=fixture();s.ik!.push({...s.ik![0],id:'second'});assert.throws(()=>normalizeCutoutScene(s),/dua rantai/)
})
check('rect ellipse polygon masks normalize and produce bounded self-contained alpha SVG',()=>{
  for(const kind of ['rect','ellipse','polygon'] as const){const mask={...createCutoutMask(),kind,feather:.05,invert:true};assert.deepEqual(normalizeCutoutMask(mask),mask);const svg=cutoutMaskSvg(mask,9/16);assert(svg.includes('feGaussianBlur'));assert(!svg.includes('http:',20));assert(svg.includes('mask-type:luminance'))}
  assert.throws(()=>normalizeCutoutMask({...createCutoutMask(),feather:1}));assert.throws(()=>normalizeCutoutMask({...createCutoutMask(),points:[]}))
})
check('mask and IK survive saved JSON and automation schema; legacy scenes remain unchanged',()=>{
  const s=fixture();s.layers[1].mask={...createCutoutMask(),kind:'ellipse',invert:true};const normalized=normalizeCutoutScene(JSON.parse(JSON.stringify(s)))!
  assert.deepEqual(normalized,s)
  assert.deepEqual(normalizeEditorEditPlan({summary:'Mask and IK',clips:[{clipId:'clip',cutout:s}]}).clips[0].cutout,s)
  const old=createCutoutScene();assert.deepEqual(normalizeCutoutScene(old),old)
})
check('magenta staging matte produces actual alpha and retains isolated opaque subject',()=>{
  const pixels=new Uint8Array(10*10*4)
  for(let i=0;i<100;i++){pixels[i*4]=255;pixels[i*4+2]=255;pixels[i*4+3]=255}
  for(let y=3;y<7;y++)for(let x=3;x<7;x++){const p=(y*10+x)*4;pixels[p]=20;pixels[p+1]=120;pixels[p+2]=30}
  const result=cutoutAlpha(pixels,10,10);assert.equal(result.mode,'chroma-matte');assert.equal(result.bytes[3],0);assert.equal(result.bytes[(5*10+5)*4+3],255)
  assert.equal(pixels[3],255)
  assert.throws(()=>cutoutAlpha(new Uint8Array(400).fill(255),10,10),/belum memiliki alpha/)
})
check('native transparency is preserved without keying subject colors',()=>{
  const pixels=new Uint8Array(400);for(let y=3;y<7;y++)for(let x=3;x<7;x++){const p=(y*10+x)*4;pixels[p]=255;pixels[p+2]=255;pixels[p+3]=255}
  const result=cutoutAlpha(pixels,10,10);assert.equal(result.mode,'native-alpha');assert.deepEqual(result.bytes,pixels)
})
console.log(JSON.stringify({status:'passed',checks},null,2))
