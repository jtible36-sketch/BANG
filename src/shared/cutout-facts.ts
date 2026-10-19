import master from './cutout-master-v6.json'
export const CUTOUT_FACT_STYLE_ID='cutout-facts'
export const CUTOUT_FACT_NAME='Cutout · Fakta & Komedi'
/** The supplied v6 document is the sole creative source for the new built-in. */
export const CUTOUT_FACT_SOURCE=master.sourceText
export const CUTOUT_FACT_NICHES=['Fakta unik','Sejarah aneh','Penemuan dan teknologi','Hewan','Sains sehari-hari','Sejarah benda','Teknologi medis']
export const CUTOUT_FACT_STYLE='Full-color photographic cutout with coherent lighting, perspective and project identity; follow masterPrompt.sourceText v6 sections 1, 6, 10 and 11. Image output contains no baked captions or labels.'
export const CUTOUT_FACT_CHARACTER='Preserve the approved project identity; use contextual poses and era-appropriate clothing according to masterPrompt.sourceText v6 sections 5 and 6.'
export const CUTOUT_FACT_DIRECTION='Follow masterPrompt.sourceText v6 sections 3–5 and 9 for shot rhythm, camera, contact and the separately selected motion profile.'
export const CUTOUT_FACT_PRODUCTION_RULES='Follow the single masterPrompt.sourceText v6 sections 4–11; use only available assets and supported schema fields.'
export function cutoutReferenceDirection(styleId:string):string{return styleId===CUTOUT_FACT_STYLE_ID?CUTOUT_FACT_DIRECTION:''}
export const CUTOUT_FACT_STAGES={
 research:'Use masterPrompt.sourceText sections 1, 2 and 6; verify claims and sources before production.',
 script:'Use masterPrompt.sourceText sections 2 and 3; actual recording determines final timing.',
 visual:'Use masterPrompt.sourceText sections 5–7, 10 and 11; return the requested scene or separated asset in the existing schema.',
 video:'Use masterPrompt.sourceText sections 3–5, 9–11; choose one primary action per shot.',
 thumbnail:'Use masterPrompt.sourceText sections 1, 5–7 for one readable subject and mechanism; requested thumbnail format takes precedence.',
 voice:'Use masterPrompt.sourceText sections 3 and 8; preserve the selected narrator and reviewed script.'
}
