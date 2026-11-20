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
  for(const campaign of [false,true])for(const spear of [false,true])for(let h=0;h<8;h++)for(const sample of ['near','far','miss']){
   const range=campaign?1.4:1.2,dist=sample==='near'?.8:sample==='far'?range:range+.9,angle=h*Math.PI/4;
   const actor={id:200+(spear?1:0),k:'goblin',x:8,y:8,st:'atk',atkT:.23,hit:0,face:Math.sin(angle)<0?-1:1,hp:30,mhp:30,rk:1};
   const target={...source,id:9980,x:8+Math.sin(angle)*dist,y:8+Math.cos(angle)*dist};actor.tg=target.id;Game.unitMap.set(target.id,target);let strikes=0;
   if(campaign)foeAttackCycle(actor,target,.02,()=>strikes++);else{actor.atkT=.25;actor.hit=1;actor.fr=neuFrame(actor);}
   const before=JSON.stringify(actor);let image,matrix;const raw=c.drawImage.bind(c);c.drawImage=(im,...args)=>{if(im.rosterArtwork){image=im;matrix=c.getTransform();}return raw(im,...args)};
   if(campaign)foeDrawRaider(c,actor);else neuDraw(c,actor);delete c.drawImage;
   if(before!==JSON.stringify(actor))throw Error('Actor draw mutation');
   const dir=['S','SE','E','NE','N','NW','W','SW'][h],sprite=OldGoldGoblinRuntime.strikeFrame(spear?'goblinB':'goblin',dir),weapon=sprite.weapon;
   if(image!==sprite.cv)throw Error('Directional contact cell not connected '+JSON.stringify({campaign,spear,dir}));
   const A=matrix.transformPoint({x:weapon.grip[0],y:weapon.grip[1]}),B=matrix.transformPoint({x:weapon.tip[0],y:weapon.tip[1]}),T={x:target.x*TILE,y:target.y*TILE+6-17};
   const vx=B.x-A.x,vy=B.y-A.y,u=Math.max(0,Math.min(1,((T.x-A.x)*vx+(T.y-A.y)*vy)/(vx*vx+vy*vy))),gap=Math.hypot(T.x-A.x-u*vx,T.y-A.y-u*vy);
   if(spear&&dir==='S'&&sample!=='miss'&&u<.999)throw Error('Front spear touches with shaft instead of tip');
   if(sample!=='miss'&&gap>5.6)throw Error('Valid strike misses torso '+JSON.stringify({campaign,spear,dir,dist,gap}));
   if(campaign&&strikes!==(sample==='miss'?0:1))throw Error('Changed native strike range');
   const pixels=sprite.cv.getContext('2d').getImageData(0,0,sprite.cv.width,sprite.cv.height).data;
   let edges=0;for(let y=0;y<sprite.cv.height;y++)for(let x=0;x<sprite.cv.width;x++)if((!x||!y||x===sprite.cv.width-1||y===sprite.cv.height-1)&&pixels[(y*sprite.cv.width+x)*4+3])edges++;
   if(edges)throw Error('Clipped contact cell');
   const gx=Math.round((weapon.grip[0]+sprite.ax)*2),gy=Math.round((weapon.grip[1]+sprite.ay)*2);let gripInk=0;
   for(let yy=gy-2;yy<=gy+2;yy++)for(let xx=gx-2;xx<=gx+2;xx++)if(pixels[(yy*sprite.cv.width+xx)*4+3])gripInk++;
   if(gripInk<3)throw Error('Empty hand grip');
   if(spear&&dir==='S'){
    const original=OldGoldFrogTrollArtwork.frame('goblinB','a6','S'),data=original.cv.getContext('2d').getImageData(0,0,original.cv.width,original.cv.height).data;
    for(const [x0,x1]of [[40,55],[69,83]]){
     let oldGround=-1,newGround=-1,oldInk=0;
     for(let yy=85;yy<106;yy++)for(let xx=x0;xx<x1;xx++){const pos=(yy*sprite.cv.width+xx)*4+3;if(data[pos]){oldGround=yy;oldInk++;}if(pixels[pos])newGround=yy;}
     if(!oldInk||oldGround!==newGround)throw Error('Front spear foot support changed '+JSON.stringify({x0,x1,oldInk,oldGround,newGround}));
    }
   }
   checks.push({campaign,spear,dir,dist,sample,gap,strikes:campaign?strikes:null});Game.unitMap.delete(target.id);
  }

  for(const role of [{k:'goblin',spear:false,campaign:false},{k:'goblin',spear:true,campaign:false},{k:'goblin',spear:false,campaign:true},{k:'goblin',spear:true,campaign:true},{k:'goblinChamp',campaign:true},{k:'champDuel',campaign:true}])for(let h=0;h<8;h++){
   const range=role.campaign?FSPEC[role.k].rng:NSPEC.goblin.rng,angle=h*Math.PI/4,actor={id:200+(role.spear?1:0),k:role.k,x:8,y:8,st:'atk',atkT:0,hit:0,face:Math.sin(angle)<0?-1:1,hp:100,mhp:100,rk:1};
   const target={...source,id:9981,x:8+Math.sin(angle)*range,y:8+Math.cos(angle)*range};actor.tg=target.id;Game.unitMap.set(target.id,target);let matrix,strikes=0;
   for(let i=0;i<=24;i++){
    const t=i/100,dist=range+t*1.5;target.x=8+Math.sin(angle)*dist;target.y=8+Math.cos(angle)*dist;
    if(i===24&&role.campaign)foeAttackCycle(actor,target,.01,()=>strikes++);else{actor.atkT=t;actor.hit=i>=24?1:0;}
    if(!role.campaign)actor.fr=neuFrame(actor);
    const raw=c.drawImage.bind(c);c.drawImage=(im,...args)=>{if(im.rosterArtwork||im.fantasyGoblin)matrix=c.getTransform();return raw(im,...args)};const before=JSON.stringify(actor);
    if(role.campaign)foeDrawRaider(c,actor);else neuDraw(c,actor);delete c.drawImage;if(before!==JSON.stringify(actor))throw Error('Moving-target draw mutation');
   }
   const dir=['S','SE','E','NE','N','NW','W','SW'][h],champ=role.k!=='goblin',weapon=champ?GoblinChampionDirections.frame('goblinChamp','a6',dir).weapon:OldGoldGoblinRuntime.strikeFrame(role.spear?'goblinB':'goblin',dir).weapon;
   const A=matrix.transformPoint({x:weapon.grip[0],y:weapon.grip[1]}),B=matrix.transformPoint({x:weapon.tip[0],y:weapon.tip[1]}),T={x:target.x*TILE,y:target.y*TILE+6-17};const vx=B.x-A.x,vy=B.y-A.y,u=Math.max(0,Math.min(1,((T.x-A.x)*vx+(T.y-A.y)*vy)/(vx*vx+vy*vy))),gap=Math.hypot(T.x-A.x-u*vx,T.y-A.y-u*vy);
   if(gap>5.6||(role.campaign&&strikes!==1))throw Error('Native moving hit lacks contact '+JSON.stringify({role,dir,gap,strikes}));
   checks.push({...role,dir,sample:'moving-within-tolerance',gap,strikes:role.campaign?strikes:null});Game.unitMap.delete(target.id);
  }
  return{checks};
 });
 reports[label]={...audit,errors,assetFailures};await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'direction-contact-report.json'),JSON.stringify(reports,null,2));console.log(Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{sequences:v.checks.length,errors:v.errors,assetFailures:v.assetFailures}])));
}
main().catch(e=>{console.error(e);process.exitCode=1});