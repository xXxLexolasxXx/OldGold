from pathlib import Path
p=Path(r'D:\для игры\feod\output\publish\oldgold-pages-20261104\js\fantasy-published-birds.js')
s=p.read_text(encoding='utf-8');a=s.index(' const images=');b=s.index(' let bytes=',a)
s=s[:a]+''' const images=[],metadata=[],extraPacks=[],supportedKinds=['owl','chicken'];let loaded=false;
 const manifestPath='assets/fantasy-birds/extra-packs.json';requiredAssets.push(manifestPath);
 const assetURL=src=>new URL('../'+src,moduleURL).href;
 const json=async src=>{try{const r=await fetch(assetURL(src));if(!r.ok)throw Error(r.status);return await r.json();}catch(e){errors.push(src+': '+e.message);return null;}};
 const png=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{errors.push('Не загружен ассет: '+src);resolve(null);};im.src=assetURL(src);});
 const ready=(async()=>{
  const m=await json(manifestPath);if(!m||!Array.isArray(m.packs)){if(!errors.length)errors.push('Нет списка птичьих атласов');return false;}
  for(const def of m.packs){def.slot=3+extraPacks.length;extraPacks.push(def);if(!supportedKinds.includes(def.kind))supportedKinds.push(def.kind);requiredAssets.push('assets/fantasy-birds/'+def.file+'.png','assets/fantasy-birds/'+def.file+'.json');}
  const pairs=[[requiredAssets[0],requiredAssets[2]],[requiredAssets[1],requiredAssets[3]],[requiredAssets[4],requiredAssets[5]],...extraPacks.map(d=>['assets/fantasy-birds/'+d.file+'.png','assets/fantasy-birds/'+d.file+'.json'])];
  await Promise.all(pairs.map(async([p,j],slot)=>{const [im,meta]=await Promise.all([png(p),json(j)]);images[slot]=im;metadata[slot]=meta;}));
  for(let slot=0;slot<pairs.length;slot++){
   const m=metadata[slot],im=images[slot],cols=slot<3?[12,6,16][slot]:extraPacks[slot-3].columns;
   const valid=im&&m&&m.rows?.length===5&&m.rows.every(row=>row.length===cols&&row.every(b=>b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[2]>0&&b[3]>0&&b[0]+b[2]<=im.width&&b[1]+b[3]<=im.height));
   if(!valid)errors.push('Некорректные границы атласа '+slot);
  }
  cache.clear();bytes=0;loaded=errors.length===0;return loaded;
 })();
'''+s[b:]
s=s.replace("if(!['owl','chicken'].includes(kind))throw", "const extra=extraPacks.find(d=>d.kind===kind&&d.states[anim]);\n  if(!['owl','chicken'].includes(kind)&&!extra)throw")
s=s.replace("f=anim==='fly'||anim==='walk'?mod(Math.floor(Number(f)||0),12):0;", "if(extra){const n=extra.states[anim][2]||extra.states[anim][1];f=extra.once?.includes(anim)?Math.max(0,Math.min(n-1,Math.floor(Number(f)||0))):mod(Math.floor(Number(f)||0),n);}\n  else f=anim==='fly'||anim==='walk'?mod(Math.floor(Number(f)||0),12):0;")
s=s.replace("box.join(',')].join('|')", "box.join(','),extra?.id||'',!!opts.tame,opts.cargo||''].join('|')")
marker='  const cv=K.cv,sz=cv.width*cv.height*4;'
block='''  if(extra){
   if(!loaded)throw new Error('Bird atlas is not ready: '+kind);
   const row=['S','SE','E','NE','N'].indexOf(view),[start,count,nativeN=count]=extra.states[anim],col=start+Math.floor(f*count/nativeN),m=metadata[extra.slot],im=images[extra.slot],[sx,sy,sw,sh]=m.rows[row][col];
   K.c.imageSmoothingEnabled=false;K.c.drawImage(im,sx,sy,sw,sh,0,0,K.cv.width,K.cv.height);
  }
'''+marker
assert marker in s;s=s.replace(marker,block)
s=s.replace("supportedKinds:['owl','chicken']",'supportedKinds,packs:extraPacks')
p.write_text(s,encoding='utf-8')
