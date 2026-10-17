export { STICKMAN_MASTER_SOURCE_TEXT } from './stickman-source'

export const STICKMAN_SUBJECT_NICHES = [
  'Ancient Humans', 'Human Evolution', 'Ancient History', 'Weird History',
  'Science', 'Psychology', 'Animals', 'Space', 'Survival', 'Technology',
  'Civilization', 'Dark History'
] as const

export const STICKMAN_DURATION_OPTIONS_SEC = [180, 480, 720, 1200]

export const STICKMAN_STYLE_BLOCK = 'True 2D hand-drawn stickman animation: simple round white head, tiny black eyes, one simple mouth, thin black stick torso, thin black stick arms and legs, simple hands and feet, minimal anatomy, consistent clean black linework and line weight. Flat simple colors and minimal shading. Clothing, small accessories, main prop and posture distinguish roles while the thin stick structure remains clearly visible. Never realistic humans or anatomy, detailed normal cartoon bodies, anime, manga, Pixar, Disney, 3D, photorealism or realistic material textures. No baked-in text, captions, logos or watermark.'

export const STICKMAN_RESEARCH_DIRECTION = [
  'CURRENT APP STAGE: research only. Generate exactly ten original, specific documentary video topics within the selected subject/niche. Each needs an accessible central question or mystery, a concrete narrative journey and meaningful stickman visual storytelling, with enough depth for a 3–20 minute documentary. Prefer a natural Why, How, What or When framing when it fits; avoid generic titles, fake suspense and unsupported sensational claims.',
  'Verify important factual claims with primary sources when web research is available; distinguish established evidence, disputes and uncertainty. Never invent dates, discoveries, studies, quotations, measurements or audience metrics. Editorial potential scores are estimates, not measured popularity or a viral guarantee.',
  'Return only the topic data requested by the application schema. Topic selection is a separate user action. Duration is selected after the topic, with suggested 3, 8, 12 and 20 minute choices and the application custom-duration control. Script, recurring character identification, identity sheets and scene visuals happen only in their later reviewed stages. Do not produce them during research or ask chat questions when the app already supplies the niche.'
].join('\n\n')

export const STICKMAN_SCRIPT_DIRECTION = [
  'CURRENT APP STAGE OVERRIDE: the user has already selected a topic and duration. Write only the original finished narration and story fields required by the application schema; do not regenerate ten topics or ask for topic/duration again. Use paragraph-style narration without timestamps, one-sentence-per-line formatting or headings read aloud. Analyze any supplied script references for general structure, rhythm, curiosity loops and delivery, never copy their distinctive wording.',
  'Narrative progression: immediate curiosity hook, clear central question, necessary context, discovery, problem, solution, new problem, larger consequence, relevant modern connection and an earned final insight. Use fact → explanation → significance → consequence, varied sentence lengths, conversational narration and natural changes in curiosity. Each paragraph moves the argument forward; no filler, repeated facts or invented evidence.',
  'The user explicitly requested an opening hook within the first three seconds and a closing CTA. Preserve those requests as user overrides: make the hook concrete, accurate and directly related to the central question, and finish with a concise relevant CTA after the earned final insight. Do not remove the CTA because the reference discourages unsolicited generic CTAs.',
  'Respect the exact selected app duration, including custom durations, and the supplied narration word budget. The source ranges are approximate: 3 minutes 400–500 words; 8 minutes 1,000–1,200; 12 minutes 1,500–1,800; 20 minutes 2,500–3,000. Prefer natural narration over artificial stretching. Preserve factual qualification and a coherent narrative before creating characters or visual prompts in subsequent stages.',
  'Prioritize factual accuracy: never invent discoveries, dates, studies, people, quotations, historical events, measurements or statistics. Verify important claims with reliable primary sources when available. Phrase limited or disputed evidence appropriately; speculation is not an established fact. Use the general narrative technique of references rather than copying sentences, paragraphs or distinctive expressions.'
].join('\n\n')

/** Direct image-generation rules, without cast-planning or JSON-output instructions. */
export const STICKMAN_CHARACTER_SHEET_DIRECTION = [
  STICKMAN_STYLE_BLOCK,
  'For each identity-sheet prompt, independently describe the full character, role, personality, small costume pieces, accessories, main prop and distinctive visual identity. Include full-body front, left-side, right-side, back, three-quarter front and three-quarter back views; neutral, walking, running, sitting, thinking, relaxed, dramatic and story-specific action poses; holding and using the main prop; face close-ups for neutral, smiling, happy, angry, sad, worried, scared, surprised, confused, determined, tired and laughing. The same head, face, proportions, clothing, accessories, prop and linework persist in every view and pose. Use a PURE WHITE BACKGROUND ONLY for character sheets, without scenery, furniture, gradients, textures or other characters; no written labels.',
  'A general style reference supplied while designing a new identity guides stickman drawing style only, without copying its person, face, clothes or pose. Once a character sheet is reviewed and supplied as the identity master, it becomes the exact character source of truth for every later image and video; keep that established identity rather than redesigning it.'
].join('\n\n')

