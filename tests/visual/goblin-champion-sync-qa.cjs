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
  for(const k of ['goblinChamp','champDuel'])for(let h=0;h<8;h++)for(const dist of [.8,1.9,2.8]){
   const angle=h*Math.PI/4,actor={id:222,k,x:8,y:8,st:'atk',atkT:.23,hit:0,face:1,hp:100,mhp:100},target={...source,id:9970,x:8+Math.sin(angle)*dist,y:8+Math.cos(angle)*dist};actor.tg=target.id;Game.unitMap.set(target.id,target);
   function observe(expected){let image,matrix;const raw=c.drawImage.bind(c);c.drawImage=(im,...args)=>{if(im.fantasyGoblin){image=im;matrix=c.getTransform();}return raw(im,...args)};const before=JSON.stringify(actor);foeDrawRaider(c,actor);delete c.drawImage;if(JSON.stringify(actor)!==before)throw Error('Champion draw mutation');const correct=GoblinChampionDirections.frame('goblinChamp',expected,GoblinChampionDirections.headingOf(actor)).cv;if(expected==='a6'&&dist<=1.9){const weapon=GoblinChampionDirections.frame('goblinChamp',expected,GoblinChampionDirections.headingOf(actor)).weapon;const A=matrix.transformPoint({x:weapon.grip[0],y:weapon.grip[1]}),B=matrix.transformPoint({x:weapon.tip[0],y:weapon.tip[1]}),T={x:target.x*TILE,y:target.y*TILE+6-17};const vx=B.x-A.x,vy=B.y-A.y,u=Math.max(0,Math.min(1,((T.x-A.x)*vx+(T.y-A.y)*vy)/(vx*vx+vy*vy))),gap=Math.hypot(T.x-A.x-u*vx,T.y-A.y-u*vy);if(gap>5.6)throw Error('Sword misses valid target '+JSON.stringify({k,h,dist,gap,A,B,T}));}
if(image!==correct)throw Error('Champion selected wrong frame '+JSON.stringify({k,h,dist,t:actor.atkT,expected}));}
   observe('a4');let strikes=0;foeAttackCycle(actor,target,.02,()=>strikes++);observe('a6');
   if(strikes!==(dist<2.7?1:0))throw Error('Changed strike range');
   actor.atkT=.36;observe('a7');checks.push({k,h,dist,strikes,frames:['a4','a6','a7']});Game.unitMap.delete(target.id);
  }
  return{checks};
 });
 reports[label]={...audit,errors,assetFailures};await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'champion-report.json'),JSON.stringify(reports,null,2));console.log(Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{sequences:v.checks.length,errors:v.errors,assetFailures:v.assetFailures}])));
}
main().catch(e=>{console.error(e);process.exitCode=1});