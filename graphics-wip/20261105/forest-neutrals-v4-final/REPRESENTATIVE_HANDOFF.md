# Pixie v4 — first representative, WIP

Only pixie is implemented. No production index change; old v3 and all other owners' assets remain preserved. Further non-animal roster work waits for concrete independent representative review.

Runtime: `js/fantasy-published-forest-neutrals-v4.js`

SHA256: `a99090b927974effbdbd3b57e1ca40516fe92beb9449414f68a552d82cc9d41d`

Asset: `assets/fantasy/forest-neutrals-v4/pixie-rig-source-v2.png`

SHA256: `f843175868d2acbb9ac33e1de7874ced5e74ecd303786ae720cc9efde4b98a06`

Five authored raster surfaces S/SE/E/NE/N, mirrored for SW/W/NW. Bitmap arms and legs articulated to native hand/wand anchors. Native wing cycle, fall, sleep pose and fade are retained. Back views have actual back surfaces. Shared world scale across views.

Evidence: pixie-five-views.png; pixie-cold-native-1to1-x4.png; pixie-native-poses.png; pixie-school-court.png. The school scene uses actual depth-list neuDraw and Malgor foeDrawRaider at one camera scale; specimens are controlled review fixtures, not saved NPC mutations.

Cold native idle bbox height52 world; new51.5–52. Width38.333 native vs22.5–24 new, due to tall narrower wings. This shape change is explicitly submitted for review, not concealed as identical bbox.

Technical check qa-pixie.json: 1032 frame/direction combinations; no clipping, empty frames, fractional alpha, page errors, asset errors or actor property mutation. LRU32MiB and static raster budget32MiB. These checks do not constitute artistic acceptance.

Limited revision: eye states now cover blink/sleep/hurt/death with no face on rear surfaces. Added pixie-eye-states.png and pixie-full-wing-cycle.png. Native anatomical landmarks separately match: face -44.95 world (new -44.95), shoulder -39.585 (new -39.734), hip -26.97 (new -26.695), alpha sole -9.667 (new -9.5). Source landmarks are explicit in preview.json and do not use wing union for body calibration. Peer review requested from db56 and lead on this exact runtime/asset SHA. Do not publish or extend this representative as an accepted batch yet.

