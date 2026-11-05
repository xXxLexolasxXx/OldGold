# OldGold forest roster v4

Raster replacement for the artistically rejected procedural v3. This is an independent review candidate; no production index, shared mechanics, save format, git index or publication changed by this owner.

## Files and loading

Canonical root: `D:/для игры/feod/output/publish/oldgold-pages-20261104`.

1. `js/fantasy-published-forest-neutrals-v4.js` — frozen pixie representative, SHA `a99090b927974effbdbd3b57e1ca40516fe92beb9449414f68a552d82cc9d41d`.
2. `js/fantasy-published-forest-roster-v4.js` — fairy, NA leshy, leprechaun, brownie, enderman/cargo and gargoyles A/B/C. Current review SHA and all asset hashes are recorded in `manifest-v4.json`.

Load once after native neutral, fairy, leprechaun, gargoyle and environment sprites. Both APIs expose readyPromise, ready, assetErrors. Fallback to previous renderer lasts only until assets are ready. Pixie and roster are separate to preserve the accepted representative exactly.

Portraits must use actual `FantasyForestNeutralsV4.portrait()` or `FantasyForestRosterV4.portrait(kind)`, cropping that body frame; do not invent second heads. Roster stoneFrame provides gargoyle views. Every bitmap comes from project assets, not external generated-image paths.

## Scope

Five independently authored surfaces S/SE/E/NE/N, mirrors for SW/W/NW. Full body/head/material raster replacements, articulated bitmap limbs and wings, native pose/IK points, grip props, hat/head states and facial overlays. Brownie retains its native static apparition, bowl and separate darkness-eye behavior. Enderman retains native caller bob/tilt and cargo grip. Cargo tree uses the same actual SPR.trees[0] raster as the world; it is not a second environment redesign. Gargoyle post, native lampCage and illumination remain fixtures while stone body surfaces and wings are replaced.

Animals, birds, frogs, other owners' characters, common index and published version are excluded. Old v3 is preserved, not claimed as accepted.

## Review and verification

Pixie direction/style and limited corrections independently accepted on a99090. Full roster visual review first on73f115, then bounded corrections accepted on9bf8 by db56 and lead. Reports live in `output/fantasy/undead-directional/court-scale/peer-review-forest-roster-9bf8ce32.md` and `output/fantasy/pages-compat/forest-roster-9bf-visual-addendum.md`.

Own tests: pixie1032 frames/directions; roster3496 frames/directions/native transitions/eye levels, no clipped/empty frames, fractional alpha, page/asset errors or actor mutations; repeated frames reuse cache. Roster dynamic limit48MiB, static conservative limit96MiB. Actual cold-native hand/wand/staff capture:456 checks, maximum error2.594e-6 world px, tolerance1e-5 for Canvas matrix precision. Full production index without injection and final integration remain the lead's gate; these owner checks are not represented as independent production acceptance.

Evidence: `pixie-five-views.png`, `roster-five-views.png`, `gargoyles-five-views.png`, `roster-cold-native.png`, `roster-school-court.png`, `roster-school-mobile.png`, `enderman-cargo-five-views.png`, native pose sheets, `fairy-NE-head-closeup.png`, and `gargoyle-actual-contacts.png` (actualgarDraw,3styles×8phase, same×8zoom).

Exports for leshy falling/sleeping poses were widened at common zoom to avoid clipping the first sheet column. This was an export defect, not a runtime buffer clip. Actual NE fairy head shows the ear/cheek behind the braid, without the green front eye present in SE/E. Actual gargoyle fixture contacts were visually reviewed; exact root/contact contracts are under separate technical review.

## Final bounded contract correction

Final roster SHA: `736b1e33603165a6bd4ef50fdb3e93bbf042fb7c735f832dc2d9e20ed82fc31e`. Four reviewed fixes: cargo soil center-20/root tips-12/visible canopy top-95; exact fine2 bitmap reflection before native caller mirror; brownie root rounds to(310,344) in the cold fixture; GarB chain retains native turn*.5. 3496matrix,456anchors,96actualcallback pixel comparisons and40actualcargo traces pass on this SHA. Brownie depth/alpha and GarB chain start/end exactly match cold fixture. Fresh screenshots use this same SHA. See `contracts-9bf-to-final.patch`, `owner-targeted-contracts.json`, `native-mirrors.json`, `cargo-runtime.json`. Lead handles isolated production integration and deployment under the user's explicit request.

`frozen-9bf8/` preserves the real review source. No historical73f source archive was kept; `PATCH_PROVENANCE.md` and `staffFX-73-to-9bf.patch` document an in-memory reverse-hash verification, never falsely labeled an original archive.

## Generation provenance and prompt set

Built-in imagegen was used, never CLI/API fallback. Inputs were the pixel fairy rig and accepted pixel-art direction as style references. Outputs were copied into project assets before use. The original generated images remain untouched under the Codex generated_images chat directory.

Prompt set, condensed: pixel-art sprite atlases with hard square clusters, stepped warm shading and rich readable materials; transparent canvas; five complete armless surfaces front/front3/4/profile/rear3/4/back plus ten complete detached arms; same physical scale and foot baseline; no text/floor/shadow/blur/gradients; rear views without front eyes. Brownie: uncovered chestnut curls/beard, patched blue linen tunic, red sash, straw shoes. Enderman: tall slender purple-charcoal bark body, angular elongated head, long grasping fingers, restrained violet front eyes. Gargoyles:15complete sprites,3styles×5views, grey-green chipped limestone/moss, Aheavy upright/Bhunched cantilever/Cslim swept horns, complete stone wings/claws/tail. Fairy revision: preserve all costume/body/scale/arms, change upper cream-and-gold wings to tall continuous curved pointed silhouettes above the head; true rear3/4 head with braid/ear and no front eye.
