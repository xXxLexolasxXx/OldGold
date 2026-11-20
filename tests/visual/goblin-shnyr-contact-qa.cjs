'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),zlib=require('node:zlib');
const {chromium}=require(process.env.PW_CORE || path.resolve(__dirname,'../../tools/browsers/node_modules/playwright-core'));
const root=path.resolve(__dirname,'../..');
const out=path.resolve(process.env.QA_OUT || path.join(root,'output/qa/goblin-contact'));
fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.html':'text/html','.png':'image/png','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
const save=zlib.gunzipSync(fs.readFileSync(path.join(root,'tests/saves/v0.11.9-solo-meadow-s12.json.gz'))).toString();
const directions=['S','SE','E','NE','N','NW','W','SW'];
const roles=['goblin','goblinB','goblinKing','shnyrKing'];
async function main(){
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const reports={};
 try{
 for(const mobile of [false,true]){
  const label=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},
    isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(), errors=[], assetFailures=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('response',res=>{if(res.status()>=400 && /roster-v4|goblin-camps-v9|runtime-v11/.test(res.url()))assetFailures.push(res.url())});
  await page.addInitScript(raw=>{localStorage.setItem('feod.save.manual',raw);localStorage.setItem('feod.save.manual.meta','{"time":1}');},save);
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});
  const preflight=await page.evaluate(async()=>{
   if(!window.OldGoldGoblinRuntime)throw Error('Production index did not register goblin runtime');
   return {ok:await OldGoldGoblinRuntime.ready,errors:OldGoldGoblinRuntime.errors,artErrors:OldGoldFrogTrollArtwork.errors};
  });
  if(!preflight.ok)throw Error(JSON.stringify(preflight));
  await page.waitForFunction(()=>{const b=document.querySelector('#start-menu [data-sm="continue"]');return b&&b.offsetWidth&&!b.disabled});
  await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.offsetWidth&&b.textContent.trim()==='Понятно')?.click();document.querySelector('#start-menu [data-sm="continue"]').click()});
  await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.buildings.length>0);



 const audit=await page.evaluate(()=>{
  const c=mkCanvas(900,700).getContext('2d'),source=Game.units.find(isPerson),checks=[];
  for(let h=0;h<8;h++)for(const escaped of [false,true]){
   const angle=h*Math.PI/4,dx=Math.sin(angle),dy=Math.cos(angle),actor={id:444,k:'shnyr',x:8,y:8,st:'atk',atkT:0,hit:0,face:dx<0?-1:1,hp:200,mhp:200};
   const target={...source,id:9975,x:8+dx*1.8,y:8+dy*1.8};actor.tg=target.id;Game.unitMap.set(target.id,target);let release,previous;
   for(const t of [0,.10,.12,.16,.18,.23]){
    actor.atkT=t;if(escaped&&t>=.18){target.x=8+dx*3.6;target.y=8+dy*3.6;}
    const before=JSON.stringify(actor);foeDrawRaider(c,actor);if(before!==JSON.stringify(actor))throw Error('Shnyr draw mutation');
    const point=OldGoldGoblinRuntime.shnyrProjectile(actor);
    if(t<.12&&point)throw Error('Bomb before release');
    if(point){if(point.u>=1)throw Error('Early bomb impact');release=point.release;previous=point;}
   }
   actor.atkT=.23;let hits=0;foeAttackCycle(actor,target,.02,()=>hits++);foeDrawRaider(c,actor);
   const landed=OldGoldGoblinRuntime.shnyrProjectile(actor);
   if(!landed||landed.u!==1||hits!==(escaped?0:1)||landed.missed!==escaped)throw Error('Incorrect impact causal order '+JSON.stringify({h,escaped,hits,landed}));
   if(!escaped&&Math.hypot(landed.x-target.x*TILE,landed.y-(target.y*TILE+6-17))>.4)throw Error('Bomb misses actual hit');
   const fixed=[landed.x,landed.y];target.x+=3;actor.atkT=.28;const tail=OldGoldGoblinRuntime.shnyrProjectile(actor);
   if(tail.x!==fixed[0]||tail.y!==fixed[1])throw Error('Post-damage bomb flight');
   actor.atkT=.30;if(OldGoldGoblinRuntime.shnyrProjectile(actor))throw Error('Stale bomb');
   const dir=['S','SE','E','NE','N','NW','W','SW'][h],sprite=OldGoldGoblinRuntime.shnyrReleaseFrame(dir),sign=h>=5?-1:1;
   const px=Math.round(((release[0]-actor.x*TILE)*sign+sprite.ax)*2),py=Math.round((release[1]-actor.y*TILE-6+sprite.ay)*2),data=sprite.cv.getContext('2d').getImageData(0,0,sprite.cv.width,sprite.cv.height).data;let closest=99;
   for(let yy=py-3;yy<=py+3;yy++)for(let xx=px-3;xx<=px+3;xx++)if(data[(yy*sprite.cv.width+xx)*4+3])closest=Math.min(closest,Math.hypot(xx-px,yy-py));
   if(closest>2)throw Error('Bomb release floats away from hand '+JSON.stringify({dir,px,py,closest}));
   checks.push({h,escaped,hits,release,landing:fixed,handGap:closest/2});Game.unitMap.delete(target.id);
  }
  return{checks};
 });
 reports[label]={...audit,errors,assetFailures};await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'shnyr-contact-report.json'),JSON.stringify(reports,null,2));console.log(Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{sequences:v.checks.length,errors:v.errors,assetFailures:v.assetFailures}])));
}
main().catch(e=>{console.error(e);process.exitCode=1});