# Frog fire mage launch anchor

Base: 9f5e57305b0f7b48185fd7b5d6f34f79bb781a87. Owner: boar; index, service
worker and changelog remain with root. No deployment.

Scope: humanoid ftR fire mage only. Reproduced native `neuStrike` at a5 in all
eight headings: the orb starts at the face while the staff's flame is visibly
above and beside it. Fixed offsets were retained from the earlier sprite.
Evidence before changes: output/qa/frog-launch-20261121/baseline.json and PNGs.

The candidate computes the existing staff-core point (24,1.6 in weapon-local
coordinates) through the same hand rig, pose, body scale, perch offset and native
mirror. It changes only the drawn origin, preserving projectile kind, target,
elapsed-time curve, hit timing, damage, RNG and saved/mirrored event data.
The actor's accepted artwork, frame banks, hands and weapon stay unchanged.
Other kinds, the protected spearman, ordinary fauna and all lairs stay outside
this first sample.

An actor-keyed WeakMap retains one observed event's start. Event identity uses
the existing actor id, seed and dart t/x/y/o. New snapshot objects of the same
event and clock corrections do not move it in flight; a new actor/id/seed/event
replaces it. No new actor, save or network fields are added.

Both native creation points notify an optional, presentation-only observer:
the ordinary ranged strike and the special fireball before its cast override.
The observer receives the actual launch frame and stores derived coordinates
privately. Missing render library is guarded, including simulation-only loading.
It changes neither actor nor event JSON. No generic neutral tick hook is added.

This matters when a caster turns or moves outside the viewport: reconstructing
from the later pose was wrong by 28–45 world pixels in native reproductions.
The native observer now retains the exact birth point in those cases.

A first network snapshot without launch history remains an estimate. Ordinary
attacks can use their current clock/numbered phase and frozen aim; special casts
are born before their cast override and may have had a walking pose. Historical
position of an unseen moving actor cannot be reconstructed from that snapshot.
The first inferred point is then frozen through flight. This limitation does not
apply to locally observed native creation, including actors outside the viewport.

## Evidence

External QA: `output/qa/frog-launch-20261121/reproduce.cjs --after --temporal`
and `--after --mobile --temporal`, with immutable base scripts used for before.
PC and mobile both pass: eight views, native late turn with no offscreen draws,
native stationary/moving special cast, replacement snapshots of the same event,
actor-id reuse, actual serialize/applySave plus new shot. All native launch-point
errors are zero; sampled curve error is below 1.5e-12 world pixels. Observer
actor/event JSON stays unchanged; seven other frog roles return no override.
No bank errors. First network special snapshot remains approximate (about 1px
stationary, 12px after the unseen actor moved 0.39 tiles in this fixture).

Peer review: root and gnometaur accepted the eight-view sample: staff/hand
silhouette is unchanged, face is no longer covered, flame aligns with staff core.
Before/after: `fire-launch-before-after.png`, `fire-launch-five-views.png`.

No road, approach or lair changes: the user excluded roads to frogfolk bases.
This is a focused ftR fix, not acceptance of every frog role or the full release.

## Focused performance and limits

`output/qa/frog-launch-20261121/perf.cjs` applies the same serialized world in
four fresh contexts: baseline/candidate desktop, then baseline/candidate mobile
DPR3 CPU x4. It includes native strike creation, world render and following RAF;
no image readback inside the measured section. Published banks are loaded first,
the idle scene is drawn before the first a5, and four shots plus eight settling
frames are measured. Bank counts are identical, procedural builds remain zero.
No additional canvas or pose materialization is introduced by the observer.

Cold launch baseline/candidate: desktop 1.4/3.2ms, mobile 14/16.7ms. Repeated
launch: desktop 0.2–0.5/0.2–0.3ms, mobile 0.6–1.0/1.0–2.1ms. Whole first mobile
paint was 204.6/272.1ms while synchronous render was 92.8/85.5ms; settling max
was 32.3/33.4ms. This small pair is noisy and does not establish that the game's
existing cold pause is fixed. Global release budget remains a separate exact
combined-commit check owned by root. The final fallback-only cast guard was
functionally rechecked on PC/mobile; it is not exercised by the normal native
launch measurements above.

`npm run check` and `node tests/frogfolk-test.js` pass, including sim-only loading
without FrogDirections. Actual serialize/applySave is also exercised in both
browser profiles. Save-fixture compatibility is checked with tests/save-test.js.
