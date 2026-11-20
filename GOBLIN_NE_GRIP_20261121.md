# Scout rear-quarter grip — 21 November 2026

Base: `97a4fe076f0a082a2a5701cb3a1102b662e74195`. Scope: scout NE and mirrored NW strike only. No other species, states, gameplay, timing, source PNGs or index change. Root reviews and deploys.

The old limb registration put the short blade and hand beneath the hood. Changing only its angle still left most of the grip occluded. Register the accepted hand/weapon layer at the visible NE shoulder edge, retain the complete source upper-arm root, and use the shallower strike angle. The arm root retains its rear-body layer; the source grip and blade rotate together with unchanged length.

`tests/visual/goblin-ne-grip-qa.cjs` loads the actual game on PC/mobile. It compares the final blade and grip pixels with their accepted source layer, requires at least 95% visibility, checks a connected hand-to-torso path below the hood, validates NW mirroring and unchanged weapon length, and compares both lower foot regions byte for byte.

Focused external evidence: `feod/output/qa/goblin-release-audit-20261121/ne-fix/`. The close-up phase sheets show windup/contact/recovery. PC/mobile results: 26/26 blade pixels and 45/45 grip pixels remain visible; the grip connects to the torso below the hood; blade/grip length stays 5.5 world pixels. Foot regions contain 141/147 opaque source pixels with zero differences. The existing 144-case PC/mobile directional contact audit is repeated against this worktree; the combined release render-budget check remains root-owned.
