const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs'),fs=require('fs'),path=require('path');
(async()=>{const server=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('oldgold-tut','done'));
 await page.goto(server.url,{waitUntil:'load'});await page.locator('[data-sm="new"]').click();await page.locator('[data-sm="mode-free"]').click();
 await page.locator('#sm-seed').fill('4242');await page.locator('[data-sm="map-go"]').click();await page.locator('[data-sm^="diff:"]').first().waitFor({state:'visible',timeout:120000});await page.locator('[data-sm^="diff:"]').first().click();await page.locator('[data-ha="ok"]').waitFor({state:'visible',timeout:30000});await page.locator('[data-ha="ok"]').click();
 await page.waitForFunction(()=>Game.buildings.length>0);const tutorialClose=page.locator('[data-tut="close"]');if(await tutorialClose.isVisible())await tutorialClose.click();await page.addScriptTag({url:server.url+'/js/fantasy-published-magicbeasts.js'});await page.evaluate(()=>FantasyMagicBeasts.readyPromise);
 const result=await page.evaluate(()=>{
  Game.paused=true;StartMenu.open=false;
  const hero=Game.units.find(u=>u.type==='hero')||Game.units[0];let spot=null;
  for(let radius=4;radius<35&&!spot;radius++)for(let yy=-radius;yy<=radius&&!spot;yy++)for(let xx=-radius;xx<=radius&&!spot;xx++){
   const x=Math.floor(hero.x+xx),y=Math.floor(hero.y+yy);if(x<8||y<8||x>MAP_W-9||y>MAP_H-9)continue;let score=0;
   for(let dy=-3;dy<=3;dy++)for(let dx=-5;dx<=5;dx++)if(!World.bmap[idx(x+dx,y+dy)]&&!World.obj[idx(x+dx,y+dy)]&&World.terrain[idx(x+dx,y+dy)]===T_GRASS)score++;
   if(score>=70)spot={x,y};
  }if(!spot)spot={x:Math.floor(hero.x),y:Math.floor(hero.y)};
  const entries=[['unicorn','Единорог'],['forest','Лесной дракончик'],['fire','Огненный дракончик'],['ice','Ледяной дракончик'],['swamp','Болотный дракончик'],['adult','Взрослый дракон'],['griffin','Грифон'],['salamander','Саламандра']].map(([kind,name],i)=>({kind,name,x:spot.x+(i%4-1.5)*3.8,y:spot.y+(i<4?-2.1:2.1),face:1,ph:.35,st:'graze',life:99,mv:false,nx:spot.x-12,ny:spot.y-12,tr:0,lv:8,z:0,stage:kind==='adult'?1:0,sp:kind}));
  const native=fairyDrawList;fairyDrawList=function(list,c,...bounds){native(list,c,...bounds);for(const o of entries){
   if(o.kind==='unicorn')unicornDraw(list,c,{uni:o},...bounds);
   else if(o.kind==='griffin'){o.st='patrol';griffinDraw(list,c,{gr:o},...bounds);}
   else if(o.kind==='salamander')list.push([o.y+.1,()=>{fyShadow(c,o.x*TILE,o.y*TILE+3,12);fyBlit(c,FantasyMagicBeasts.preview('salamander',2,'idle',0),o.x*TILE,o.y*TILE+3,1,1,.9);}]);
   else{o.st='land';dragonDraw(list,c,{dr:o},...bounds);}
   list.push([o.y+.5,()=>{c.save();c.font='6px sans-serif';c.textAlign='center';c.lineWidth=2;c.strokeStyle='#14231b';c.strokeText(o.name,o.x*TILE,o.y*TILE+14);c.fillStyle='#fff3cc';c.fillText(o.name,o.x*TILE,o.y*TILE+14);c.restore();}]);
  }};
  R.cam.z=1.7;centerOn(spot.x*TILE,spot.y*TILE);render();
  const label=document.createElement('div');label.textContent='Постановочный просмотр новых моделей на игровой карте · масштаб камеры ×1,7';label.style='position:fixed;top:72px;left:340px;color:#fff4d0;background:#15251be6;padding:8px 12px;border-radius:6px;font:15px sans-serif;z-index:99999;pointer-events:none';document.body.appendChild(label);
  window.magicMapEntries=entries;return{spot,ready:FantasyMagicBeasts.ready,errors:FantasyMagicBeasts.errors};
 });
 await page.waitForTimeout(700);await page.screenshot({path:path.join(__dirname,'beasts-in-game.png')});
 await page.evaluate(()=>{for(const o of magicMapEntries){o.ph=.48;o.z=['unicorn','salamander'].includes(o.kind)?0:14;if(!['unicorn','salamander','griffin'].includes(o.kind))o.st='out';o.mv=o.kind==='unicorn';}render();});
 await page.screenshot({path:path.join(__dirname,'beasts-in-game-flight.png')});
 fs.writeFileSync(path.join(__dirname,'map-preview-result.json'),JSON.stringify({...result,pageErrors:errors},null,2));console.log(JSON.stringify({...result,pageErrors:errors}));
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
