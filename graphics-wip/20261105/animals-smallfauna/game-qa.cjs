const fs=require('fs'),path=require('path');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs');
(async()=>{const srv=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];try{
 for(const mobile of[false,true]){const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},serviceWorkers:'block',recordVideo:{dir:path.join(__dirname,'video'),size:mobile?{width:390,height:844}:{width:1280,height:800}}});const page=await ctx.newPage(),errors=[],httpErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('goatcounter'))errors.push(m.text());});
  await page.goto(srv.url,{waitUntil:'load'});await page.waitForFunction(()=>!!R.canvas&&Game.buildings.length>0,{timeout:30000});await page.waitForFunction(()=>!!window.FantasyPublishedSmallfauna);await page.evaluate(()=>FantasyPublishedSmallfauna.readyPromise);
  const seeded=await page.evaluate(()=>{
   // Disposable fresh browser world only. No user save is loaded or written by this harness.
   smClose();Game.paused=true;WX.k=0;WX.target=0;const b=Game.buildings[0];let x=Math.floor(b.x+6),y=Math.floor(b.y+5),best=null;
   for(let yy=y-8;yy<y+8;yy++)for(let xx=x-8;xx<x+8;xx++){if(xx<3||yy<3||xx>MAP_W-9||yy>MAP_H-8)continue;let free=true;for(let j=0;j<4;j++)for(let i=0;i<7;i++)if(!isWalkable(xx+i,yy+j)||World.bmap[idx(xx+i,yy+j)])free=false;if(free&&!best)best=[xx,yy];}
   if(best)[x,y]=best;
   const W=['snail','newt','moth'].map((k,i)=>{const o=fwMake(k,x+1+i*2,y+1);o.st='walk';o.tx=o.x+1.6;o.ty=o.y+(i===1?-1:1);o.t=8;o.ph=i;o.fr=fwFrame(o,true,false);Game.swp.push(o);return o;});
   for(let i=0;i<5;i++)spawnButterfly(x+1+i,y+2.5);
   Game.frogs.push({x:x+3,y:y+2,t:.1,hop:.01,id:1,face:1,fx:x+3,fy:y+2,tx:x+3.7,ty:y+2.6,home:false,ph:0});
   Game.worms.push({x:x+2.5,y:y+3,age:0,ph:1},{x:x+3,y:y+3,age:0,ph:2});
   Game.hives.push(beNewHive(x+5,y+3,2));R.cam.z=3;const z=devScale();R.cam.x=(x+3.5)*TILE-R.canvas.width/z/2;R.cam.y=(y+2)*TILE-R.canvas.height/z/2;
   render();return {place:[x,y],ids:W.map(o=>o.id),ready:FantasyPublishedSmallfauna.ready,errors:FantasyPublishedSmallfauna.errors};
  });
  await page.waitForTimeout(800);await page.screenshot({path:path.join(__dirname,'game-'+(mobile?'mobile':'desktop')+'-still.png')});
  const before=await page.evaluate(ids=>Game.swp.filter(o=>ids.includes(o.id)).map(o=>({id:o.id,x:o.x,y:o.y,fr:o.fr})),seeded.ids);
  await page.evaluate(()=>{Game.paused=false;});await page.waitForTimeout(5500);await page.evaluate(()=>{Game.paused=true;});
  const after=await page.evaluate(ids=>({animals:Game.swp.filter(o=>ids.includes(o.id)).map(o=>({id:o.id,x:o.x,y:o.y,fr:o.fr})),stats:FantasyPublishedSmallfauna.stats()}),seeded.ids);
  await page.screenshot({path:path.join(__dirname,'game-'+(mobile?'mobile':'desktop')+'-motion.png')});const video=page.video();await page.close();await ctx.close();const videoPath=await video.path();const dest=path.join(__dirname,'game-'+(mobile?'mobile':'desktop')+'.webm');fs.copyFileSync(videoPath,dest);results.push({mobile,scope:'Full production index without module reinjection. Native Game.step / fwThink / renderer, disposable seeded world.',seeded,before,after,errors,httpErrors,video:path.basename(dest)});
 }
 fs.writeFileSync(path.join(__dirname,'game-qa-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await srv.close();}})().catch(e=>{console.error(e);process.exitCode=1});

