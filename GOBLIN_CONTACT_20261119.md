# Goblin directional strike contact — 19 November 2026

Base: 051cd16. Owner: goblin QA; root reviews and integrates. Scope: scout, spearman, champion/champDuel and campaign Shnyr strike presentation, all eight headings. No deployment.

## Result and contract

- Scout/spearman retain their accepted independent S/SE/E/NE/N bodies and original hand/weapon artwork. Explicit limb layers rotate the accepted detailed grip and weapon together, remove the old silhouette and restore covered cloth. Rear limbs sit behind the body. The S spearman retains both boot supports and contacts with its tip.
- Champion retains its native shoulder and two-link arm lengths. Directional attack poses expose the hand outside the shield/helmet, retain the blade length and move the complete rig/shadow to the blade contact. The shield belongs to the far arm and stays behind the rear cloak or front attacking hand.
- Shnyr has one front/rear release arm. Its repair patch uses the clean resting shoulder; front idle would incorrectly restore a second raised hand. Release is attached to the final palm, not the old device fuse. The finite bomb sprite leaves at .12, reaches the native .24 strike and only fades in place until .30. An escaped target gets the bomb's missed landing, without post-damage flight.
- Attack heading is committed before impact. Ordinary target movement inside native hit tolerance is followed until the strike, with a 160 world-pixel/second bound; an escape or crossing behind cannot snap the rig or reverse its displacement. Movement after impact does not drag the completed swing.
- AI, hit range, damage, strike timing, actor face/coordinates, save fields, PNGs and common index remain unchanged. Transient state uses WeakMaps. Output uses the native ×2 pixel grid without smoothing. Ten finite directional strike entries and two release entries are prepared at readiness; additional persistent RGBA is below 1 MB.
- Woodland king artwork has no independent gameplay registry entry in this base; its portrait is retained.

## Focused verification

Installed Chrome, real production index and loaded game: PC 1280×800; mobile 390×844, DPR 3, touch. Set PW_CORE when Playwright is outside the checkout and QA_OUT for external reports.

1. node tests/visual/goblin-direction-contact-qa.cjs — 144 cases per profile: 96 static near/far/miss cases and 48 ordinary moving targets. Actual canvas transforms place valid torso targets within the blade contact radius, while native campaign miss callbacks remain silent. S spear assertions require the nearest point to be the tip, visible ink at the grip, and matching left/right boot support. Moving targets begin at native range and move outward at 1.5 tiles/second into native tolerance before the strike.
2. node tests/visual/goblin-contact-qa.cjs — eight trajectories per profile, 57 frames each. Radial escape and crossing behind preserve the committed swing; no return snap or mirror inversion. At dt=.01 the largest consecutive displacement is 2.55 world pixels. Drawing leaves actors and targets unchanged.
3. node tests/visual/goblin-shnyr-contact-qa.cjs — 16 hit/miss sequences per profile. Bomb release touches palm ink; .23→.25 actual foeAttackCycle emits the native hit or miss. Bomb is landed at impact, stays at that landing after target movement, and is absent at .30.
4. node tests/visual/goblin-champion-sync-qa.cjs — 48 sequences per profile, both goblinChamp/champDuel, eight headings and .8/1.9/2.8 tile distances. Pre-hit a4, actual native .23→.25 strike a6, recovery a7. Native callbacks are 1/1/0, with the valid blade segment checked after every real draw transform.

All focused passes have zero page errors, asset failures or draw-time actor mutation. npm run check passes. Full combined render-budget and camera measurements belong to root's release wave.

## Evidence

Workspace feod/output/qa/goblin-contact-20261119/:

- limb-contact-comparison.png — accepted a6 before / authored directional limb after, same world scale.
- desktop-boss-contact-all.png and mobile equivalent — champion poses and Shnyr release/impact, spacious grid.
- all/direction-contact-report.json, moving-report.json, shnyr-contact-report.json and champion-report.json — final focused results.

The earlier camp recheck also passed PC/mobile: 2,976 artwork samples, nine 4/6/8 camp states, road approach, 1.575-tile resident passage, foreground entrance order and zoom .5. No camp files change in this follow-up.
