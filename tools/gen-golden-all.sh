#!/bin/sh
# Пересборка всей библиотеки tests/saves/ (нужны worktree версий в D:/wt-saves-gen/vX.Y.Z; см. tests/saves/README.md)
G="node tools/gen-golden-save.js"; W=D:/wt-saves-gen; O=tests/saves
$G --root $W/v0.9.5   --out $O/v0.9.5-solo-meadow-s11.json.gz   --seed 11 --minutes 25
$G --root $W/v0.9.14  --out $O/v0.9.14-solo-meadow-s22.json.gz  --seed 22 --minutes 30
$G --root $W/v0.10.0  --out $O/v0.10.0-solo-meadow-s33.json.gz  --seed 33 --minutes 30
$G --root $W/v0.10.25 --out $O/v0.10.25-solo-meadow-s11.json.gz --seed 11 --minutes 25
$G --root $W/v0.10.25 --out $O/v0.10.25-solo-forest-warrior-s22.json.gz --seed 22 --minutes 30 --biome forest --size medium --guilds 1 --hero warrior --level 9
$G --root $W/v0.10.25 --out $O/v0.10.25-coop-world-s31.json.gz --seed 31 --minutes 30 --kind coop
$G --root $W/v0.10.50 --out $O/v0.10.50-solo-steppe-mage-s44.json.gz --seed 44 --minutes 30 --biome steppe --guilds 1 --hero mage --level 13
$G --root $W/v0.10.70 --out $O/v0.10.70-solo-swamp-archer-s55.json.gz --seed 55 --minutes 30 --biome swamp --guilds 1 --hero archer --level 11 --diff survival
$G --root $W/v0.10.70 --out $O/v0.10.70-coop-world-s32.json.gz --seed 32 --minutes 30 --kind coop --biome forest --size medium
$G --root $W/v0.10.90 --out $O/v0.10.90-solo-winter-rogue-s66.json.gz --seed 66 --minutes 35 --biome winter --guilds 1 --hero rogue --level 15
$G --root $W/v0.10.90 --out $O/v0.10.90-solo-mountain-calm-s77.json.gz --seed 77 --minutes 30 --biome mountain --diff calm
$G --root D:/wt-saves --out $O/v0.10.110-solo-meadow-paladin-s88.json.gz --seed 88 --minutes 35 --guilds 1 --hero paladin --level 14
$G --root D:/wt-saves --out $O/v0.10.110-solo-coast-s99.json.gz --seed 99 --minutes 30 --biome coast --size medium
$G --root D:/wt-saves --out $O/v0.10.110-coop-world-s33.json.gz --seed 33 --minutes 30 --kind coop
