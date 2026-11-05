const fs=require('fs'),path=require('path');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs');
(async()=>{const srv=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:960},serviceWorkers:'block'});await page.goto(srv.url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.FantasyPublishedSmallfauna);await page.evaluate(()=>FantasyPublishedSmallfauna.readyPromise);
 const frames=await page.evaluate(()=>{Game.paused=true;WX.k=0;WX.target=0;const A=FantasyPublishedSmallfauna,cv=document.createElement('canvas');cv.width=1150;cv.height=920;const c=cv.getContext('2d'),images=[],oldT=Game.time,oldFl=Game.flies,coverage={frog:new Set(),snail:new Set(),newt:new Set(),moth:new Set()};let nightT=0;for(let tt=0;tt<2000;tt+=5){Game.time=tt;if(nightAmt()>.8){nightT=tt;break;}}Game.time=oldT;
 const pick=(d,ratio,factor)=>{for(let a=0;a<Math.PI*8;a+=.01)if((Math.round(Math.atan2(-Math.sin(a),Math.cos(a*ratio)*factor)/(Math.PI/4))+8)%8===d)return a;return 0;},mothAngles=Array.from({length:8},(_,d)=>pick(d,1.4,.84)),flyAngles=Array.from({length:8},(_,d)=>pick(d,1.3,.78));
 const frogs=Array.from({length:8},(_,d)=>({x:0,y:0,id:0,ph:0,hop:.01,face:d>4?-1:1,fx:0,fy:0,tx:Math.sin(d*Math.PI/4),ty:Math.cos(d*Math.PI/4)}));
 const critters=Array.from({length:8},(_,d)=>({x:0,y:0,ph:0,tx:Math.sin(d*Math.PI/4),ty:Math.cos(d*Math.PI/4),col:'#e9bb61'}));
 const wild=['snail','newt','moth'].map(k=>Array.from({length:8},(_,d)=>({k,x:0,y:0,id:1,ph:0,face:d>4?-1:1,tx:Math.sin(d*Math.PI/4),ty:Math.cos(d*Math.PI/4),own:0,post:null,fr:'i0',fl:0})));
 for(const f of frogs)drawFrog(c,f); // Seed native target orientation, then idle retains that view.
 for(let n=0;n<100;n++){const t=n/12;Game.time=t;c.fillStyle='#242e2c';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;c.fillStyle='#eee1bc';c.font='bold 22px sans-serif';c.fillText('Малая фауна — родные анимации во всех направлениях',22,32);c.font='14px sans-serif';c.fillStyle='#b4c7b6';c.fillText('Увеличено для сравнения; масштаб в игре сохранён',22,56);c.fillText('Изолированная проверочная сцена; общая интеграция ещё не проверена',22,78);
 c.font='11px sans-serif';c.textAlign='center';['Анфас · Юг','Передний ¾ · ЮВ','Профиль · Восток','Задний ¾ · СВ','Спина · Север','Задний ¾ · СЗ','Профиль · Запад','Передний ¾ · ЮЗ'].forEach((s,d)=>{c.fillStyle='#e9d3a4';c.fillText(s,235+d*118,110)});c.font='14px sans-serif';c.textAlign='left';
 const row=(label,r,d,scale,fn)=>{if(d===0){c.fillStyle='#cbd6bc';c.fillText(label,14,163+r*90);}c.save();c.translate(235+d*118,178+r*90);c.scale(scale,scale);fn(c);c.restore();};
 for(let d=0;d<8;d++){
  const f=frogs[d];f.ph=t;f.hop=t<6.3?0:((t-6.3)%1)*.999;coverage.frog.add(frogFrame(f));row('Лягушка',0,d,8,c=>drawFrog(c,f));
  for(let k=0;k<3;k++){const W=wild[k][d],mode=t<2?'i':t<5?'w':t<5.5?'h':'v';W.ph=t*FW_SPEC[W.k].spd*(k===0?7:3.4);W.fr=mode==='i'?naIdleFr(t,W.id):mode==='w'?fwFrame(W,true,false):mode==='h'?fwFrame(W,k!==0,k===0):naWinFr(t);coverage[W.k].add(W.fr);row(['Улитка-тяжеловоз','Водяной тритон','Мотылёк-фонарик'][k],k+1,d,2.2,c=>fwDraw(c,W));}
  const b=critters[d];b.ph=t*14;row('Бабочка',4,d,10,c=>{c.translate(0,12);drawButterfly(c,b)});
  row('Пчела',5,d,13,c=>{c.translate(-1.5,4.5);beDrawBees(c,{bees:[{...b,ph:0}]})});
  row('Червь',6,d,10,c=>{const s=A.preview('worm',Math.floor(t*5/Math.PI/2*12)%12,d);c.drawImage(s.cv,-s.ax,-s.ay,s.w,s.h);});
  row('Мотылёк у огня',7,d,10,c=>{const a=mothAngles[d];c.translate(-Math.cos(a)*3,12-Math.sin(a*1.4)*3*.6);wlDraw(c,{k:'moth',x:0,y:0,lx:0,ly:0,n:1,id:a-t*1.3,life:70,fade:0});});
  row('Светлячок',8,d,12,c=>{const a=flyAngles[d],f={cx:0,cy:0,r:1,a,w:.4,z:0,zw:.7,ph:t,bl:1.6},X=Math.round((Math.cos(a)+Math.sin(t*.7)*.3)*TILE),Y=Math.round(Math.sin(a*1.3)*.6*TILE-Math.sin(t*.7)*3);c.translate(-X,-Y);Game.time=nightT;Game.flies=[f];drawFireflies(c);Game.time=t;Game.flies=oldFl;});
 }
 images.push(cv.toDataURL());
 }Game.time=oldT;Game.flies=oldFl;return {images,coverage:Object.fromEntries(Object.entries(coverage).map(([k,s])=>[k,[...s]]))};});
 const dir=path.join(__dirname,'animation-frames');fs.mkdirSync(dir,{recursive:true});frames.images.forEach((s,n)=>fs.writeFileSync(path.join(dir,String(n).padStart(3,'0')+'.png'),Buffer.from(s.split(',')[1],'base64')));fs.writeFileSync(path.join(__dirname,'animation-coverage.json'),JSON.stringify({frames:frames.images.length,fps:12,views:8,coverage:frames.coverage},null,2));
 await page.screenshot({path:path.join(__dirname,'production-isolated-module-desktop.png')});console.log('Saved '+frames.images.length+' renderer animation frames.');
 }finally{await browser.close();await srv.close();}})().catch(e=>{console.error(e);process.exitCode=1});


