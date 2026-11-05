const fs=require('fs'),path=require('path');const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');const serve=require('./qa-static-server.cjs');
(async()=>{const s=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const p=await b.newPage({serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(s.url,{waitUntil:'load'});await p.addScriptTag({url:s.url+'/js/fantasy-published-forest-neutrals.js'});
const png=await p.evaluate(()=>{
Game.paused=true;const cv=document.createElement('canvas');cv.width=1480;cv.height=1500;const c=cv.getContext('2d');c.fillStyle='#252c29';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;c.fillStyle='#e8d9b6';c.font='21px sans-serif';c.fillText('Родные составные сцены: лепрекон, горшок, радуга и фонари',20,30);c.font='16px sans-serif';c.fillText('Увеличено для сравнения; масштаб в игре сохранён',20,60);
const cases=[['i0','Покой'],['t2','Перетягивание'],['x2','Нырок'],['x3','В горшке'],['l0','Перед пощёчиной'],['l1','Удар'],['l5','Рука на щеке'],['l8','Исчезновение']];
cases.forEach(([fr,label],i)=>{const x=(i%4)*370,y=80+Math.floor(i/4)*300,L={id:1,x:0,y:0,face:1,st:fr[0]==='i'?'idle':'duel',fr,tug:fr[0]==='t'?1:0,gx:1,gy:0,z:fr==='x2'?8:0,sink:fr==='x3'?.4:0,potA:fr[0]==='x'?1:0,potX:0,potY:0,potT:1,rbD:1,rbP:1,rbA:1};
c.save();c.translate(x+100,y+240);c.scale(2.5,2.5);lepDraw(c,L);c.restore();c.fillStyle='#e8d9b6';c.fillText(label,x+20,y+285);});
for(let row=0;row<3;row++)for(let ph=0;ph<8;ph++){const st=['A','B','C'][row],x=ph*180+90,y=720+row*250;c.save();c.translate(x,y+170);c.scale(2.3,2.3);garDraw(c,0,0,true,ph*.8,st);c.restore();c.fillStyle='#e8d9b6';c.fillText('Облик '+['А','Б','В'][row]+' · '+(ph+1),x-65,y+205);}
return cv.toDataURL();});fs.writeFileSync(path.join(__dirname,'native-composites.png'),Buffer.from(png.split(',')[1],'base64'));console.log(JSON.stringify({pageErrors:errors}));
}finally{await b.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


