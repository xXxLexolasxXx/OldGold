const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core'),serve=require('../pages-compat/qa-static-server.cjs'),fs=require('fs'),path=require('path');
(async()=>{const server=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const p=await b.newPage({viewport:{width:1500,height:1400},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(server.url,{waitUntil:'networkidle'});
 await p.evaluate(()=>{
  window.magicCold=[];const names={unicorn:'Единорог',forest:'Лесной дракончик',fire:'Огненный дракончик',ice:'Ледяной дракончик',swamp:'Болотный дракончик',adult:'Взрослый дракон',griffin:'Грифон',salamander:'Саламандра'};
  delete FZ_CVC.bdridle0;delete FZ_CVC.dridle0;PXB_PET.clear();for(const key of ['uni20','gri3idle0','sal30'])fyCache.delete(key);
  const measure=cv=>{const data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(data[(y*cv.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return{x0:(x0/2)-100,y0:(y0/2)-100,x1:(x1+1)/2-100,y1:(y1+1)/2-100,width:(x1-x0+1)/2,height:(y1-y0+1)/2};};window.magicMeasure=measure;
  for(const kind of Object.keys(names)){
   const native=kind==='unicorn'?sprUnicorn(0):kind==='griffin'?sprGriffin('idle',0):kind==='salamander'?sprSalamander(0):kind==='adult'?fzDragonSprite('idle',0):pxbBaby(kind,'idle',0);
   const cv=mkCanvas(400,300),c=cv.getContext('2d');c.scale(2,2);const scale=kind==='griffin'?.8:kind==='salamander'?.9:1;
   if(native.fzO)pxbBlit(c,native,100,100,1,1,scale);else fyBlit(c,native,100,100,1,1,scale);
   magicCold.push({kind,name:names[kind],canvas:cv,bbox:measure(cv),scale});
  }
 });
 await p.addScriptTag({url:server.url+'/js/fantasy-published-magicbeasts.js'});await p.evaluate(()=>FantasyMagicBeasts.readyPromise);
 const r=await p.evaluate(()=>{
  const sheet=mkCanvas(1500,2500),g=sheet.getContext('2d');g.fillStyle='#23352d';g.fillRect(0,0,1500,2500);g.fillStyle='#fff0d0';g.font='21px sans-serif';g.fillText('Холодный исходный профиль и новая модель — один масштаб мира',24,30);g.font='15px sans-serif';g.fillText('Слева actual 1:1, справа тот же кадр ×4. Опора (крест) совпадает. Поза: покой; фаза: 0.',24,57);g.fillText('Увеличено для сравнения; проверка сохранения масштаба в игре — по измерениям ниже.',24,80);
  const rows=[];
  magicCold.forEach((old,i)=>{const s=FantasyMagicBeasts.preview(old.kind,2,'idle',0),cv=mkCanvas(400,300),c=cv.getContext('2d');c.scale(2,2);if(s.fzO&&['forest','fire','ice','swamp','adult'].includes(old.kind))pxbBlit(c,s,100,100,1,1,old.scale);else fyBlit(c,s,100,100,1,1,old.scale);const bbox=magicMeasure(cv),y=125+i*290;
   g.fillStyle='#fff0d0';g.font='17px sans-serif';g.fillText(old.name,24,y);g.font='13px sans-serif';g.fillText('Исходный / новый — 1:1',240,y);g.fillText('Исходный / новый — ×4',650,y);g.imageSmoothingEnabled=false;
   for(const [canvas,x,m]of [[old.canvas,270,1],[cv,430,1],[old.canvas,750,4],[cv,1150,4]]){const supportY=y+250;g.drawImage(canvas,x-100*m,supportY-100*m,200*m,150*m);g.strokeStyle='#6aa690';g.beginPath();g.moveTo(x-4,supportY);g.lineTo(x+4,supportY);g.moveTo(x,supportY-4);g.lineTo(x,supportY+4);g.stroke();}
   g.fillStyle='#fff0d0';g.fillText(`Высота ${old.bbox.height} → ${bbox.height}; ширина ${old.bbox.width} → ${bbox.width}; низ ${old.bbox.y1} → ${bbox.y1}`,24,y+23);
   rows.push({kind:old.kind,nativeColdE:old.bbox,newE:bbox,ratioHeight:bbox.height/old.bbox.height,ratioWidth:bbox.width/old.bbox.width,baselineDelta:bbox.y1-old.bbox.y1,headDelta:bbox.y0-old.bbox.y0});
  });window.worldscalePng=sheet.toDataURL().split(',')[1];return{rows,geometry:FantasyMagicBeasts.geometrySummary(),ready:FantasyMagicBeasts.ready,errors:FantasyMagicBeasts.errors};
 });fs.writeFileSync(path.join(__dirname,'worldscale-1to1-and-4x.png'),Buffer.from(await p.evaluate(()=>worldscalePng),'base64'));fs.writeFileSync(path.join(__dirname,'worldscale-result.json'),JSON.stringify({...r,pageErrors:errors},null,2));console.log(JSON.stringify({...r,pageErrors:errors}));
}finally{await b.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
