# Reference production upgrade — 17 October 2026

Reference corpus: 47 submitted files, SHA-256 verified against retained analysis; 45 unique videos (V10/V09 and V33/V32 duplicate pairs). 138,999 frames were decoded by the retained metric pass; visual evidence is 1,179 periodic samples plus three dense motion windows per unique video. This is not a claim of manual inspection of every frame. Transcript text is ASR and facts require independent verification before publishing new stories.

Production direction uses existing recorded narration timing, saved director shots, separate asset generation, pose/keyframe/mask/IK tracks and special clips. New motion choices back-out and spring use one shared preview/export interpolation implementation, clamped to supported transform bounds. Existing easing behavior is preserved. Use these curves sparingly for entrances/reactions; stable contacts should use linear/hold or authored IK.

Cutout includes a measurable shot/frame inspector with start/mid/end and single-frame stepping. It reports planned/generated images and track counts; geometric samples cannot certify identity, alpha quality, occlusion accuracy or medical content.

Export includes a frame-aligned half-open In/Out range. Video rendering is restricted to intersecting clip segments and any predecessor needed for a transition; audio, overlays and captions retain global timing before cropping. SRT timestamps start at zero and are bounded to the selected duration. Cutout-only clips count as valid visual sources. This does not change clip timing or narration assets.

Filmcraft provenance: local v0.8.0 source, crates/render/src/transitions/motion.rs back_out and spring functions (111–124), adapted to TypeScript; MIT notice is in licenses/filmcraft-MIT.txt. Range export design was studied at crates/export/src/lib.rs export_range (1724–1742), then implemented for Naraflow's existing renderer. Filmcraft's runtime/engine is not linked into Naraflow. No guarantee of identical video, automatic photo rigging, lip sync or automatic tracking is implied.
