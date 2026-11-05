const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs');
const fs=require('fs'),path=require('path');
(async()=>{const server=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(server.url,{waitUntil:'networkidle'});
await page.evaluate(()=>{window.beforeUni=Array.from({length:12},(_,k)=>sprUnicorn(k?30+k:0));});
await page.addScriptTag({url:server.url+'/js/fantasy-published-magicbeasts.js'});
await page.evaluate(()=>FantasyMagicBeasts.readyPromise);
const result=await page.evaluate(()=>{
 const A=FantasyMagicBeasts;document.body.innerHTML='';document.body.style='margin:0;background:#182a2a';
 const cv=document.createElement('canvas');cv.width=1440;cv.height=1000;document.body.appendChild(cv);const c=cv.getContext('2d');c.fillStyle='#182a2a';c.fillRect(0,0,1440,1000);c.imageSmoothingEnabled=false;
 c.fillStyle='#fff1d7';c.font='24px sans-serif';c.fillText('Единорог — отдельные ракурсы и родной цикл шага',28,36);c.font='17px sans-serif';c.fillText('Увеличено для сравнения; совпадение видимого размера ещё не подтверждено',28,65);
 const dirs=[0,1,2,3,4,5,6,7],labels=['Анфас','Передний ¾','Профиль','Задний ¾','Спина','Задний ¾ ↙','Профиль ←','Передний ¾ ↘'];
 for(let i=0;i<8;i++){let x=85+i*177;c.fillStyle='#fff1d7';c.fillText(labels[i],x-55,95);for(let r=0;r<3;r++){const spr=A.preview('unicorn',dirs[i],r?'walk':'idle',r===1?0:6);c.drawImage(spr,x-72,115+r*150,144,132);}}
 c.fillStyle='#fff1d7';c.fillText('До синхронизации (родной спрайт) / новая модель, одинаковое увеличение',28,620);
 for(let i=0;i<8;i++){let x=85+i*177;c.drawImage(beforeUni[0],x-72,640,144,132);c.drawImage(A.preview('unicorn',i,'idle',0),x-72,790,144,132);}
 // Frozen controllers: invocation of real native deferred draw must be presentation-only.
 const u={x:8,y:8,face:1,st:'graze',ph:0.4,t:0,life:30,mv:true,heal:0,tg:null};const F={uni:u};const snapshot=JSON.stringify(F);let list=[];unicornDraw(list,c,F,-100,-100,100,100);list.forEach(v=>v[1]());
 const immutable=JSON.stringify(F)===snapshot;for(let i=0;i<10000;i++)A.preview('unicorn',i%8,'walk',i);
 return {ready:A.ready,errors:A.errors,immutable,stats:A.stats(),nativeCallbacks:list.length};
});
await page.screenshot({path:path.join(__dirname,'unicorn-review.png')});fs.writeFileSync(path.join(__dirname,'qa-result.json'),JSON.stringify({...result,pageErrors:errors},null,2));console.log(JSON.stringify({...result,pageErrors:errors}));
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
