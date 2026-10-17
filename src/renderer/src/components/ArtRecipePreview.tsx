import { useId } from 'react'
import { getStyle } from '@shared/styles'
import { getHuashuRecipe } from '@shared/huashu-catalog'

/** Original, deterministic material studies for navigation; not generated production frames. */
export function ArtRecipePreview({ styleId }: { styleId: string }) {
  const uid = useId().replace(/:/g, '')
  const style = getStyle(styleId)
  const recipe = getHuashuRecipe(styleId)
  const number = Number(recipe?.recipeId.slice(0, 2) || 16)
  const [paper, ink, accent, secondary, pale] = style.palette || [style.swatch, style.ink, '#cb6443', '#bcad7c', '#f3e9d3']
  const dots = [13, 21, 27, 29].includes(number)
  const geometry = [11, 12, 22, 30, 31].includes(number) || styleId === 'motion-poster'
  const mosaic = number === 4
  const pixel = number === 14
  const night = [15, 26, 35].includes(number) || styleId === 'motion-grainy'
  const outline = [3, 10, 13, 27, 31, 33, 34, 37].includes(number)
  const brush = [8, 9, 17, 19, 25, 28, 32, 36].includes(number)
  const symbol = styleId.replace('huashu-', '')
  const person = (x: number, y: number, color: string, scale = 1) => <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M-12 32-20 60M12 32 20 60M-12 2-29 23M12 2 31-15" fill="none" /><path d="M-16-2H16L20 35H-20Z" fill={color} /><circle cy="-19" r="18" fill={pale || paper} /><path d="M-8-18h1m13 0h1m-8 10 7-2" fill="none" /></g>
  const motif = (() => {
    if (styleId === 'motion-product-tour') return <><rect x="70" y="30" width="185" height="128" rx="12" fill={ink} /><rect x="81" y="43" width="163" height="102" rx="5" fill={paper} /><rect x="94" y="58" width="52" height="73" rx="5" fill={accent} /><path d="M161 68h62m-62 13h43m-43 13h57" stroke={ink} strokeWidth="5" opacity=".3" /><rect x="162" y="111" width="57" height="21" rx="10" fill={secondary} /><path d="M49 165h225l-17 11H66Z" fill={ink} /><path d="m196 107 21 12-12 2-4 13Z" fill={paper} stroke={ink} strokeWidth="2" /></>
    if (styleId === 'motion-flat-vector') return <><circle cx="224" cy="73" r="52" fill={accent} /><path d="M20 164h278" stroke={ink} strokeWidth="3" /><rect x="43" y="83" width="60" height="80" rx="8" fill={secondary} /><path d="m64 116 10 9 17-27" fill="none" stroke={paper} strokeWidth="6" />{person(161, 102, ink, .95)}<path d="m218 138 36-18 20 37-38 19Z" fill={secondary} /></>
    if (styleId === 'motion-photo-pop') return <><circle cx="229" cy="74" r="64" fill={accent} /><g transform="rotate(-9 149 98)"><rect x="66" y="19" width="145" height="165" fill={paper} stroke={ink} strokeWidth="2" /><rect x="76" y="30" width="125" height="133" fill={secondary} />{person(138, 98, ink, .8)}</g><path d="m233 115 8 15 17-6-2 18 17 6-15 10 5 17-18-1-5 17-11-15-16 6 1-18-17-5 15-11-6-16 18 1Z" fill={paper} stroke={ink} strokeWidth="2" /></>
    switch (number) {
      case 1: return <><path d="M0 54 62 21 131 42 219 13 320 41V200H0Z" fill={ink} opacity=".12" /><g stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M57 102q21-40 73-20l39 4 27-21 18 18-16 20-30 5-10 44-13-7 1-39-38 1-21 38-12-3 8-42Z" fill={accent} /><path d="m195 68 2-21 15 12m-18 10-13-15m-121 50-20-14" fill="none" /><path d="m251 113 1 35-17 24m17-24 20 20m-20-42-18-9m18 8 20-23" fill="none" /><circle cx="252" cy="102" r="8" fill={ink} /></g><path d="M18 184q70-16 119 0t152-6" fill="none" stroke={secondary} strokeWidth="2" /></>
      case 2: return <><circle cx="250" cy="42" r="21" fill={accent} /><path d="M20 174H300M20 181H300" stroke={ink} strokeWidth="3" /><path d="m26 162 53-88 55 88m84 0 42-63 42 63" fill={secondary} opacity=".35" /><g stroke={ink} strokeWidth="3" strokeLinejoin="round"><path d="M132 66v41l-24 37h58l-12-40V65Z" fill={accent} /><path d="m131 81-29 14-16-21m66 5 31 17 18-27m-70 74-8 27h-18m43-27 10 27h23" fill="none" strokeWidth="6" /><path d="M132 61q-11-29 14-34l17 14-8 10v16Z" fill={secondary} /><path d="M130 29h28l6 29-13-8-17 12Z" fill={ink} /><path d="m151 42 6 1" stroke={paper} /></g><path d="M201 63v105" stroke={ink} strokeWidth="3" /></>
      case 3: return <><path d="M127 24h66v15l-13 16v20q47 23 34 62l-35 33v10h-38v-10l-35-33q-13-39 34-62V55l-13-16Z" fill={ink} /><path d="M133 70q-55-30-48 23t33 30m70-53q55-30 48 23t-33 30" fill="none" stroke={ink} strokeWidth="8" /><g stroke={paper} strokeWidth="3" fill="none"><path d="M115 94h90m-91 46h90m-60-33 19 14 17-23m-17 23-9 14m9-14 18 14" /><circle cx="158" cy="104" r="6" /></g><path d="M109 151h100" stroke={accent} strokeWidth="4" /></>
      case 4: return <><path d="M57 183V82a103 74 0 0 1 206 0v101Z" fill={ink} /><path d="M75 183V87a85 60 0 0 1 170 0v96Z" fill={secondary} /><circle cx="160" cy="83" r="29" fill={accent} /><path d="M103 176q2-61 57-61t57 61Z" fill={paper} /><path d="m147 80 8 1m15 0 8-1m-22 17 13 1" stroke={ink} strokeWidth="3" /><path d="M11 189h298M22 22h39m198 0h39" stroke={accent} strokeWidth="8" /></>
      case 5: return <><path d="M71 182V97Q71 46 160 10q89 36 89 87v85Z" fill={ink} /><path d="M83 172V98q0-40 77-73 77 33 77 73v74Z" fill={secondary} /><circle cx="160" cy="80" r="29" fill={accent} /><path d="M96 172v-52q0-20 22-35 22 15 22 35v52m40 0v-52q0-20 22-35 22 15 22 35v52" fill={paper} stroke={ink} strokeWidth="5" /><path d="M160 25v148M84 111h153m-96-52 39 41m-39 0 39-41" stroke={ink} strokeWidth="5" /><path d="M45 182h230" stroke={accent} strokeWidth="8" /></>
      case 6: case 32: case 36: return <><path d="M0 0h124v200H0Z" fill={ink} opacity=".4" /><path d="M23 22h66v75H23Z" fill={secondary} /><path d="M23 22 201 165 92 181 23 96Z" fill={pale || paper} opacity={number === 32 ? '.24' : '.12'} /><path d="M104 200q2-83 65-88 67 4 81 88Z" fill={number === 36 ? secondary : ink} /><ellipse cx="174" cy="79" rx="31" ry="41" fill={number === 36 ? paper : secondary} /><path d="M142 74q-12-51 31-48 47 0 35 68l-14-29-45-5Z" fill={ink} /><path d="m159 80 8-1m13 0 8 1m-20 19q8 4 13-1" stroke={ink} strokeWidth="2" fill="none" /><path d="M135 158q33-17 63 10m-64 6 52-7" fill="none" stroke={secondary} strokeWidth="10" strokeLinecap="round" /></>
      case 8: case 28: case 29: return <><path d="M0 76q61-36 123-7t197-4V200H0Z" fill={secondary} /><path d="M0 120q81-22 159 0t161-8v88H0Z" fill={accent} opacity=".38" /><path d="M32 111Q157 13 288 101m-246-1v29m36-56v27m165-27v29m35-8v26" fill="none" stroke={ink} strokeWidth="7" opacity=".65" />{[0,1,2,3,4,5].map(i=><g key={i} transform={`translate(${44 + i * 43} ${143 + i % 2 * 27})`}><ellipse rx="21" ry="6" fill={paper} opacity=".75" /><path d="m-5-2 4-10 5 7 5-5 2 10Z" fill={pale || ink} /></g>)}</>
      case 9: return <><path d="M0 132 60 106 123 125 215 102 320 133V200H0Z" fill={ink} /><g fill="none" stroke={secondary} strokeWidth="5" opacity=".75"><path d="M28 79q40-57 90-11t81-16q20-29 65-8M31 67q37-35 73-6t70 7M145 104q41-30 77-19t69-10" /></g><circle cx="254" cy="41" r="24" fill={accent} /><path d="M43 191 53 74 66 131 73 55 88 191Z" fill={ink} /><path d="M128 183v-31l20-17 20 17v31m21 0v-24l19-15 18 15v24" fill={secondary} />{[0,1,2,3,4].map(i=><circle key={i} cx={32+i*54} cy={26+(i%2)*25} r="4" fill={pale || paper} />)}</>
      case 10: return <><path d="M24 189Q12 28 122 21M296 189Q308 28 198 21M75 193Q26 82 116 45m129 148q49-111-41-148" fill="none" stroke={ink} strokeWidth="3" /><ellipse cx="160" cy="96" rx="66" ry="85" fill={secondary} /><path d="M117 181q-5-55 24-73-34-36 1-71 46-25 61 25-3 26-29 44 35 29 36 75Z" fill={accent} stroke={ink} strokeWidth="2" /><path d="M144 45q-16 26 0 42l26 6-5 18 27-14q19-32-2-48Z" fill={paper} /><path d="M109 39Q51 0 46 63q40 9 63-24m102 0q58-39 63 24-40 9-63-24" fill={accent} stroke={ink} strokeWidth="2" /></>
      case 13: case 27: return <><path d="M0 0h320v200H0Z" fill={secondary} /><path d="m167 8 12 43 39-25-12 45 57 1-44 25 38 36-51-5 4 47-32-29-20 49-8-48-48 20 21-40-58-12 49-18-31-42 51 12Z" fill={paper} stroke={ink} strokeWidth="3" /><path d="M134 122q-13-17-7-29l14-14 8 14-1-43q7-16 15-3l1 40 9-13 13 5 11 22-18 36Z" fill={accent} stroke={ink} strokeWidth="4" /><path d="m132 120 52 10-9 37-42-7Z" fill={ink} /></>
      case 17: return <><path d="M0 132 57 56 111 129 169 32 246 144 288 79 320 125V200H0Z" fill={ink} opacity=".15" /><path d="M0 162q66-24 135-8t185-6" fill="none" stroke={ink} opacity=".3" strokeWidth="2" /><path d="m63 200 8-158m16 158 15-181m-35 90 33-26m-31 63 29-20" stroke={ink} strokeWidth="5" fill="none" /><path d="M75 62Q39 29 36 52q13 20 39 10m22 22q42-52 43-14-11 22-43 14m-28 43Q22 92 27 129q18 11 42-2m26 18q40-32 42-3-19 16-42 3" fill={ink} /><circle cx="257" cy="37" r="18" fill={accent} /><path d="m183 173 26-8 21 8-11 8h-26Z" fill={ink} /></>
      case 18: return <><rect x="36" y="13" width="248" height="176" rx="85" fill={accent} /><path d="M100 185q2-78 44-83h41q44 10 37 83Z" fill={secondary} /><ellipse cx="165" cy="74" rx="29" ry="37" fill={paper} /><path d="M132 83q-19-62 32-58 47 4 32 62l-15-43-42 7Z" fill={ink} />{Array.from({length:18},(_,i)=><rect key={i} x={111+i%6*17} y={120+Math.floor(i/6)*23} width="10" height="16" fill={i%2?ink:accent} transform={`rotate(${i%3*8} ${116+i%6*17} ${128+Math.floor(i/6)*23})`} />)}</>
      case 19: return <><path d="M0 29q84-31 160 2t160-12m-320 36q71-26 153 0t167-9M0 84q84-32 151-5t169-8" stroke={accent} fill="none" strokeWidth="15" /><path d="M0 163 320 108v92H0Z" fill={ink} opacity=".5" /><path d="M0 184 320 117M0 155 320 100" stroke={ink} strokeWidth="6" /><path d="M119 200q4-76 42-82 41 6 49 82Z" fill={ink} /><ellipse cx="162" cy="93" rx="26" ry="39" fill={paper} /><ellipse cx="163" cy="109" rx="8" ry="13" fill={ink} /><path d="m145 84 9 2m18 0 9-2m-59 70 16-43m55 47-12-45" stroke={paper} strokeWidth="9" strokeLinecap="round" /><path d="m145 84 9 2m18 0 9-2" stroke={ink} strokeWidth="4" /></>
      case 20: return <><circle cx="157" cy="81" r="56" fill={accent} opacity=".65" /><path d="M7 114q88-94 124 25t173-78M6 143q92-82 124 20t176-66" fill="none" stroke={secondary} strokeWidth="13" /><path d="m145 99-50 64 56-11 35-40Z" fill={ink} /><ellipse cx="161" cy="77" rx="15" ry="19" fill={paper} /><path d="M147 95q-26 2-43-28m65 29q28-1 46-40" fill="none" stroke={paper} strokeWidth="8" strokeLinecap="round" /><path d="m145 107 24 2 31 59-41-22Z" fill={accent} /></>
      case 21: return <><path d="M93 173Q45 77 136 57l12-24h23l12 24q90 20 42 116Z" fill={accent} /><path d="M148 59q-37 41-21 114m32-116v118m14-118q37 41 21 116" stroke={ink} strokeWidth="3" fill="none" /><path d="m148 35 4-18h15l4 18" fill={ink} /></>
      case 23: return <><path d="M0 147 79 119 150 146 231 115 320 145v55H0Z" fill={secondary} /><path d="M49 151V44h11v26l62-19 4 9-66 23v68Z" fill={ink} /><path d="M72 67q64-28 61 4l-14 63q-10 31-27 3L87 84Z" fill={paper} stroke={ink} strokeWidth="2" /><ellipse cx="109" cy="78" rx="25" ry="12" fill={accent} /><path d="m108 70 1 10 14 1" stroke={ink} strokeWidth="2" /><path d="m179 131 61-13 19 52-80 1Z" fill={ink} /><path d="M183 132q61-21 59 5l-4 45q-10 15-17-4l-1-25q-32 3-37-21Z" fill={paper} /><path d="m204 134 9 5-1 11" stroke={ink} strokeWidth="2" fill="none" /></>
      case 24: return <><path d="M0 35h320v165H0Z" fill={ink} /><path d="M24 57h260v107H24Z" fill={secondary} /><path d="M33 63h235v81H33Z" fill={paper} /><path d="M0 164h320M91 55v91m94-91v91" stroke={accent} strokeWidth="7" /><path d="m23 145 260 0 25 19H0Z" fill={accent} /><circle cx="150" cy="104" r="13" fill={ink} /><path d="M132 143q2-29 18-27 19 3 25 27Z" fill={ink} /><path d="M26 23h142" stroke={secondary} strokeWidth="4" /></>
      case 25: return <><path d="M0 126q40-47 104-11t89-11 127 2v94H0Z" fill={secondary} /><circle cx="267" cy="42" r="25" fill={pale || paper} /><path d="M30 148V81l41-33 46 34v66Z" fill={paper} /><path d="m21 82 50-40 53 40Z" fill={accent} /><path d="M54 149v-40h24v40m13-61h14v19H91Z" fill={ink} /><path d="M8 158q128-22 219 42" stroke={accent} strokeWidth="21" fill="none" />{person(204, 131, accent, .65)}<path d="M257 171v-49" stroke={ink} strokeWidth="5" /><circle cx="256" cy="106" r="31" fill={secondary} /></>
      case 30: return <><path d="M0 0h320v200H0Z" fill={secondary} /><path d="M27 166 58 32l47 51-8 94Z" fill={ink} /><path d="M148 192q-47-21-22-54l30-29-24-42q-7-32 14-40 18-7 23 18l9 36 20-47q13-19 27-6 9 11-4 32l-20 42 39-4q28 1 25 23-3 13-25 15l-50 13q1 40-42 43Z" fill={accent} /><circle cx="268" cy="42" r="23" fill={paper} /></>
      case 31: return <><path d="M32 165h256" stroke={ink} strokeWidth="5" /><g stroke={ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"><path d="m134 90-37 2-29-27m83 30 36 4 25-35m-66 49-31 36-37 4m65-40 18 35 40 8" fill="none" /><circle cx="146" cy="59" r="19" fill={accent} /><path d="m126 82 36 1 4 37-41-5Z" fill={accent} /><path d="m112 37-8-11m65 7 8-12m47 67 17-2m-12 39 14 7" strokeWidth="4" /></g></>
      case 33: return <><ellipse cx="161" cy="180" rx="72" ry="9" fill={ink} opacity=".2" /><g stroke={ink} strokeWidth="6" strokeLinecap="round"><path d="M145 127q-24 18-18 40m49-40q-3 22 22 36m-63-63Q95 73 77 90m106 6q32 18 48-8" fill="none" /><ellipse cx="155" cy="102" rx="35" ry="34" fill={ink} /><ellipse cx="151" cy="65" rx="36" ry="31" fill={paper} /><path d="M132 57v13m22-14v13m-22 12q17 14 31-1" fill="none" strokeWidth="4" /><path d="M111 172h28m47-7 29 9" strokeWidth="14" /></g><circle cx="77" cy="90" r="10" fill={paper} stroke={ink} strokeWidth="3" /><circle cx="230" cy="86" r="10" fill={paper} stroke={ink} strokeWidth="3" /></>
      case 34: return <><path d="M19 11v176h282V11M19 29h282" stroke={ink} strokeWidth="4" fill="none" /><path d="m147 59-4-27 25 13 14 25-14 8 3 22 36 29-15 13-34-26-11 30 26 32-22 6-25-39 8-49Z" fill={ink} /><path d="m143 87-34 11-28-22m86 27 38-11 16-29" fill="none" stroke={ink} strokeWidth="8" /><circle cx="166" cy="61" r="3" fill={accent} /><path d="M82 78v116m139-128v128m-73-48v48" stroke={secondary} strokeWidth="2" /><path d="m151 99 10 9-9 11-9-10Z" fill={accent} /></>
      case 35: return <><path d="M0 152h24v-32h21v17h18v-44h38v59h22v-23h30v23h29v-37h30v20h37v-36h24v53h47v48H0Z" fill={ink} /><path d="M28 165h263" stroke={accent} strokeWidth="2" /><path d="M41 29Q167 53 253 117" fill="none" stroke={pale || paper} strokeWidth="2" /><path d="M41 29Q162 62 253 117" fill="none" stroke={secondary} strokeWidth="4" opacity=".5" /><circle cx="253" cy="117" r="4" fill={paper} />{[0,1,2,3,4,5,6,7].map(i=><path key={i} d={`m${70+i*27} ${16+i%3*17}v2`} stroke={paper} strokeWidth="2" />)}<path d="M75 111h5v6h-5m12-6h5v6h-5m-12 9h5v6h-5m12-6h5v6h-5m109-7h5v6h-5m55-11h5v6h-5" fill={secondary} /></>
      case 37: return <><circle cx="248" cy="81" r="66" fill={secondary} /><ellipse cx="248" cy="81" rx="43" ry="58" fill={accent} opacity=".5" /><path d="M18 170h286" stroke={ink} strokeWidth="3" /><path d="M98 154v-42l26-14 30 16 8 40Z" fill={paper} stroke={ink} strokeWidth="2" /><path d="m104 155-6 29m47-29 11 29m-48-74-29 21m70-20 37-20" fill="none" stroke={ink} strokeWidth="5" /><ellipse cx="128" cy="73" rx="26" ry="32" fill={secondary} stroke={ink} strokeWidth="2" /><path d="m101 54 5-23 14 12 7-20 11 21 20-8-6 27" fill={ink} /><circle cx="118" cy="71" r="9" fill={paper} stroke={ink} /><circle cx="139" cy="71" r="9" fill={paper} stroke={ink} /><path d="M118 70v2m21-2v2m-20 17 18-1" stroke={ink} strokeWidth="3" /></>
      default: return null
    }
  })()
  return <svg viewBox="0 0 320 200" className="size-full" aria-hidden="true" data-style-preview={styleId}>
    <defs>
      <linearGradient id={`${uid}-sky`} x2=".8" y2="1"><stop stopColor={paper} /><stop offset="1" stopColor={night ? ink : secondary || paper} /></linearGradient>
      <radialGradient id={`${uid}-orb`} cx=".3" cy=".2"><stop stopColor={pale || '#fff6d0'} /><stop offset=".5" stopColor={accent} /><stop offset="1" stopColor={ink} /></radialGradient>
      <pattern id={`${uid}-dots`} width={number === 21 ? 15 : 5} height={number === 21 ? 15 : 5} patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r={number === 21 ? 4 : 1} fill={ink} opacity=".35" /></pattern>
      <pattern id={`${uid}-tiles`} width="9" height="8" patternUnits="userSpaceOnUse"><rect x=".6" y=".6" width="7.6" height="6.6" rx="1" fill="none" stroke={paper} strokeWidth="1.3" /></pattern>
      <pattern id={`${uid}-grain`} width="37" height="31" patternUnits="userSpaceOnUse"><path d="M3 8h1m14-5h2m12 8h1M8 25h2m14-4h1m11 9h1" stroke={ink} strokeWidth=".7" opacity=".15" /></pattern>
      <clipPath id={`${uid}-crop`}><rect width="320" height="200" /></clipPath>
    </defs>
    <g clipPath={`url(#${uid}-crop)`}>
      <rect width="320" height="200" fill={night || [6, 24, 32].includes(number) ? `url(#${uid}-sky)` : paper} />
      {motif || (night ? <>
        <circle cx="238" cy="55" r="38" fill={`url(#${uid}-orb)`} />
        <path d="M0 148H320M0 170H320M0 197H320M160 125 0 200M160 125 70 200M160 125 250 200M160 125 320 200" fill="none" stroke={accent} strokeWidth="1.3" opacity=".6" />
        <ellipse cx="128" cy="105" rx="78" ry="25" transform="rotate(-31 128 105)" fill="none" stroke={secondary} strokeWidth="14" />
        <circle cx="128" cy="105" r="36" fill={`url(#${uid}-orb)`} />
        <path d="m46 41 7 0m-3-4v8m225 92h8m-4-4v8" stroke={pale || paper} strokeWidth="2" />
      </> : geometry ? <>
        <circle cx="241" cy="49" r="31" fill={accent} />
        <path d="M0 161 111 24 130 200H0Z" fill={ink} />
        <path d="M127 151 242 84 283 200H136Z" fill={secondary} />
        <rect x="81" y="70" width="70" height="94" rx={number === 30 ? 34 : 0} fill={accent} transform="rotate(18 116 117)" />
        <path d="M84 143q38-52 77-39t81-24" fill="none" stroke={pale || paper} strokeWidth={number === 31 ? 10 : 5} />
        <circle cx="154" cy="92" r="18" fill={pale || paper} />
        {number === 11 && <path d="m17 0 173 105L127 0m63 105 130-87-75 182Z" fill={secondary} opacity=".4" />}
        {number === 22 && <path d="M-10 50 309 121 282 156-292 35Z" fill={accent} />}
      </> : pixel ? <>
        <path d="M0 126h32v-17h24v-19h29v22h28v21h34v-41h25v-21h31v38h41v-19h26v38h50v72H0Z" fill={ink} />
        <path d="M0 170h320v30H0Z" fill={accent} /><path d="M0 170h320" stroke={secondary} strokeWidth="8" />
        <path d="M128 84h32v16h16v32h-16v32h-32v-16h-16v-32h16Z" fill={secondary} />
        <path d="M144 100h8v8h-8Z" fill={ink} /><path d="M69 57h16v16H69Zm159-20h16v16h-16Z" fill={pale || paper} />
      </> : <g>
        <path d="M0 132Q48 88 96 122T191 106T320 119V200H0Z" fill={secondary} opacity=".55" />
        <circle cx="241" cy="46" r={number === 23 ? 36 : 26} fill={accent} />
        <path d="M0 160Q85 145 166 163T320 152V200H0Z" fill={ink} opacity={number === 17 ? '.13' : '.3'} />
        <path d="M112 103Q105 143 122 167H171Q192 138 180 103Z" fill={number === 3 ? ink : accent} stroke={outline ? ink : 'none'} strokeWidth={number === 31 ? 6 : 2.5} />
        <ellipse cx="146" cy="103" rx="36" ry="8" fill={ink} />
        <path d="M148 103Q146 66 128 35M148 102Q171 64 198 49M147 91Q123 79 96 74" fill="none" stroke={ink} strokeWidth={number === 17 ? 4 : 3} />
        <path d="M137 59Q101 62 103 33Q133 28 137 59M163 79Q159 42 193 41Q202 68 163 79M123 83Q94 102 82 77Q102 64 123 83" fill={number === 17 ? ink : secondary} stroke={outline ? ink : 'none'} strokeWidth="2.5" />
        <path d="M129 116v34m12-33v37" stroke={pale || paper} strokeWidth="3" opacity=".55" />
        {[2, 3, 5, 10, 18, 20, 34].includes(number) && <>
          <path d="M14 184V19h292v165Z" fill="none" stroke={ink} strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => <path key={i} d={`m${22 + i * 24} 177 6-7 6 7-6 7Z`} fill={accent} />)}
        </>}
        {number === 23 && <path d="M221 54q36-8 31 16l-9 38q-11 13-15-6l4-31Z" fill={pale || paper} stroke={ink} strokeWidth="2" />}
        {[6, 24, 32].includes(number) && <path d="M0 18 75 0 220 200H147Z" fill={pale || paper} opacity=".22" />}
      </g>)}
      {brush && Array.from({ length: 36 }, (_, i) => <path key={i} d={`M${(i * 73) % 320} ${(i * 37) % 200}q12 -7 24 2`} fill="none" stroke={[paper, accent, secondary, ink][i % 4]} strokeWidth={number === 9 ? 3 : 1.5} opacity=".24" />)}
      {dots && <rect width="320" height="200" fill={`url(#${uid}-dots)`} />}
      {mosaic && <rect width="320" height="200" fill={`url(#${uid}-tiles)`} />}
      {!pixel && !night && <rect width="320" height="200" fill={`url(#${uid}-grain)`} />}
      <title>{style.name} · studi material {symbol}</title>
    </g>
  </svg>
}
