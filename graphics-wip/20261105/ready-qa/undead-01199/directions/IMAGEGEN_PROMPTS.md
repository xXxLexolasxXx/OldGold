# Directional pixel assets

Built-in **imagegen** was used. No CLI/API or external key.

Final workspace files, under `D:/для игры/feod/output/publish/oldgold-pages-20261104/assets/fantasy/`:

- `court-bodies-v5-S.png` — frontal.
- `court-bodies-v5-E.png` — right profile.
- `court-bodies-v5-NE.png` — rear quarter.
- `court-bodies-v5-N.png` — back; final two-cell back-surface correction included.

The renderer also requires the existing `court-bodies-v4-pixel.png` (SE) and `court-arms-v4-pixel.png`. These existing assets were not repainted.

Reference for the four rotations: approved `court-bodies-v4-pixel.png`. Common final prompt (VIEW replaced with one of the four exact view specifications below):

> Edit this exact pixel-art monster BODY ATLAS to VIEW. Maintain precise 6 columns x 2 rows, same exact eleven identities and positions, twelfth cell empty, full bodies armless with clean sockets ready for animated arms. Preserve same armor/capes/crystals/horn identities, evil expressions when visible, SAME coarse pixel grid and stepped material shading, no smooth painting or antialiasing. Native-looking 64x128 pixel designs enlarged nearest-neighbor inside each 256x512 cell. Feet on same baseline, same heights/proportions across reference and new angle. Only rotate the viewpoint around each creature, do not redesign or pose dramatically. The little skeleton remains tiny/wiry, golem huge and massive, Malgor tall hooded with shadowed face. Match anatomy, cloth construction and real depth at this angle: draw a genuinely different side/back/front projection, not a squashed or mirrored copy. Genuine transparent background alpha=0; no matte, labels, checkerboard, scenery, cast shadows. Order top row thrall, knight, Malgor I, Malgor III, little skeleton, rockling; bottom row fire, ice, bone, shadow, golem, empty.

VIEW specifications:

- S: `strict front view, facing directly toward the viewer. Symmetrical front projection with both shoulder sockets visible, front of armor and faces, two eyes, no side perspective`
- E: `strict right-facing profile view, face points to the RIGHT edge. One eye visible, side silhouette, chest depth visible from side, shoulder sockets overlap, heel/toe side view. Not three-quarter`
- NE: `rear three-quarter view, facing diagonally AWAY to the upper-right. Mostly backs and side backs, hoods conceal faces, no front chest ornaments visible, far side face nearly hidden`
- N: `strict back view, facing directly away from viewer. Rear armor, cloak backs, back of hood/helmet, heels. NO faces or front chest cores visible`

Final narrow correction used the N atlas as edit target. Only its two corrected generated cells were composited back into the N atlas; all other nine creatures and the empty cell remain byte-identical (`back-surface-fix.json`). Prompt:

> Precise local edit of this 6x2 pixel-art BACK-VIEW monster atlas. Change ONLY TWO cells: top-right column6 rockling, bottom row column5 granite/amethyst golem. ALL OTHER NINE CHARACTERS AND EMPTY CELL MUST REMAIN IDENTICAL, same positions/proportions/grid/pixel art. For these two creatures, make their back absolutely unambiguous: a SOLID FACELESS rear skull-cap boulder, back of neck and layered BACK stone plates along spine. No eyes, no orange eye dots, no eye sockets, no eyebrow pattern, no mouth, no face-like carving anywhere on rear head. Golem chest core must NOT be visible from behind: NO central purple diamond, no front glowing crystal on torso. Central back should consist of broad opaque dark grey-brown granite plates and moss over spine. Keep its purple amethyst crystals only on outside shoulder crest and outer hip sides, away from central rear head and central back. Rockling rear must have opaque basalt crags/moss, amber crest crystals only atop the head away from where eyes would be, no orange glow on back of head. They face DIRECTLY AWAY, strict orthographic back view, no visible face side whatsoever. Preserve whole armless bodies, exact sockets/feet/height/style/coarse pixel grid/colours of these creatures apart from this back-surface correction. Genuine transparent alpha background, no new text, labels, shadows or scenery. Same 1536x1024 6-column 2-row layout.

The final global-rule correction removes front necklaces from mage backs. Only cells 2 and 3 were composited; the other ten cells are byte-identical (`mage-back-surface-fix.json`). Prompt:

> Precise local edit of this strictly BACK-VIEW 6x2 coarse pixel-art atlas. Change ONLY top-row cells 3 and 4: the two hooded necromancers. Remove the hanging front-facing skull necklaces, skull medallions, chest pendants and front stole from their BACKS. Replace those central back ornaments with uninterrupted deep vertical purple/dark-green robe folds, back seams and modest gold piping on the outer hem. Back of hood remains faceless and solid; absolutely no eyes, mouth or face, no front necklace or chest jewellery visible on a straight back view. Preserve the existing silhouettes, hood shapes, shoulder socket positions, feet/hem baseline, pixel size, rich stepped shading, cloth colours and magical flame crown on phase III. Preserve all other nine monsters and empty cell exactly, especially the already-corrected faceless rockling and golem rear plates. Keep same 1536x1024 six-column two-row regular atlas, fully transparent background, no scenery, labels, shadows, new props or other redesign.

Generated originals (built-in image generation; no external key/CLI):

- Directory: `C:/Users/Тема/.codex/generated_images/01a1a35d-db56-77b2-86f9-319a89bac78a/`.
- Front S: `exec-d391816b-7eac-4962-b3a3-b9be0febd2bc.png`.
- Profile E: `exec-f9d972e9-60d8-4ba3-97e1-315986573f71.png`.
- Rear quarter NE: `exec-eb55056b-fc95-4f8b-88c4-936a11e3c93c.png`.
- Initial back N: `exec-2c4765f7-1eea-4778-98c4-e952167a2b7f.png`.
- Stone rear correction: `exec-fca4d9ee-4533-4cac-874f-df3e5fd5f11c.png`.
- Mage rear correction: `exec-c1feb7fc-8e23-4c63-b216-02fb2af83989.png`.

Runtime copies are under `output/publish/oldgold-pages-20261104/assets/fantasy/`. The final manifest records their hashes. Image processing only masks/quantizes and composites the expressly selected generated cells; no creative redraw with Python.
