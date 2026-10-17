import { useId, type ReactNode } from 'react'
import collagePhoto from '../assets/styles/collage.webp'
import archivalPhoto from '../assets/styles/archival.webp'
import documentaryPhoto from '../assets/styles/documentary.webp'
import cinematicPhoto from '../assets/styles/cinematic.webp'

const PRESET_IDS = new Set([
  'vox-paper',
  'motion-collage', 'motion-journalism', 'motion-catalog', 'motion-engraving', 'motion-continuous', 'motion-stage',
  'cutout-photo', 'cutout-paper', 'cutout-editorial', 'cutout-vintage', 'cutout-cinematic',
  'health-organs', 'health-cells', 'health-stage', 'health-diagram', 'health-comic'
])

export function hasStylePresetArt(styleId: string): boolean { return PRESET_IDS.has(styleId) }

const INK = '#263047'

function Face({ x = 0, y = 0, surprised = false, look = 0 }: { x?: number; y?: number; surprised?: boolean; look?: number }) {
  return <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="1.8" strokeLinecap="round">
    <ellipse cx="-8" cy="-4" rx="6" ry="8" fill="#fff" /><ellipse cx="8" cy="-4" rx="6" ry="8" fill="#fff" />
    <ellipse cx={-7 + look} cy="-3" rx="2.8" ry="4" fill={INK} stroke="none" /><ellipse cx={9 + look} cy="-3" rx="2.8" ry="4" fill={INK} stroke="none" />
    {surprised ? <ellipse cx="1" cy="15" rx="5" ry="6" fill="#633045" /> : <path d="M-8 11 Q1 24 11 10 Q2 15-8 11Z" fill="#633045" />}
  </g>
}

function Heart({ x, y, size = 1, surprised = false }: { x: number; y: number; size?: number; surprised?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} stroke={INK} strokeWidth="3.4" strokeLinejoin="round">
    <path d="M-7-31-9-51 5-53 12-29M12-29 23-47 34-40 23-19" fill="#e8889c" />
    <path d="M1 46C-13 36-44 20-45-6C-46-28-29-42-13-31C-7-48 19-43 33-25C50-2 32 28 1 46Z" fill="#f8819e" />
    <path d="M-32-20C-27-33-18-31-15-25M-31-12-32-5" fill="none" stroke="#ffd9df" strokeWidth="5" strokeLinecap="round" />
    <path d="M12-32C43-5 28 28 1 43C19 35 45 10 38-9Z" fill="#d9537d" stroke="none" />
    <Face x={-1} y={-1} surprised={surprised} />
  </g>
}

function Cell({ x, y, size = 1, color = '#a5dae2', surprised = false }: { x: number; y: number; size?: number; color?: string; surprised?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} stroke={INK} strokeWidth="3">
    <path d="M-38-27C-20-48 17-42 36-24C53-8 40 27 17 39C-4 48-41 30-43 8C-47-8-45-18-38-27Z" fill={color} />
    <path d="M-31-23Q-15-38 6-33M-35-14-37-7" fill="none" stroke="#ffffff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="-21" cy="15" rx="10" ry="7" fill="#7d82b6" stroke="none" opacity=".45" />
    <circle cx="23" cy="-15" r="3" fill="#758bab" stroke="none" /><circle cx="29" cy="9" r="3" fill="#758bab" stroke="none" />
    <Face x={1} y={-1} surprised={surprised} />
  </g>
}

function Kidney({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} stroke={INK} strokeWidth="3.2" strokeLinecap="round">
    <path d="M17 19Q28 35 20 48" fill="none" stroke="#eab56c" strokeWidth="7" />
    <path d="M19-34C-14-48-43-25-39 9C-36 42-2 49 21 29C34 17 18 9 12 3C4-8 38-17 19-34Z" fill="#b57dd5" />
    <path d="M-26-18Q-14-35 2-31" fill="none" stroke="#ebc9f7" strokeWidth="5" />
    <Face x={-14} y={-5} look={1} />
  </g>
}

