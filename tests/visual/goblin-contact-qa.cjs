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
  const c=mkCanvas(700,700).getContext('2d'),source=Game.units.find(isPerson),checks=[];
  function trajectory(campaign,spear,moving,west,turn=false){
   const actor={id:200+(spear?1:0),k:'goblin',x:8,y:8,st:'atk',atkT:0,hit:0,face:west?-1:1,hp:30,mhp:30,rk:1};
   const target={...source,id:9990,x:8+(west?-1:1)*1.2,y:8,action:null,anim:'',brawl:null};actor.tg=target.id;Game.unitMap.set(target.id,target);
   const trace=[];
   for(let i=0;i<=56;i++){
    actor.atkT=i/100;actor.hit=i>=24?1:0;actor.fr=neuFrame(actor);
    if(moving&&i>=18){target.x=turn?8+(west?1:-1)*3.6:8+(west?-1:1)*3.6;if(turn)target.y=4.4;actor.face=target.x>=actor.x?1:-1;}
    let matrix;const raw=c.drawImage.bind(c);c.drawImage=(im,...args)=>{if(im.rosterArtwork)matrix=c.getTransform();return raw(im,...args)};
    const before=JSON.stringify([actor,target]);
    if(campaign)foeDrawRaider(c,actor);else neuDraw(c,actor);
    delete c.drawImage;if(before!==JSON.stringify([actor,target]))throw Error('Actor mutation');
    trace.push([matrix.e-256,matrix.f-262]);
   }
   Game.unitMap.delete(target.id);return trace;
  }
  for(const campaign of [false,true])for(const spear of [false,true])for(const west of [false,true]){
    const control=trajectory(campaign,spear,false,west),exit=trajectory(campaign,spear,true,west);
    const turning=trajectory(campaign,spear,true,west,true);
    const turnErrors=turning.slice(0,53).map((p,i)=>Math.hypot(p[0]-control[i][0],p[1]-control[i][1]));
    if(Math.max(...turnErrors)>.001)throw Error('Attack turns or teleports after commitment');
    const errors=exit.map((p,i)=>Math.hypot(p[0]-control[i][0],p[1]-control[i][1]));
    const step=Math.max(...exit.slice(1).map((p,i)=>Math.hypot(p[0]-exit[i][0],p[1]-exit[i][1])));
    if(Math.max(...errors)>.001||step>4)throw Error('Discontinuous attack '+JSON.stringify({campaign,spear,west,errors,step}));
    checks.push({campaign,spear,west,maxDeviation:Math.max(...errors),turnDeviation:Math.max(...turnErrors),maxStep:step});
  }
  return{checks};
 });
 reports[label]={...audit,errors,assetFailures};await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'moving-report.json'),JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports));
}
main().catch(e=>{console.error(e);process.exitCode=1});