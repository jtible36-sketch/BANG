/** Chromium bitmap BGRA. Key only the border-connected magenta staging backdrop. */
export function cutoutAlpha(bitmap: Uint8Array, width: number, height: number): { bytes: Uint8Array; mode: 'native-alpha' | 'chroma-matte'; transparentFraction: number } {
  const count = width*height
  if (!width || !height || count > 32*1024*1024 || bitmap.length !== count*4) throw new Error('Bitmap Cutout tidak valid atau terlalu besar.')
  const out = Uint8Array.from(bitmap)
  let transparent = 0, solid = 0
  for (let i = 0; i < count; i++) { if (out[i*4+3] < 16) transparent++; if (out[i*4+3] > 16) solid++ }
  if (transparent/count > .01 && solid/count > .01) return { bytes: out, mode: 'native-alpha', transparentFraction: transparent/count }
  // A flat screen is an explicit generation backdrop, never an inferred segmentation of an arbitrary photo.
  const keyable = (i: number): boolean => { const p=i*4,b=out[p],g=out[p+1],r=out[p+2]; return r > 130 && b > 130 && Math.min(r,b)-g > 75 && Math.abs(r-b) < 90 }
  const marked = new Uint8Array(count), queue = new Uint32Array(count); let head=0,tail=0
  const seed = (i: number): void => { if (!marked[i] && keyable(i)) { marked[i]=1;queue[tail++]=i } }
  for (let x=0;x<width;x++) { seed(x);seed((height-1)*width+x) }
  for (let y=0;y<height;y++) { seed(y*width);seed(y*width+width-1) }
  while (head<tail) { const i=queue[head++],x=i%width; if(x)seed(i-1);if(x<width-1)seed(i+1);if(i>=width)seed(i-width);if(i<count-width)seed(i+width) }
  if (tail/count < .01 || tail/count > .98) throw new Error('Hasil belum memiliki alpha atau latar magenta yang bisa dipisahkan. Generate ulang dengan latar #FF00FF polos; hasil tidak diberi label transparan.')
  for (let i=0;i<count;i++) if(marked[i]) out[i*4+3]=0
  // Soften only pixels touching the removed screen; retain interior costume colors.
  for (let i=0;i<count;i++) {
    if(marked[i]) continue
    const x=i%width, adjacent=(x>0&&marked[i-1])||(x<width-1&&marked[i+1])||(i>=width&&marked[i-width])||(i<count-width&&marked[i+width])
    if(!adjacent)continue
    const p=i*4,b=out[p],g=out[p+1],r=out[p+2],spill=Math.max(0,Math.min(r,b)-g)
    if(spill>20) { out[p+3]=Math.round(out[p+3]*(1-Math.min(.9,spill/255)));out[p]=Math.min(b,g+30);out[p+2]=Math.min(r,g+30) }
  }
  return { bytes: out, mode: 'chroma-matte', transparentFraction: tail/count }
}