function Tree({ x, y, scale = 1, fill = '#448d73' }: { x: number; y: number; scale?: number; fill?: string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0 2V37M0 13-12 2M0 20 12 9" stroke="#885c47" strokeWidth="5" strokeLinecap="round" />
    <path d="M-24 0C-31-16-17-28-8-27C-10-42 15-43 21-23C40-18 33 6 22 9C12 24-10 17-24 0Z" fill={fill} />
    <path d="M-14-20Q-4-34 8-27" fill="none" stroke="#91b793" strokeWidth="4" strokeLinecap="round" />
  </g>
}

function PhotoFigure({ src, prefix, x = 160, y = 18, width = 126, height = 158, paper = '#fff8e9', opacity = 1 }: { src: string; prefix: string; x?: number; y?: number; width?: number; height?: number; paper?: string; opacity?: number }) {
  const silhouette = 'M42 8 51 3 69 5 78 17 78 41 91 54 96 73 101 120 98 151 18 153 10 130 14 93 20 65 36 51 35 29Z'
  return <g transform={`translate(${x - width / 2} ${y}) scale(${width / 110} ${height / 156})`} opacity={opacity}>
    <defs><clipPath id={`${prefix}-figure`}><path d={silhouette} /></clipPath></defs>
    <path d={silhouette} fill={paper} stroke={paper} strokeWidth="8" strokeLinejoin="round" filter={`url(#${prefix}-shadow)`} />
    <image href={src} x="-2" y="0" width="112" height="156" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${prefix}-figure)`} />
    <path d={silhouette} fill="none" stroke={paper} strokeWidth="2" strokeLinejoin="round" />
  </g>
}

function MotionArt({ styleId, prefix }: { styleId: string; prefix: string }): ReactNode {
  switch (styleId) {
    case 'motion-collage': return <>
      <rect width="320" height="180" fill="#f1e9d6" />
      <path d="M0 32 34 22 74 28 98 16 126 24 179 12 213 19 250 11 320 18V140H0Z" fill="#abd3c4" />
      <circle cx="239" cy="46" r="25" fill="#f4a65d" /><path d="M0 139 28 131 65 143 113 132 155 144 201 133 239 143 285 131 320 136V180H0Z" fill="#cf775a" />
      <path d="M39 112V71L70 56 102 76V124" fill="#ead9a5" stroke="#484a41" strokeWidth="2" /><path d="M72 60V124M49 86H61M83 93H94M49 103H61" stroke="#7a906f" strokeWidth="5" />
      <Tree x={251} y={113} scale={1.2} fill="#527f69" />
      <g transform="translate(157 58) rotate(-7)" filter={`url(#${prefix}-shadow)`}>
        <path d="M-19 48-12 75-20 97M8 49 18 75 29 92" fill="none" stroke="#2e5666" strokeWidth="13" strokeLinecap="round" />
        <path d="M-22 20-38 37-46 17M14 23 36 34 42 9" fill="none" stroke="#edb69b" strokeWidth="8" strokeLinecap="round" />
        <path d="M-21 8Q-6 0 13 12L18 51-26 53Z" fill="#f4bd4f" stroke="#fff5da" strokeWidth="3" />
        <circle cx="-5" cy="-4" r="19" fill="#efb194" stroke="#fff5da" strokeWidth="3" /><path d="M-25-7Q-19-31 0-26Q13-23 14-8L-8-14Z" fill="#323b43" />
        <circle cx="-7" cy="-3" r="2" fill="#323b43" /><path d="M0 5 8 1" stroke="#323b43" strokeWidth="2" />
      </g>
      <path d="M208 91Q197 59 185 43" fill="none" stroke="#fff7e3" strokeWidth="4" strokeDasharray="5 5" /><path d="M177 46 185 32 194 44" fill="none" stroke="#fff7e3" strokeWidth="4" />
      <rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".2" />
    </>
    case 'motion-journalism': return <>
      <rect width="320" height="180" fill="#183d4a" /><path d="M0 156 100 119 226 154 320 126V180H0Z" fill="#315860" />
      <g transform="translate(44 20) rotate(-8 85 67)" filter={`url(#${prefix}-shadow)`}>
        <rect width="153" height="129" rx="2" fill="#eee9db" /><path d="M17 18H131M17 26H86" stroke="#496577" strokeWidth="4" />
        <path d="M25 52 41 42 59 49 74 40 99 53 120 51 116 70 101 82 102 98 81 109 67 92 41 88 34 72 20 68Z" fill="#a5bdab" />
        <path d="M40 64 75 78 98 65 85 97" fill="none" stroke="#e36858" strokeWidth="3" /><circle cx="75" cy="78" r="5" fill="#e36858" stroke="#fff" strokeWidth="2" />
        <path d="M17 116H69M112 114H137" stroke="#bdc8bf" strokeWidth="3" />
      </g>
      <g transform="rotate(8 207 101)" filter={`url(#${prefix}-shadow)`}>
        <rect x="158" y="41" width="97" height="115" fill="#faf5e5" /><image href={documentaryPhoto} x="163" y="46" width="87" height="92" preserveAspectRatio="xMidYMid slice" />
        <path d="M173 147H239" stroke="#394e51" strokeWidth="3" />
      </g>
      <path d="M139 108 158 92M241 47 265 30" stroke="#eaa95f" strokeWidth="2" strokeDasharray="4 3" /><circle cx="266" cy="29" r="8" fill="#e36858" /><path d="M268 25 264 31" stroke="#fff" strokeWidth="2" />
    </>
    case 'motion-catalog': return <>
      <rect width="320" height="180" fill="#f5f7ef" /><path d="M0 138H320V180H0Z" fill="#e9eddf" />
      <ellipse cx="163" cy="150" rx="84" ry="14" fill="#c5caba" opacity=".6" />
      <g transform="translate(109 74)" filter={`url(#${prefix}-shadow)`}>
        <path d="M0 2 13-10H110V69L98 83H0Z" fill="#93b1a7" /><path d="M0 2H98V83H0Z" fill={`url(#${prefix}-mint)`} /><path d="M98 2 110-10V69L98 83Z" fill="#6b9085" />
        <rect x="8" y="11" width="29" height="18" rx="3" fill="#eef1d4" /><circle cx="68" cy="43" r="27" fill="#325552" /><circle cx="68" cy="43" r="18" fill="#1b3e42" /><circle cx="67" cy="41" r="10" fill="#72aab0" /><ellipse cx="62" cy="35" rx="4" ry="5" fill="#e4f6ef" opacity=".8" />
        <rect x="9" y="62" width="27" height="7" rx="2" fill="#ebdda7" /><path d="M5 5H89" stroke="#e3eedc" strokeWidth="3" />
      </g>
      <g transform="translate(232 59) rotate(11)"><path d="M-12 38V12C-12-14 25-15 25 12V39" fill="none" stroke="#e9b684" strokeWidth="9" /><path d="M-12 29V50M25 29V50" stroke="#836b55" strokeWidth="12" strokeLinecap="round" /></g>
      <g transform="translate(76 110)"><ellipse cy="36" rx="24" ry="6" fill="#c9ccbc" /><path d="M0 3V30M-13 31H14" stroke="#738c81" strokeWidth="4" /><circle r="24" fill={`url(#${prefix}-globe)`} /><path d="M-16-12-6-19 4-10 2 3-9 7-14 0M12 5 22 2 18 15 8 18 6 10Z" fill="#89a779" /></g>
      <path d="M68 43H85M76 35V51" stroke="#b6c2a6" strokeWidth="2" /><circle cx="179" cy="41" r="4" fill="#d3b27d" />
    </>
    case 'motion-engraving': return <>
      <rect width="320" height="180" fill="#e8d7b3" /><rect x="13" y="12" width="294" height="156" fill="none" stroke="#785d3e" strokeWidth="1" />
      <path d="M20 144 65 90 89 122 126 60 181 140 231 83 301 144Z" fill="#d2bd93" stroke="#785d3e" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${22 + i * 9} 145l${23 + i * 2}-${30 + (i % 4) * 12}M${180 + i * 8} 147l-${15 + i}-${17 + (i % 5) * 5}`} fill="none" stroke="#886b47" strokeWidth=".7" />)}
      <g transform="translate(165 74)"><circle r="43" fill="#eddfc0" stroke="#6e533b" strokeWidth="2" />
        {[0, 1, 2, 3, 4].map((n) => <ellipse key={n} rx={7 + n * 8} ry="42" fill="none" stroke="#927552" strokeWidth=".8" />)}
        {[-26, -13, 0, 13, 26].map((n) => <path key={n} d={`M-40 ${n}Q0 ${n + 15} 40 ${n}`} fill="none" stroke="#927552" strokeWidth=".8" />)}
        <path d="M-18-31-5-35 2-25 16-19 11-7 2-3-1 9-12 3-22-9-30-11ZM21 12 35 9 28 28 16 34 12 24Z" fill="#ad9673" stroke="#6e533b" strokeWidth="1" />
      </g>
      <path d="M127 131H213M139 136H201M146 143H194M151 122V132M187 118V132" stroke="#6e533b" strokeWidth="2" />
      <g stroke="#8d7050" strokeWidth=".8"><circle cx="71" cy="44" r="16" fill="none" /><path d="M51 39H92M58 30 83 57M59 56 83 31M247 24V60M230 42H266M233 29 261 55M233 55 261 29" /></g>
      <rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".35" />
    </>
    case 'motion-continuous': return <>
      <rect width="320" height="180" fill="#cae8e2" /><path d="M0 109Q60 52 125 96T250 88T340 99V180H0Z" fill="#97bb94" />
      <path d="M0 167Q63 167 94 129T177 107T226 134T330 100" fill="none" stroke="#f0dba9" strokeWidth="27" /><path d="M0 167Q63 167 94 129T177 107T226 134T330 100" fill="none" stroke="#e9cba0" strokeWidth="2" strokeDasharray="5 5" />
      <Tree x={60} y={87} scale={.7} /><Tree x={268} y={79} scale={1.1} />
      <g transform="translate(117 103) rotate(-7)" filter={`url(#${prefix}-shadow)`}><rect width="86" height="38" rx="8" fill="#ea7352" /><path d="M9 8H74V24H9Z" fill="#d9ede1" /><path d="M29 8V24M51 8V24" stroke="#ad664a" strokeWidth="3" /><circle cx="19" cy="39" r="8" fill="#304e50" /><circle cx="68" cy="39" r="8" fill="#304e50" /><path d="M7 30H76" stroke="#fbc482" strokeWidth="3" /></g>
      <g transform="translate(222 96)"><path d="M-14 0V-25L4-40 24-25V0Z" fill="#e7dcad" /><path d="M-19-23 4-43 28-23" fill="none" stroke="#bc6a50" strokeWidth="6" /><path d="M0-1V-20H12V-1" fill="#679395" /></g>
      <path d="M107 33h28q4-15 16-12 11 1 13 12h16q5 0 5 6H101q0-6 6-6Z" fill="#f2f8ef" /><path d="M204 42 221 29 220 42 233 45 219 49 215 60 211 48 200 46Z" fill="#e99a66" />
    </>
    case 'motion-stage': return <>
      <rect width="320" height="180" fill="#8fcacc" /><path d="M0 141 159 124 320 141V180H0Z" fill="#efbc71" /><path d="M0 155 159 137 320 156M81 180 159 137 239 180" fill="none" stroke="#d5975d" strokeWidth="2" />
      <path d="M0 0H66L44 44 26 58 17 112H0ZM320 0H254L276 44 294 58 303 112H320Z" fill="#cf6676" /><path d="M0 5Q158 32 320 5V0H0Z" fill="#ba5267" />
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="translate(157 85)">
        <path d="M-17 34-25 59-11 63M9 34 27 49 42 46" fill="none" strokeWidth="7" /><path d="M-27-8-48 2-47-19M24-8 42-24 52-21" fill="none" strokeWidth="5" />
        <rect x="-28" y="-38" width="57" height="73" rx="17" fill="#f3d279" /><path d="M-17-26H17" stroke="#fff2ba" strokeWidth="5" /><Face y={-4} />
      </g>
      <circle cx="226" cy="132" r="18" fill="#f28d7f" stroke={INK} strokeWidth="2.5" /><path d="M212 121Q226 128 224 149M212 142Q227 130 240 130" fill="none" stroke="#d56b77" strokeWidth="2" />
      <path d="m219 42 4 11 12 1-9 8 3 12-10-7-10 7 3-12-9-8 12-1Z" fill="#ffe594" stroke="#507e84" strokeWidth="2" /><path d="M84 58 90 46M101 65 111 59" stroke="#fff4d6" strokeWidth="4" strokeLinecap="round" />
    </>
  }
  return null
}

function CutoutArt({ styleId, prefix }: { styleId: string; prefix: string }): ReactNode {
  switch (styleId) {
    case 'cutout-photo': return <>
      <rect width="320" height="180" fill="#b6d7d7" /><image href={documentaryPhoto} width="320" height="180" opacity=".18" preserveAspectRatio="xMidYMid slice" />
      <path d="M0 92 47 83 94 88 143 77 208 94 261 83 320 91V180H0Z" fill="#8bb8b7" /><path d="M0 133 43 122 82 137 122 127 176 140 221 129 268 140 320 128V180H0Z" fill="#ead8b4" />
      <path d="M44 0 49 132M42 23 99 47 48 54Z" fill="#e7e2ca" stroke="#526f77" strokeWidth="3" /><circle cx="257" cy="36" r="23" fill="#f1c58e" />
      <PhotoFigure src={documentaryPhoto} prefix={prefix} width={128} height={158} />
      <path d="M0 165 29 142 73 168 109 158 135 180H0ZM229 180 259 140 285 160 320 153V180Z" fill="#537f7a" />
      <path d="M0 174 47 159 78 178M243 174 287 162 320 174" fill="none" stroke="#b9cfba" strokeWidth="3" />
    </>
    case 'cutout-paper': return <>
      <rect width="320" height="180" fill="#ede1c6" /><path d="M0 25 41 17 69 25 102 12 140 22 174 8 211 14 256 6 293 15 320 10V119L281 116 251 126 215 118 179 127 148 119 119 131 81 121 42 130 0 119Z" fill="#f8f0d9" />
      <path d="M0 110 25 95 62 108 83 99 110 107 144 96 175 106 211 91 253 108 280 99 320 110V180H0Z" fill="#94b5a6" />
      <circle cx="227" cy="57" r="42" fill="#c87859" /><path d="M215 30 248 36 236 88 205 84Z" fill="#e8b57c" transform="rotate(15 225 57)" />
      <PhotoFigure src={collagePhoto} prefix={prefix} x={157} width={129} height={160} paper="#fbf4df" />
      <path d="M23 146 69 130 93 146 89 170 28 177Z" fill="#ddbd8c" /><path d="M38 146 68 137M35 155 77 147M40 163 69 155" stroke="#b39469" strokeWidth="2" />
      <rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".32" />
    </>
    case 'cutout-editorial': return <>
      <rect width="320" height="180" fill="#efece4" /><path d="M0 23 71 12 84 76 21 93 0 69ZM215 0 320 0 320 151 277 159 252 77 212 57Z" fill="#252932" />
      <circle cx="172" cy="80" r="64" fill="#df5f54" /><path d="M12 114H120V155H12Z" fill="#b1beb8" transform="rotate(-14 66 134)" />
      <g stroke="#b6b8b0" strokeWidth="1"><path d="M28 18V96M42 16V91M56 14V85M18 33H80M18 50H82M18 68H84" /><path d="M242 150H303M249 157H314M261 164H303" /></g>
      <PhotoFigure src={collagePhoto} prefix={prefix} x={158} y={13} width={123} height={163} paper="#fffbed" />
      <path d="M227 116 259 100 253 93 283 96 272 123 266 115 236 132Z" fill="#ee7164" stroke="#fff6e6" strokeWidth="3" />
      <path d="M64 155 88 141 99 151 89 166Z" fill="#282e36" /><rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".16" />
    </>
    case 'cutout-vintage': return <>
      <rect width="320" height="180" fill="#d9c19b" /><image href={archivalPhoto} width="320" height="180" opacity=".24" preserveAspectRatio="xMidYMid slice" />
      <g transform="rotate(-7 88 87)"><rect x="23" y="30" width="132" height="118" fill="#efe3c6" filter={`url(#${prefix}-shadow)`} /><path d="M37 48H104M37 56H122M37 64H89M37 118H138M37 126H109" stroke="#b9a381" strokeWidth="3" /><path d="M50 100 80 82 111 96 94 105 77 98 56 107Z" fill="#7d7562" /><circle cx="128" cy="46" r="12" fill="none" stroke="#b38d66" strokeWidth="2" /></g>
      <circle cx="236" cy="58" r="36" fill="#c59e72" /><path d="M213 36 251 39 241 81 209 73Z" fill="#e7d7b5" />
      <PhotoFigure src={archivalPhoto} prefix={prefix} x={167} y={17} width={127} height={161} paper="#f2e5c5" />
      <path d="M0 167 58 160 103 169 134 164 154 180H0ZM236 180 255 167 288 170 320 158V180Z" fill="#93816b" />
      <rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".37" /><path d="M12 8H38M7 12V39M308 9H286M312 14V38M10 165V151M307 168H286" fill="none" stroke="#eee1c5" strokeWidth="2" />
    </>
    case 'cutout-cinematic': return <>
      <rect width="320" height="180" fill="#152f40" /><image href={cinematicPhoto} width="320" height="180" opacity=".4" preserveAspectRatio="xMidYMid slice" />
      <path d="M0 114 76 79 117 93 189 71 247 90 320 64V180H0Z" fill="#1b414c" opacity=".8" /><path d="M26 0V140M276 0V153" stroke="#678b91" strokeWidth="5" />
      <g opacity=".75" fill="#ed8a70"><circle cx="59" cy="47" r="7" /><circle cx="74" cy="82" r="4" /><circle cx="249" cy="29" r="7" /></g>
      <path d="M85 6 128 6 57 179 0 180ZM262 0 282 0 212 180 167 180Z" fill="#afcfce" opacity=".14" />
      <PhotoFigure src={cinematicPhoto} prefix={prefix} x={160} y={13} width={129} height={163} paper="#7eaaa9" />
      <path d="M0 156 29 134 53 143 93 180H0ZM239 180 280 138 305 149 320 135V180Z" fill="#0b2731" />
      <path d="M0 167 33 156 57 173M260 171 295 158 320 166" stroke="#46737a" strokeWidth="3" fill="none" /><rect width="320" height="180" fill={`url(#${prefix}-vignette)`} />
    </>
  }
  return null
}

function HealthArt({ styleId }: { styleId: string }): ReactNode {
  switch (styleId) {
    case 'health-organs': return <>
      <rect width="320" height="180" fill="#f8dce6" /><circle cx="163" cy="88" r="70" fill="#fff1ed" /><path d="M0 159Q159 129 320 159V180H0Z" fill="#edbfd1" />
      <ellipse cx="160" cy="155" rx="40" ry="7" fill="#d8a3ba" opacity=".6" />
      <path d="M112 98 91 117 99 126M207 93 226 80 240 87" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <Heart x={160} y={89} size={1.15} />
      <g fill="#df9bb4"><circle cx="60" cy="50" r="6" /><circle cx="253" cy="127" r="8" /><circle cx="81" cy="139" r="3" /></g>
      <path d="M226 34V50M218 42H234M70 81V93M64 87H76" stroke="#b389af" strokeWidth="3" strokeLinecap="round" />
      <path d="M31 103 49 103 58 86 68 115 78 101H100M227 63H245L254 48 264 77 273 63H292" fill="none" stroke="#cb7d9d" strokeWidth="2.5" strokeLinejoin="round" />
    </>
    case 'health-cells': return <>
      <rect width="320" height="180" fill="#d2e8ef" /><path d="M0 54Q50 13 106 48T225 42T320 47V143Q249 118 211 148T90 133T0 152Z" fill="#ebd4ec" />
      <Cell x={65} y={128} size={.57} color="#eeb1c7" /><Cell x={263} y={47} size={.5} color="#c2aeed" surprised />
      <g stroke="#82a9bf" strokeWidth="3" strokeLinecap="round"><path d="M46 43 52 53 62 45M52 53V67M251 130 257 140 267 132M257 140V153" fill="none" /></g>
      <Cell x={159} y={92} size={1.36} color="#a1d4d9" />
      <g fill="#b691bf" stroke="#9170a4" strokeWidth="1.5"><circle cx="89" cy="46" r="5" /><circle cx="220" cy="131" r="5" /><circle cx="240" cy="90" r="4" /><circle cx="79" cy="83" r="3" /></g>
      <g fill="#f9f2ee"><circle cx="27" cy="102" r="4" /><circle cx="122" cy="157" r="5" /><circle cx="283" cy="111" r="6" /></g>
    </>
    case 'health-stage': return <>
      <rect width="320" height="180" fill="#d8ddf2" /><path d="M0 143Q159 117 320 143V180H0Z" fill="#cbbadf" /><ellipse cx="161" cy="153" rx="88" ry="11" fill="#b1a1c8" />
      <path d="M53 29H267V112H53Z" fill="#f5ecf0" stroke="#aea8cf" strokeWidth="3" /><path d="M71 90H94L108 53 122 90 132 73 140 90H176" fill="none" stroke="#d899b4" strokeWidth="3" strokeLinejoin="round" />
      <Heart x={125} y={103} size={.84} /><Kidney x={199} y={96} size={.78} />
      <path d="M154 102Q170 87 182 103M89 107 78 95 69 101M221 109 238 98" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M168 45l3 10 10 1-8 7 2 10-9-6-9 6 3-10-8-7 10-1Z" fill="#e7bd7d" stroke="#ae91b7" strokeWidth="1.5" />
    </>
    case 'health-diagram': return <>
      <rect width="320" height="180" fill="#f5e6e7" /><path d="M101 24 120 17 130 35H190L200 17 220 25 239 62 225 75 209 53 214 164H105L111 54 95 75 81 61Z" fill="#e9bcc9" stroke="#ba8f9f" strokeWidth="2.5" />
      <path d="M124 41Q159 33 196 42L202 156H117Z" fill="#f9efeb" stroke="#c9a3ae" strokeWidth="2" />
      <path d="M151 44 151 66 139 78M170 44 170 66 182 78" fill="none" stroke="#bb8fbe" strokeWidth="7" strokeLinecap="round" /><path d="M144 62C131 48 120 69 125 92Q141 102 145 83M178 62C191 48 202 69 197 92Q181 102 177 83" fill="#dbb7de" stroke="#9877a7" strokeWidth="2" />
      <Heart x={161} y={81} size={.44} />
      <g transform="translate(160 123)"><path d="M-27-15Q-38-6-25 1L23 0Q33 0 27 11L-22 12Q-31 12-24 23L25 23" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" /><path d="M-27-15Q-38-6-25 1L23 0Q33 0 27 11L-22 12Q-31 12-24 23L25 23" fill="none" stroke="#eda9b4" strokeWidth="8" strokeLinecap="round" /><Face x={2} y={1} /></g>
      <g fill="none" stroke="#bb93aa" strokeWidth="2"><path d="M130 75H81V51M191 118H239V138" /><circle cx="77" cy="47" r="10" /><circle cx="243" cy="142" r="10" /><path d="M72 47H82M77 42V52M238 142H248" /></g>
    </>
    case 'health-comic': return <>
      <rect width="320" height="180" fill="#fff0db" /><path d="M0 0H112L74 180H0ZM320 0H243L203 180H320Z" fill="#d8c9e9" /><path d="M103 0 66 180M251 0 212 180" stroke={INK} strokeWidth="3" />
      <g stroke="#d6a9af" strokeWidth="2"><path d="M156 90 130 16M163 90 171 6M169 94 221 27M168 106 216 159M159 104 125 166" /></g>
      <path d="M102 86 89 77 74 88 88 102 84 124 104 122 117 139 127 120 149 119 141 96 147 77 126 81 112 67Z" fill="#f6cb73" />
      <Heart x={159} y={91} size={1.05} surprised />
      <path d="M115 94 96 78 84 62M206 96 224 76 221 61M145 137 128 160 143 163M177 135 195 156 209 153" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <g fill="#f8819e" stroke={INK} strokeWidth="2.5"><path d="M80 64 77 55 84 53 83 43 90 44 95 61Z" /><path d="M216 66 211 54 217 51 217 41 224 40 229 60Z" /></g>
      <g fill="#dba8ba"><circle cx="35" cy="53" r="4" /><circle cx="48" cy="64" r="3" /><circle cx="286" cy="128" r="4" /><circle cx="276" cy="142" r="3" /></g>
      <path d="M59 109 68 95M260 67 273 57M269 75 286 73" fill="none" stroke="#ad8fbc" strokeWidth="4" strokeLinecap="round" />
    </>
  }
  return null
}

function VoxArt({ prefix }: { prefix: string }) {
  const torn = 'M70 21 80 19 91 22 113 18 136 21 155 17 177 20 201 18 218 23 217 45 221 66 217 86 220 111 214 138 218 154 195 153 171 158 149 154 125 157 103 153 79 157 74 136 77 113 72 92 77 71 72 49Z'
  return <>
    <defs>
      <clipPath id={`${prefix}-vox-photo`}><path d={torn} /></clipPath>
      <filter id={`${prefix}-vox-mono`}><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope="1.3" intercept="-.12" /><feFuncG type="linear" slope="1.3" intercept="-.12" /><feFuncB type="linear" slope="1.3" intercept="-.12" /></feComponentTransfer></filter>
      <pattern id={`${prefix}-vox-dots`} width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#211e19" /></pattern>
    </defs>
    <rect width="320" height="180" fill="#d9c6a5" />
    <path d="M0 13 67 10 62 29 71 44 63 75 66 102 60 129 70 151 63 180H0Z" fill="#eee1c5" />
    <g stroke="#8f806b" strokeWidth="1" opacity=".28">{Array.from({ length: 17 }, (_, i) => <path key={i} d={`M7 ${23 + i * 8}H${i % 3 === 0 ? 46 : 55}`} />)}</g>
    <path d={torn} fill="#d72421" transform="translate(6 3)" filter={`url(#${prefix}-shadow)`} />
    <path d={torn} fill="#f4ead3" stroke="#f4ead3" strokeWidth="7" strokeLinejoin="round" filter={`url(#${prefix}-shadow)`} />
    <image href={archivalPhoto} x="70" y="18" width="153" height="143" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${prefix}-vox-photo)`} filter={`url(#${prefix}-vox-mono)`} />
    <path d={torn} fill={`url(#${prefix}-vox-dots)`} opacity=".28" />
    <path d="M102 15 100 30 127 32 128 17Z" fill="#e9d7a4" opacity=".8" />
    <g transform="rotate(7 256 126)" filter={`url(#${prefix}-shadow)`}>
      <path d="M228 99 286 96 288 146 230 150Z" fill="#eadbbf" />
      <path d="M233 112 281 110M234 117 264 116M235 131 278 130M235 136 268 135" stroke="#6f6557" strokeWidth="1" opacity=".45" />
      <path d="M244 105 275 103 274 124 243 126Z" fill="none" stroke="#d72421" strokeWidth="2" />
    </g>
    <path d="M196 40Q248 28 260 105" fill="none" stroke="#d72421" strokeWidth="1.6" />
    <g fill="#ba9856" stroke="#5b4b2e" strokeWidth=".7"><circle cx="196" cy="40" r="3" /><circle cx="260" cy="105" r="3" /></g>
    <rect width="320" height="180" filter={`url(#${prefix}-grain)`} opacity=".34" />
  </>
}

/** Decorative UI illustrations of composition and treatment; these are not generated scene assets. */
export function StylePresetArt({ styleId }: { styleId: string }) {
  const prefix = `preset-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (!hasStylePresetArt(styleId)) return null
  return <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true" focusable="false" data-style-preview={styleId}>
    <defs>
      <filter id={`${prefix}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#273137" floodOpacity=".18" /></filter>
      <filter id={`${prefix}-grain`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".68" numOctaves="3" seed="8" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope=".25" /></feComponentTransfer></filter>
      <linearGradient id={`${prefix}-mint`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#cbdaca" /><stop offset=".55" stopColor="#b9ccb9" /><stop offset="1" stopColor="#90b3a4" /></linearGradient>
      <radialGradient id={`${prefix}-globe`} cx=".3" cy=".25" r=".8"><stop stopColor="#d8ecdd" /><stop offset=".6" stopColor="#94bac0" /><stop offset="1" stopColor="#547d91" /></radialGradient>
      <radialGradient id={`${prefix}-vignette`}><stop offset=".35" stopColor="#071a28" stopOpacity="0" /><stop offset="1" stopColor="#071a28" stopOpacity=".55" /></radialGradient>
    </defs>
    {styleId === 'vox-paper' ? <VoxArt prefix={prefix} /> : styleId.startsWith('motion-') ? <MotionArt styleId={styleId} prefix={prefix} /> : styleId.startsWith('cutout-') ? <CutoutArt styleId={styleId} prefix={prefix} /> : <HealthArt styleId={styleId} />}
  </svg>
}