/** Structured cast planning uses the sheet requirements as identity-design guidance. */
export const STICKMAN_CHARACTER_DIRECTION = [
  'CURRENT APP CAST STAGE: read the complete reviewed story first. Identify only important recurring actors, antagonists and supporting roles that actually participate. Plan at most five recurring characters, fewer when the story needs fewer; never invent irrelevant characters merely to reach five or create identity sheets for insignificant background people. Return the character data requested by the application schema. Preserve existing reviewed names, identities and assets.',
  STICKMAN_CHARACTER_SHEET_DIRECTION
].join('\n\n')

export const STICKMAN_IMAGE_DIRECTION = [
  STICKMAN_STYLE_BLOCK,
  'Create one finished narration-specific storyboard frame, not a character sheet, collage of views, contact sheet or slideshow. Use the provided reviewed STICKMAN CHARACTER SHEET as the exact visual identity reference for each recurring actor: keep the head, face, eyes, mouth, thin stick structure, proportions, clothes, accessories, prop and line style. Change only the contextual pose, gaze and simple expression needed for this reviewed action.',
  'Show the actual narrated action with clear physical body language and a relevant supporting object. Use a simple readable story environment and a stable wide, medium or full-body composition that fills the selected format. The pure-white-background rule belongs to identity sheets; story frames use the simple environment actually required by narration. Preserve location, weather, time of day, prop ownership and actor position until the story changes them. No unnecessary people, objects, animals, decorations or invented dramatic events.'
].join('\n\n')

export const STICKMAN_VIDEO_DIRECTION = [
  'CURRENT APP VIDEO STAGE: use the reviewed narration section exactly as supplied, without rewriting its wording or meaning. Each generated source clip is one continuous uninterrupted 10-second clean 2D stickman shot; source-video length is independent of the final narration-based editing duration. Use the provided reviewed STICKMAN CHARACTER SHEET for the exact design and maintain appearance throughout the entire shot.',
  STICKMAN_STYLE_BLOCK,
  'Describe CHARACTER, ACTION, EXPRESSION, ENVIRONMENT, CAMERA, MOTION, STYLE and CONTINUITY for this section. Stage one main physical action, one relevant supporting action and one meaningful ending; roughly 0–2 seconds establish, 2–6 seconds continue, 6–10 seconds complete or react, all within the same uninterrupted shot. A source section usually corresponds to about 15–25 spoken words, with natural exceptions for speaking speed and complexity. Do not cram multiple unrelated events into ten seconds.',
  'Camera is locked throughout: stable wide, medium or full-body framing, no zoom in or out, pan, tilt, dolly, orbit, shake, reframing, rapid camera movement, multiple angles or perspective changes. No cuts, scene changes, montage, slideshow, whip pans, flash or spin transitions inside the generated clip. Visual interest comes from clear physical acting and simple expression changes, with natural pauses and holds rather than constant movement.',
  'Keep the same actor identity, clothing, accessory, prop, setting, time, weather and screen position from the previous section wherever the narration continues the same action or location; the ending logically connects to the next section. Change location only when the story actually changes it. Never add irrelevant actors or objects, visual clutter or events that contradict narration. Generate only this continuous animated shot. Narration and audio are handled separately by Naraflow, not generated as speech in this clip. No spoken dialogue, voice-over, music, subtitles, text, logos or watermark.'
].join('\n\n')

export const STICKMAN_VISUAL_DIRECTION = [
  'CURRENT APP VISUAL PLANNING STAGE: read the complete reviewed story and use its existing reviewed cast. Do not rewrite narration or invent replacement character identities. Translate each supplied narration section into a clear physical action, simple expression, relevant environment, stable composition and continuity with adjacent sections. Character sheets and contextual scene prompts are separate outputs.',
  STICKMAN_IMAGE_DIRECTION,
  'Plan each source-video prompt as one continuous uninterrupted 10-second shot. Keep the supplied narration wording and meaning; a section normally fits about 15–25 spoken words with natural exceptions. Describe CHARACTER, ACTION, EXPRESSION, ENVIRONMENT, CAMERA, MOTION, STYLE and CONTINUITY. Use one main physical action, one relevant supporting action and one clear ending, with establish → continue → complete or react as an unbroken sequence.',
  'Use the reviewed character sheet as the exact identity source in every scene and video prompt. Keep props, actor position, environment, time and weather coherent across consecutive sections of the same action/location. Change location only when the story changes it. Backgrounds stay simple and relevant; no extra cast or props, fabricated events, decorative clutter, montage, slideshow, cuts or scene changes inside the clip.',
  'Camera remains locked for the entire source shot: stable wide, medium or full-body composition, no zoom, pan, tilt, dolly, orbit, shake, reframing or multiple angles. Natural pauses and pose holds are allowed; story clarity takes precedence over constant movement. Narration/audio are supplied separately by the application. Produce only the requested structured scene data, with no interactive questions.'
].join('\n\n')
