const fs=require('fs'),path=require('path');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs');
const root='D:/для игры/feod/output/publish/oldgold-pages-20261104';
(async()=>{const srv=await serve(root),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const report={scope:'Production index + isolated module injection. Full production-index integration remains pending owner.',profiles:[]};try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,deviceScaleFactor:mobile?2:1,serviceWorkers:'block'}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().startsWith(srv.url))requests.push(r.url()+': '+r.failure()?.errorText)});
  await page.goto(srv.url,{waitUntil:'load'});await page.waitForTimeout(600);
  await page.addScriptTag({url:srv.url+'/js/fantasy-published-smallfauna.js'});await page.evaluate(()=>FantasyPublishedSmallfauna.readyPromise);
  const out=await page.evaluate(()=>{
   const A=FantasyPublishedSmallfauna,imgs={},checks={ready:A.ready,assets:A.requiredAssets,errors:A.errors},names=['Покой','Моргание','Кваканье','Присела','Толчок','Полёт','Посадка'];
   const C=(w,h,title)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');c.fillStyle='#242e2c';c.fillRect(0,0,w,h);c.fillStyle='#eee1bc';c.font='bold 23px sans-serif';c.fillText(title,24,34);c.font='14px sans-serif';c.fillStyle='#b4c7b6';c.fillText('Увеличено для сравнения; масштаб в игре сохранён',24,58);c.imageSmoothingEnabled=false;return [cv,c];};
   const [cv,c]=C(1000,790,'Лягушка — полное тело, пять самостоятельных ракурсов');
   A.views.forEach((s,i)=>{c.fillStyle='#e9d3a4';c.fillText(s,155+i*165,94)});
   ['sit','blink','croak','crouch','launch','air','land'].forEach((fr,r)=>{c.fillStyle='#cbd6bc';c.fillText(names[r],20,153+r*88);for(let d=0;d<5;d++){const s=A.preview('frog',fr,d),scale=10;c.drawImage(s.cv,190+d*165-s.w*scale/2,119+r*88,s.w*scale,s.h*scale);}});imgs['frog-directions']=cv.toDataURL();
   const [ov,oc]=C(1200,865,'Малая фауна — все восемь направлений');
   const ks=[['snail','Улитка-тяжеловоз','w3'],['newt','Водяной тритон','w3'],['moth-large','Мотылёк-фонарик','w0'],['butterfly','Бабочка',3],['moth','Мотыльки у огня',2],['bee','Пчела',1],['firefly','Светлячок',1],['worm','Дождевой червь',3]];
   ['Юг','ЮВ · передний ¾','Восток','СВ · задний ¾','Север','СЗ','Запад','ЮЗ'].forEach((s,i)=>{oc.fillStyle='#e9d3a4';oc.fillText(s,190+i*123,94)});
   ks.forEach(([k,label,fr],r)=>{oc.fillStyle='#cbd6bc';oc.fillText(label,16,153+r*87);for(let d=0;d<8;d++){const s=A.preview(k,fr,d),sc=r<3?2.2:10,x=235+d*123,y=170+r*87;oc.drawImage(s.cv,x-s.ax*sc,y-s.ay*sc,s.w*sc,s.h*sc);}});imgs['all-directions']=ov.toDataURL();
   const [cmp,cc]=C(1050,630,'До / после — текущая опубликованная база 0.11.99');cc.fillStyle='#e9d3a4';cc.fillText('До синхронизации',250,95);cc.fillText('Новая модель',650,95);
   const origT=Game.time,items=[['Лягушка',drawFrog,A.native.drawFrog,{x:0,y:0,ph:0,id:0,hop:0,face:1,fx:0,fy:0,tx:0,ty:1}],['Бабочка',drawButterfly,A.native.drawButterfly,{x:0,y:0,ph:Math.PI/2,tx:1,ty:1,col:'#f0d040'}],['Червь',drawWorm,A.native.drawWorm,{x:0,y:0,ph:0}]];
   items.forEach(([label,fn,old,obj],r)=>{cc.fillStyle='#cbd6bc';cc.fillText(label,30,160+r*145);for(const [f,x]of[[old,350],[fn,750]]){cc.save();cc.translate(x,180+r*145);cc.scale(10,10);if(r===1)cc.translate(0,12);if(r===0&&f===fn){const s=A.preview('frog','sit',0);cc.drawImage(s.cv,-s.ax,4-s.ay,s.w,s.h);}else f(cc,obj);cc.restore();}});imgs['before-after']=cmp.toDataURL();
   let rendered=0,transparent=0,touching=0;const spans={},edgeKeys=[];
   for(const k of['snail','newt','moth-large']){const states=[...Array.from({length:12},(_,i)=>'i'+i),...Array.from({length:12},(_,i)=>'w'+i),...Array.from({length:6},(_,i)=>'h'+i),...Array.from({length:12},(_,i)=>'v'+i)];for(let d=0;d<8;d++)for(const fr of states){const s=A.preview(k,fr,d),data=s.cv.getContext('2d').getImageData(0,0,s.cv.width,s.cv.height).data;let n=0,edge=false;for(let y=0;y<s.cv.height;y++)for(let x=0;x<s.cv.width;x++)if(data[(y*s.cv.width+x)*4+3]){n++;if(x===0||y===0||x===s.cv.width-1||y===s.cv.height-1)edge=true;}rendered++;if(!n)transparent++;if(edge){touching++;edgeKeys.push(k+'|'+d+'|'+fr);}}}
   checks.tinyFrames=0;checks.tinyEmpty=0;checks.partialAlpha=0;
   for(const [k,frames,cols]of[['frog',['sit','blink','croak','crouch','launch','air','land'],[null]],['butterfly',Array.from({length:12},(_,i)=>i),BUTTERFLY_COLS],['moth',[0,1,2,3],[null]],['bee',[0,1],[null]],['firefly',[0,1],[null]],['worm',Array.from({length:12},(_,i)=>i),[null]]])for(let d=0;d<8;d++)for(const fr of frames)for(const col of cols){const s=A.preview(k,fr,d,col),dat=s.cv.getContext('2d').getImageData(0,0,s.cv.width,s.cv.height).data;let n=0;for(let i=3;i<dat.length;i+=4){if(dat[i])n++;if(dat[i]&&dat[i]!==255)checks.partialAlpha++;}checks.tinyFrames++;if(!n)checks.tinyEmpty++;}
   const entities=items.map(x=>x[3]);const W=['snail','newt','moth'].map((k,i)=>({k,x:4,y:5,tx:5,ty:6,face:i%2?-1:1,fr:'w3',id:i,own:i===0?1:0,post:i===0?[3,5]:null,ph:0}));
   const snapshot=JSON.stringify([entities,W]);const scratch=document.createElement('canvas');scratch.width=1000;scratch.height=1000;const sc=scratch.getContext('2d');
   for(let d=0;d<8;d++){for(const [_,fn,old,obj]of items){fn(sc,obj);}for(const o of W)fwDraw(sc,o);beDrawBees(sc,{bees:[{x:1,y:1,tx:2,ty:2,ph:1}]});wlDraw(sc,{k:'moth',x:1,y:1,lx:1,ly:1,n:3,id:1,life:60,fade:0});}
   const bbox=cv=>{const c=cv.getContext('2d'),dat=c.getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=0,y1=0;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(dat[(y*cv.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return [(x1-x0+1)/(cv.fine||1),(y1-y0+1)/(cv.fine||1)];};
   checks.profileVisibleSize=['snail','newt','moth'].map(k=>({kind:k,before:bbox(A.native.naFrame(k,'i0').cv),after:bbox(A.preview(k==='moth'?'moth-large':k,'i0',2).cv)}));
   checks.entityMutation=JSON.stringify([entities,W])!==snapshot;checks.renderedNativeFrames=rendered;checks.emptyFrames=transparent;checks.edgeTouchingFrames=touching;checks.edgeKeys=edgeKeys;const first=A.preview('frog','sit',0);checks.reuse=first===A.preview('frog','sit',0);checks.stats=A.stats();checks.nativeAnchors=['snail','newt','moth'].map(k=>({k,...NA_SPEC[k]}));Game.time=origT;
   return {imgs,checks};
  });
  if(!mobile)for(const [name,data]of Object.entries(out.imgs))fs.writeFileSync(path.join(__dirname,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
  report.profiles.push({mobile,checks:out.checks,pageErrors:errors,failedLocalRequests:requests});await page.close();
 }
 fs.writeFileSync(path.join(__dirname,'qa-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await srv.close();}})().catch(e=>{console.error(e);process.exitCode=1});
