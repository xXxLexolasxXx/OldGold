from pathlib import Path
p=Path(r'D:\для игры\feod\output\publish\oldgold-pages-20261104\js\fantasy-published-birds.js')
s=p.read_text(encoding='utf-8')
old=".then(flags=>{cache.clear();bytes=0;loaded=flags.every(Boolean);return loaded;});"
new=""".then(flags=>{
  if(flags.every(Boolean))for(let slot=0;slot<3;slot++){
   const m=metadata[slot],im=images[slot],cols=[12,6,16][slot];
   const valid=m&&m.rows?.length===5&&m.rows.every(row=>row.length===cols&&row.every(b=>b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[2]>0&&b[3]>0&&b[0]+b[2]<=im.width&&b[1]+b[3]<=im.height));
   if(!valid)errors.push('Некорректные границы атласа '+slot);
  }
  cache.clear();bytes=0;loaded=flags.every(Boolean)&&errors.length===0;return loaded;
 });"""
assert old in s
s=s.replace(old,new)
s=s.replace("o.target||o.path?.[o.pi||0]","o.target||o.path?.[o.pi||0]||(o.state==='grab'&&Number.isFinite(o.vx0)?[o.vx0*TILE,o.vy0*TILE]:null)")
p.write_text(s,encoding='utf-8')
