# Wild chief native phases

Base: `07567a3a7a6483759e842d125a4e43a786e608ee`.
Owner: boar; integration and index/service worker/changelog: root.

Goal: preserve the existing native attack, hurt, guard and recovery pose frames
when `wgDrawChiefNeu` draws a faction chief. The current adapter reduces numbered
frames to a few names and discards guard/recovery into idle even though the
current `wildSprite` renderer already consumes all `FIGHT_BODY` entries.

Scope: only that phase-selection function in `js/world/wildgnomes.js` plus
focused evidence/docs. Preserve the current eight faction/hostility looks,
weapons, sprite size, feet anchor, mirror, health bar, roll effect, combat damage,
state transitions and saved state. Do not introduce a new art atlas or expand
this patch to civilians, frogfolk or lairs.

Saved candidate: `creature-review-20261113/js/world/wildgnomes.js`; artistic
reference remains the current accepted chief model, Leshy v4/champion pixel
clusters. First representative sample requires gnometaur's independent review.

Readiness: exact selection checks for all emitted numbered phases and named
fallbacks; actual current full-index PC/mobile renders of eight chiefs and
native duel progression; same-scale before/after with shoulders, hands and
weapon visible; no actor/save mutation from drawing; bounded caches; startup
and script checks. Root owns the final combined render budget and release.

## Result

PC and mobile CPU x4 covered all eight faction/hostility looks, two consecutive
30-phase circles each, and both horizontal mirrors: 480 checked world renders
per profile and arm. Supported attack `a0..a11`, guard `p0..p5`, hurt `h0..h5`,
and named ready/step/recovery/hurt inputs reached the existing precise fight
tables. Idle/walk retain their ordinary fallback path. No actor mutation or page
error was observed. Rendered sprites retain fine=2 and the original foot anchor.

The native duel was started with `wgDuelStart` from a naturally generated
settlement. The pose fixture relocates its two actors to an existing open
clearing without deleting scenery; the original arena was visually obstructed
by a foreground tree. A subsequent eight-second native `wgDuelStep` simulation
had exactly matching phase sequences and both participants' HP before/after on
each profile (118 phase transitions on PC, 82 on mobile). No mechanics, RNG,
state transitions or save code changed in the package.

Cold chief cache was cleared equally before each look in both arms. The second
circle reused the same cache. Largest individual chief sprite build:

| Profile | Before cold | After cold | After warm circle |
| --- | --- | --- | --- |
| PC | 1.2 ms | 1.6 ms | 0.1 ms |
| Mobile CPU x4 | 41.7 ms | 63.5 ms | 0.3 ms |

The first full render of the newly selected clearing remains a separate heavy
baseline cost: PC 902.8 -> 847.9 ms; mobile 3541.3 -> 3512.6 ms. Chief rendering
inside that frame was PC 1.2 -> 1.2 ms and mobile 12.2 -> 11.1 ms. Other full
renders peaked at PC 21.7 -> 23.0 ms and mobile 79.1 -> 69.0 ms. This is not a
claim that the general cold camera stall is solved. The phase adapter adds no
work outside chief drawing and does not run for an ordinary first zoom.

The existing 700-entry sprite/last-motion limits are preserved; observed final
cache sizes were 65 on PC and 51 on mobile. Maximum existing RGBA canvas backing
for 700 52x76 sprites is about 10.6 MiB. No new atlas, bank, timer, rendering
queue, service worker entry or request was added. The published wildfolk renderer
is byte-identical to 07567a3, so release/offline consumers keep the same existing
resource path.

Peer gnometaur accepted the representative return/guard/hurt poses and then
inspected all six adjacent guard frames: shaft partly occluded by the head at
the highest guard, but the same axe returns on the same arc, no detached wrist
or support jump. Current angles and the accepted model were deliberately kept.

`npm run check`, `node tests/wild-test.js`, JS syntax and diff checks passed.
Root still owns the exact combined-commit render budget and publication.

## Evidence and reproduction

External directory: `D:/для игры/feod/output/qa/wild-chiefs-20261122/`.

- `check.cjs --sample`: same-scale first in-game sample and dispatch proof.
- `check.cjs`: immutable baseline overlay and candidate on the same exact index,
  PC/mobile, cold/warm circles, native duel and state checks (`report.json`).
- `summary.json`: exact dispatch/state/native outcome summary.
- `chief-first-before-after.png`: annotated same-scale comparison.
- `chief-guard-neighbours.png`: p0..p5 shoulder/wrist/shaft inspection.
- `chief-before-after-motion.gif`: same-scale slow replay of 24 actual rendered
  attack/guard/hurt frames. PNGs remain the lossless source, GIF uses 256 colours.
- `sheets.cjs` and `motion.cjs`: Node/FFmpeg compositors from saved game PNGs;
  image extraction happens after both measured circles, outside timing.
