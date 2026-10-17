/** Motion recipes adapted from Filmcraft's MIT licensed transitions/motion.rs.
 * Copyright (c) 2026 ArtCraft Team and the FilmCraft contributors.
 * See docs/licenses/filmcraft-MIT.txt for the full notice. */
export const CUTOUT_EASING_IDS=['linear','ease-in','ease-out','ease-in-out','hold','back-out','spring'] as const
export type CutoutEasing=typeof CUTOUT_EASING_IDS[number]
export function cutoutEase(value:number,kind:CutoutEasing):number {
  const t=Math.min(1,Math.max(0,value))
  if(t>=1)return 1
  if(kind==='hold')return 0
  if(kind==='ease-in')return t*t
  if(kind==='ease-out')return 1-(1-t)**2
  if(kind==='ease-in-out')return t<.5?2*t*t:1-(-2*t+2)**2/2
  if(kind==='back-out'){const x=t-1,s=.7;return 1+(s+1)*x*x*x+s*x*x}
  if(kind==='spring'){const bounce=.25,w=(2+4*bounce)*Math.PI,k=4+6*(1-bounce),x=t**1.6,f=(u:number)=>1-Math.exp(-k*u)*Math.cos(w*u);return f(x)+x*(1-f(1))}
  return t
}
export function clampMotion(value:number,min:number,max:number):number{return Math.min(max,Math.max(min,value))}
