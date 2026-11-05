const fs=require('fs'),path=require('path');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('./qa-static-server.cjs');
const root='D:/для игры/feod/output/publish/oldgold-pages-20261104';
(async()=>{const server=await serve(root),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(server.url,{waitUntil:'load'});
const productionInfo=await page.evaluate(()=>({forestConnected:!!window.FantasyForestNeutrals,scripts:[...document.scripts].map(s=>s.getAttribute('src')).filter(s=>s&&/forest-neutrals|neutral-polish|leshy-polish/.test(s))}));
await page.addScriptTag({url:server.url+'/js/fantasy-published-forest-neutrals.js'});
await page.waitForFunction(()=>window.FantasyForestNeutrals?.ready);
const atlasOnly=process.argv.includes('--atlas-only');
const result=atlasOnly?{}:await page.evaluate(()=>{
const A=FantasyForestNeutrals;const errors=[],coverage=[];const dirs=A.headings;
smClose(()=>{Game.paused=true;});
const clipped=[],empty=[];
function check(s,label){const c=s.cv,w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data;let n=0,edge=false;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]){n++;if(!x||!y||x===w-1||y===h-1)edge=true;}if(!n)empty.push(label);if(edge)clipped.push(label);return s;}
const kinds=['pixie','fairy','leshy'];
for(const k of kinds){const frames=[...new Set(NA_ALL.concat(['parry','roar'],NA_FRAMES.parry||[],NA_FRAMES.roar||[],...(NA_EXTRA[k]||[]).map(n=>NA_FRAMES[n])))];let count=0;
for(const d of dirs)for(const f of frames){const s=check(A.frame(k,f,d),k+'|'+d+'|'+f);if(!s.cv.width)errors.push(k+d+f);count++;}coverage.push({kind:k,frames:frames.length,directions:8,count});}
for(const d of dirs)for(const f of LEP_ALL)check(A.lepFrame(f,d),'lep|'+d+'|'+f);
coverage.push({kind:'leprechaun',frames:LEP_ALL.length,directions:8,count:LEP_ALL.length*8});
for(const d of dirs){check(A.brownieFrame(d),'brownie|'+d);for(const carry of [0,1])check(A.enderFrame(carry,d),'ender|'+carry+'|'+d);for(const st of ['A','B','C'])for(let p=0;p<8;p++)for(const eye of [0,4])check(A.garFrame(st,p,d,eye),'gar|'+st+'|'+d+'|'+p);}
coverage.push({kind:'brownie',frames:1,directions:8,count:8},{kind:'enderman',frames:2,directions:8,count:16},{kind:'gargoyle A/B/C',frames:8,eyeLevelsTested:2,directions:8,count:384});
for(const d of dirs)for(const t of [.33,.67])for(let i=0;i<LEP_ALL.length-1;i++)A.lepFrame('m'+LEP_ALL[i]+'~'+LEP_ALL[i+1]+'~'+t,d);
for(const seq of [LEP_SEQ_TUG.concat(LEP_SEQ_STEAL),LEP_SEQ_TUG.concat(LEP_SEQ_SLAP)])for(let i=1;i<seq.length;i++)if(seq[i-1][0]&&seq[i][0]&&seq[i-1][0]!==seq[i][0])for(const t of [.33,.67])for(const d of dirs)check(A.lepFrame('m'+seq[i-1][0]+'~'+seq[i][0]+'~'+t,d),'lep mix|'+d+'|'+i+'|'+t);
for(const layer of ['B','F'])check(lepPotSprite(layer),'pot|'+layer);
const limits=A.limits;if(A.stats().entries>limits.entries||A.stats().rgba>limits.rgba)errors.push('cache limit');
const actor={k:'pixie',id:88,x:10,y:10,face:1,st:'roam',wx:11,wy:9,fr:'c4',hp:18,mhp:18};const before=JSON.stringify(actor),cv=document.createElement('canvas');cv.width=400;cv.height=400;neuDraw(cv.getContext('2d'),actor);if(JSON.stringify(actor)!==before)errors.push('NPC mutation');
const s=A.frame('pixie','i0','S');if(s!==A.frame('pixie','i0','S'))errors.push('cache miss repeat');
const testL={id:660,x:10,y:10,face:1,st:'duel',fr:'t2',tug:1,gx:11,gy:10,z:0,sink:0,potA:1,potX:10,potY:10,potT:1,rbD:1,rbP:1,rbA:1};
const lb=JSON.stringify(testL);lepDraw(cv.getContext('2d'),testL);if(lb!==JSON.stringify(testL))errors.push('leprechaun mutation');
const testE={x:10,y:10,face:1,st:'carry',mv:true,ph:2,dest:[11,9]},ef={end:testE},eb=JSON.stringify(ef),el=[];endermanDraw(el,cv.getContext('2d'),ef,0,0,100,100);el.forEach(p=>p[1]());if(eb!==JSON.stringify(ef))errors.push('enderman mutation');
const orientationChecks=dirs.map(d=>{const i=dirs.indexOf(d),r=i*Math.PI/4,o={x:0,y:0,face:1};return {expected:d,actual:A.direction(o,[Math.sin(r),Math.cos(r)])};});if(orientationChecks.some(x=>x.expected!==x.actual))errors.push('direction selection');
const runtimeDrawChecks=[];
function nativeOutputMatches(draw,expected){
 const target=document.createElement('canvas');target.width=target.height=400;const cx=target.getContext('2d'),old=cx.drawImage;let captured=null;
 cx.drawImage=function(...args){if(args[0].fine===2)captured={cv:args[0],flip:this.getTransform().a<0};return old.apply(this,args);};draw(cx);
 if(!captured)return {ok:false,reason:'native body not observed'};
 const out=document.createElement('canvas');out.width=captured.cv.width;out.height=captured.cv.height;const c=out.getContext('2d');c.imageSmoothingEnabled=false;if(captured.flip){c.translate(out.width,0);c.scale(-1,1);}c.drawImage(captured.cv,0,0);
 const actual=c.getImageData(0,0,out.width,out.height).data,wanted=expected.cv.getContext('2d').getImageData(0,0,out.width,out.height).data;let different=0;for(let i=0;i<actual.length;i++)if(actual[i]!==wanted[i])different++;return {ok:different===0,different};
}
for(let i=0;i<8;i++)for(const face of [-1,1]){
 const d=dirs[i],r=i*Math.PI/4,dx=Math.sin(r),dy=Math.cos(r);
 for(const fr of ['i0','w3','t2','l1']){
 const actor={id:770,x:0,y:0,face,st:'duel',fr,gx:dx,gy:dy,z:0,sink:0,potA:0},before=JSON.stringify(actor),out=nativeOutputMatches(c=>lepDraw(c,actor),A.lepFrame(fr,d));runtimeDrawChecks.push({kind:'leprechaun',dir:d,face,fr,...out});if(JSON.stringify(actor)!==before)errors.push('runtime lep mutation');}
 for(const carry of [0,1]){
 const e={x:0,y:0,face,st:carry?'carry':'roam',ph:2,mv:true,go:[dx,dy],dest:[dx,dy]},before=JSON.stringify(e),out=nativeOutputMatches(c=>{const list=[];endermanDraw(list,c,{end:e},-10,-10,10,10);list.forEach(p=>p[1]());},A.enderFrame(carry,d));runtimeDrawChecks.push({kind:'enderman',dir:d,face,carry,...out});if(JSON.stringify(e)!==before)errors.push('runtime ender mutation');}
}
if(runtimeDrawChecks.some(x=>!x.ok))errors.push('native direction/mirror mismatch');
const specialStateChecks=[];
for(let i=0;i<8;i++){
 const d=dirs[i],r=i*Math.PI/4,dx=Math.sin(r),dy=Math.cos(r),e={x:0,y:0,face:-1,st:'dig',ph:2,mv:false,tg:[dx,dy],go:[-dx,-dy]};
 specialStateChecks.push({kind:'ender dig',dir:d,...nativeOutputMatches(c=>{const list=[];endermanDraw(list,c,{end:e},-10,-10,10,10);list.forEach(p=>p[1]());},A.enderFrame(0,d))});
}
const unit=Game.units[0];if(unit){const n={k:'pixie',id:991,x:0,y:0,face:1,st:'roam',wx:0,wy:-1,fr:'i0',hp:18,mhp:18};neuDraw(cv.getContext('2d'),n);n.st='die';n.fr='d3';n.dt=.1;n.tg=unit.id;specialStateChecks.push({kind:'death orientation retained',...nativeOutputMatches(c=>neuDraw(c,n),A.frame('pixie','d3','N'))});}
if(specialStateChecks.some(x=>!x.ok))errors.push('special state direction');
const compare=document.createElement('canvas');compare.width=1440;compare.height=800;const cc=compare.getContext('2d');cc.imageSmoothingEnabled=false;cc.fillStyle='#252c29';cc.fillRect(0,0,1440,800);cc.fillStyle='#e8d9b6';cc.font='20px sans-serif';cc.fillText('До синхронизации этой ветки и после — реальные игровые кадры',20,30);cc.font='16px sans-serif';cc.fillText('Увеличено для сравнения; масштаб в игре сохранён',20,60);
const headings=['S','SE','E','NE','N'],texts=['До · профиль','Анфас','Передний 3/4','Профиль','Задний 3/4','Спина'];texts.forEach((t,i)=>cc.fillText(t,180+i*200-60,100));
for(let row=0;row<3;row++){cc.fillStyle='#e8d9b6';cc.fillText(['Цветочная фея','Лесная фея','Леший'][row],10,160+row*220);for(let i=0;i<6;i++){const sp=i===0?A.originals.naFrame(kinds[row],'i0'):A.frame(kinds[row],'i0',headings[i-1]),x=180+i*200,y=270+row*220;cc.drawImage(sp.cv,x-sp.ax*2.5,y-sp.ay*2.5,sp.w*2.5,sp.h*2.5);}}
// Native scene rehearsal: specimens join the real depth list, never Game NPCs.
const b=Game.buildings.find(b=>b.type==='school')||Game.buildings[0],gx=b.x-2,gy=b.y+b.h+1;
const oldList=drawSkeletons;drawSkeletons=function(list,c,...args){oldList(list,c,...args);for(let row=0;row<3;row++)for(let i=0;i<5;i++){
const d=['S','SE','E','NE','N'][i],vx={S:0,SE:1,E:1,NE:1,N:0}[d],vy={S:1,SE:1,E:0,NE:-1,N:-1}[d];
const n={k:kinds[row],id:910+i,x:gx+i*1.6,y:gy+row*3,face:1,st:'roam',wx:gx+i*1.6+vx,wy:gy+row*3+vy,fr:row===0?'c3':row===1?'w3':'ready',hp:82,mhp:82};list.push([n.y+.2,()=>neuDraw(c,n)]);}
};window.forestQAList=drawSkeletons;window.forestQACenter=[(gx+3.2)*TILE,(gy+3)*TILE];R.cam.z=3;centerOn(...window.forestQACenter);render();const nativePNG=R.canvas.toDataURL();drawSkeletons=oldList;
const qa=document.createElement('div');qa.id='forestQA';qa.style='position:absolute;inset:0 auto auto 0;width:1440px;background:#252c29;color:#f1e4c6;font:18px sans-serif;z-index:2147483647';document.body.append(qa);
const title=document.createElement('h2');title.textContent='Лесные нейтралы — реальные игровые спрайты';qa.append(title);
const text=document.createElement('p');text.textContent='Увеличено для сравнения; масштаб в игре сохранён';qa.append(text);
const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=760;sheet.style='position:relative;display:block;width:1440px;height:760px';qa.append(sheet);const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;c.font='16px sans-serif';c.fillStyle='#252c29';c.fillRect(0,0,1440,760);
const views=['S','SE','E','NE','N','NW','W','SW'],labels=['Анфас','Передний 3/4','Профиль','Задний 3/4','Спина','Задний 3/4','Профиль','Передний 3/4'];
for(let i=0;i<8;i++){c.fillStyle='#e8d9b6';c.fillText(labels[i],130+i*160,22);}
for(let row=0;row<3;row++){c.fillStyle='#e8d9b6';c.fillText(['Цветочная фея','Лесная фея','Леший'][row],8,90+row*225);
for(let i=0;i<8;i++){const s=A.frame(kinds[row],'i0',views[i]),x=200+i*160,y=205+row*225;c.fillStyle='#475247';c.fillRect(x-60,y,120,1);c.drawImage(s.cv,x-s.ax*2,y-s.ay*2,s.w*2,s.h*2);}}
const extra=document.createElement('canvas');extra.width=1440;extra.height=900;extra.style='position:relative;display:block;width:1440px;height:900px';qa.append(extra);const e=extra.getContext('2d');e.imageSmoothingEnabled=false;e.font='16px sans-serif';e.fillStyle='#252c29';e.fillRect(0,0,1440,900);
const actors=[['Лепрекон',(d)=>A.lepFrame('i0',d)],['Домовой',(d)=>A.brownieFrame(d)],['Долговяз',(d)=>A.enderFrame(0,d)],['Долговяз с деревом',(d)=>A.enderFrame(1,d)],['Горгулья А',(d)=>A.garFrame('A',4,d)],['Горгулья Б',(d)=>A.garFrame('B',4,d)],['Горгулья В',(d)=>A.garFrame('C',4,d)]];
for(let row=0;row<actors.length;row++){e.fillStyle='#e8d9b6';e.fillText(actors[row][0],8,30+row*125);for(let i=0;i<8;i++){const s=actors[row][1](views[i]),x=205+i*160,y=110+row*125,scale=row===3?1.05:row<2?2.5:row===2?1.5:2.5;e.drawImage(s.cv,x-s.ax*scale,y-s.ay*scale,s.w*scale,s.h*scale);}}
const poster=document.createElement('canvas');poster.width=1600;poster.height=2230;const pc=poster.getContext('2d');pc.imageSmoothingEnabled=false;pc.fillStyle='#252c29';pc.fillRect(0,0,1600,2230);pc.fillStyle='#e8d9b6';pc.font='24px sans-serif';pc.fillText('Лесные жители OldGold — реальные игровые модели',20,32);pc.font='17px sans-serif';pc.fillText('Увеличено для сравнения; масштаб в игре сохранён',20,65);
const ds=['S','SE','E','NE','N'];['Анфас','Передний 3/4','Профиль','Задний 3/4','Спина'].forEach((label,i)=>pc.fillText(label,260+i*260,100));
const roster=[...kinds.map((k,i)=>[(['Цветочная фея','Лесная фея','Леший'])[i],d=>A.frame(k,'i0',d)]),...actors];
roster.forEach(([name,get],row)=>{const y=110+row*210;pc.fillStyle='#e8d9b6';pc.font='17px sans-serif';pc.fillText(name,15,y+30);ds.forEach((d,i)=>{const sp=get(d),x=320+i*260,base=y+160,scale=name.startsWith('Долговяз')?2*.82:2;pc.fillStyle='#465147';pc.fillRect(x-65,base,130,1);pc.drawImage(sp.cv,x-sp.ax*scale,base-sp.ay*scale,sp.w*scale,sp.h*scale);});});
window.qaCanvas=sheet;return {coverage,errors,clipped,empty,orientationChecks,runtimeDrawChecks,specialStateChecks,stats:A.stats(),ready:A.ready,assetErrors:A.assetErrors,posterPNG:poster.toDataURL(),comparePNG:compare.toDataURL(),nativePNG,firstPNG:sheet.toDataURL(),otherPNG:extra.toDataURL()};});
if(!atlasOnly){
fs.writeFileSync(path.join(__dirname,'all-models-five-views.png'),Buffer.from(result.posterPNG.split(',')[1],'base64'));delete result.posterPNG;
fs.writeFileSync(path.join(__dirname,'before-after.png'),Buffer.from(result.comparePNG.split(',')[1],'base64'));delete result.comparePNG;
fs.writeFileSync(path.join(__dirname,'native-scene.png'),Buffer.from(result.nativePNG.split(',')[1],'base64'));delete result.nativePNG;
fs.writeFileSync(path.join(__dirname,'first-set-sprites.png'),Buffer.from(result.firstPNG.split(',')[1],'base64'));fs.writeFileSync(path.join(__dirname,'other-sprites.png'),Buffer.from(result.otherPNG.split(',')[1],'base64'));delete result.firstPNG;delete result.otherPNG;
await page.screenshot({path:path.join(__dirname,'first-set-directions.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>{document.getElementById('forestQA').style.display='none';const old=drawSkeletons;drawSkeletons=window.forestQAList;try{resize();R.cam.z=1.4;centerOn(...window.forestQACenter);render();return R.canvas.toDataURL();}finally{drawSkeletons=old;}});
fs.writeFileSync(path.join(__dirname,'native-scene-mobile.png'),Buffer.from(mobile.split(',')[1],'base64'));
}
fs.mkdirSync(path.join(__dirname,'cycles'),{recursive:true});
for(const kind of ['pixie','fairy','leshy','leprechaun','gargoyle'])for(const dir of ['S','SE','E','NE','N']){
const png=await page.evaluate(({kind,dir})=>{
const A=FantasyForestNeutrals,names={pixie:'Цветочная фея',fairy:'Лесная фея',leshy:'Леший',leprechaun:'Лепрекон',gargoyle:'Горгульи'},views={S:'Анфас',SE:'Передний 3/4',E:'Профиль',NE:'Задний 3/4',N:'Спина'};
let frames=kind==='leprechaun'?LEP_ALL.slice():kind==='gargoyle'?['A','B','C'].flatMap(s=>Array.from({length:8},(_,i)=>s+i)):[...new Set(NA_ALL.concat(NA_FRAMES.parry||[],NA_FRAMES.roar||[],...(NA_EXTRA[kind]||[]).map(n=>NA_FRAMES[n])))];
if(kind==='leprechaun'){for(const seq of [LEP_SEQ_TUG.concat(LEP_SEQ_STEAL),LEP_SEQ_TUG.concat(LEP_SEQ_SLAP)])for(let i=1;i<seq.length;i++)if(seq[i-1][0]&&seq[i][0]&&seq[i-1][0]!==seq[i][0])for(const t of [.33,.67])frames.push('m'+seq[i-1][0]+'~'+seq[i][0]+'~'+t);frames=[...new Set(frames)];}
const cv=document.createElement('canvas');cv.width=2800;cv.height=100+Math.ceil(frames.length/10)*240;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#252c29';c.fillRect(0,0,cv.width,cv.height);c.fillStyle='#e8d9b6';c.font='22px sans-serif';c.fillText(names[kind]+' — '+views[dir],20,30);c.font='16px sans-serif';c.fillText('Увеличено для сравнения; масштаб в игре сохранён',20,60);
const action={i:'Покой',w:'Шаг',a:'Атака',h:'Рана',d:'Гибель',v:'Радость',c:'Чары',k:'Проклятие',z:'Сон',p:'Защита',r:'Зов'},lepAction={i:'Покой',w:'Шаг',p:'Танец',t:'Слиток',x:'Кража',l:'Пощёчина'};
frames.forEach((f,i)=>{const s=kind==='leprechaun'?A.lepFrame(f,dir):kind==='gargoyle'?A.garFrame(f[0],+f.slice(1),dir):A.frame(kind,f,dir),x=(i%10)*280+160,y=100+Math.floor(i/10)*240+200,scale=kind==='gargoyle'?2:2;c.drawImage(s.cv,x-s.ax*scale,y-s.ay*scale,s.w*scale,s.h*scale);c.fillStyle='#e8d9b6';c.font='13px sans-serif';const label=kind==='gargoyle'?'Облик '+({A:'А',B:'Б',C:'В'})[f[0]]+' · взмах '+(+f.slice(1)+1):f[0]==='m'?'Переход '+(i+1):/^[a-z]\d+$/.test(f)&&((kind==='leprechaun'?lepAction:action)[f[0]])?((kind==='leprechaun'?lepAction:action)[f[0]]+' · '+(+f.slice(1)+1)):({ready:'Стойка',step:'Подступ',windup:'Замах',strike:'Удар',recover:'Возврат',parry:'Защита',hurt:'Рана',stagger:'Пошатывание',roar:'Зов'})[f]||'Поза';c.fillText(label,x-63,y+22);});
return cv.toDataURL();},{kind,dir});
fs.writeFileSync(path.join(__dirname,'cycles',kind+'-'+dir+'.png'),Buffer.from(png.split(',')[1],'base64'));
}
result.moduleSHA256=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'js/fantasy-published-forest-neutrals.js'))).digest('hex');
result.productionInfo=productionInfo;
if(!atlasOnly)fs.writeFileSync(path.join(__dirname,'qa-first-set.json'),JSON.stringify({...result,pageErrors:errors},null,2));
console.log(JSON.stringify({...result,runtimeDrawChecks:result.runtimeDrawChecks?{count:result.runtimeDrawChecks.length,failed:result.runtimeDrawChecks.filter(x=>!x.ok)}:undefined,pageErrors:errors}));
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});



