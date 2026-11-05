# Frontal portrait API — stable

```js
const art = window.FantasyDarkCourtPolish;
await art.ready;

// phase is a native integer idle phase 0..11. It is normalized internally.
const portrait = art.portrait('fMalgor1', phase);
// Same sprite as art.frame('fMalgor1', 'i' + phase, 'S').
// Phase III: art.portrait('fMalgor3', phase).

ctx.imageSmoothingEnabled = false;
ctx.drawImage(portrait.cv,
  anchorX - portrait.ax * zoom,
  anchorY - portrait.ay * zoom,
  portrait.w * zoom, portrait.h * zoom);
```

Return: `{cv,w,h,ax,ay,direction,view,mirror}`. `cv.fine === 2`; `S` is a separately drawn frontal body, not mirrored SE. A fixed `phase=2` is suitable for a still portrait. Do not pass raw timestamps as frame names; for animated idle use the game's native quantized 0..11 idle phase. The public helper normalizes phase and caches it.

Other actions/views: `art.frame(kind, nativeFrame, direction)`; directions `S,SE,E,NE,N,NW,W,SW`, native keys unchanged. `await art.ready` before use, `art.assets.errors` must be empty. No script injection required; canonical index already loads the renderer.

`art.setHeading(previewActor,'S')` pins only a **private WeakMap presentation context** for a preview actor when using production `foeDrawRaider`. `art.setHeading(previewActor,null)` releases it. It does not write any saved NPC properties. Ordinary actors infer view from existing movement/target/face data.

The final narrow N back-surface correction for rockling/golem is independent of this frontal API and does not change S portraits, layouts or phase names. Final source/asset SHA and tests are in the directional handoff/READY manifest.
