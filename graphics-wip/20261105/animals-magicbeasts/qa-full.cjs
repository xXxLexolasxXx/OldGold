const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs'),fs=require('fs'),path=require('path');
(async()=>{const server=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const results=[];for(const mobile of [false,true]){
const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block',isMobile:mobile,deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(server.url,{waitUntil:'networkidle'});await page.addScriptTag({url:server.url+'/js/fantasy-published-magicbeasts.js'});await page.evaluate(()=>FantasyMagicBeasts.readyPromise);
const report=await page.evaluate(()=>{
 const A=FantasyMagicBeasts,cv=document.createElement('canvas');cv.width=1440;cv.height=2000;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 c.fillStyle='#20332d';c.fillRect(0,0,cv.width,cv.height);c.fillStyle='#ffefd2';c.font='24px sans-serif';c.fillText('Волшебные звери — пять самостоятельных ракурсов',25,35);c.font='17px sans-serif';c.fillText('Увеличено для сравнения; по cold-native проверке есть расхождения видимого размера',25,63);
 const kinds=Object.keys(A.roster),names=['Единорог','Лесной дракончик','Огненный дракончик','Ледяной дракончик','Болотный дракончик','Взрослый дракон','Грифон','Саламандра'];
 const poses=k=>k==='unicorn'?['idle','walk']:k==='griffin'?['idle','walk','fly','take','atk','die']:k==='salamander'?['idle','work']:['idle','fly','sleep','flyatk'];
 const hash=s=>{let n=0;for(const x of s.getContext('2d').getImageData(0,0,s.width,s.height).data)n=(Math.imul(n,31)+x)|0;return n;};
 const coverage={},clipped=[];
 kinds.forEach((kind,row)=>{
  c.fillStyle='#ffefd2';c.font='20px sans-serif';c.fillText(names[row],25,110+row*230);
  coverage[kind]={};
  for(let dir=0;dir<8;dir++){
    const spr=A.preview(kind,dir,'idle',0),s=A.roster[kind],scale=kind==='adult'?1.25:2;
    c.drawImage(spr,100+dir*168-s.w*scale/2,125+row*230-2*scale,s.w*scale,(s.h+4)*scale);
    const act=A.preview(kind,dir,kind==='unicorn'?'walk':kind==='salamander'?'work':'fly',6);
    c.drawImage(act,100+dir*168-s.w*scale/2,205+row*230-2*scale,s.w*scale,(s.h+4)*scale);
  }
  for(const pose of poses(kind)){
    const byDir=[];
    for(let dir=0;dir<8;dir++){
      const hashes=[];
      for(let frame=0;frame<12;frame++){
        const spr=A.preview(kind,dir,pose,frame),d=spr.getContext('2d').getImageData(0,0,spr.width,spr.height).data;
        hashes.push(hash(spr));let edge=false;
        for(let x=0;x<spr.width;x++)if(d[x*4+3]||d[((spr.height-1)*spr.width+x)*4+3])edge=true;
        for(let y=0;y<spr.height;y++)if(d[(y*spr.width)*4+3]||d[(y*spr.width+spr.width-1)*4+3])edge=true;
        if(edge)clipped.push({kind,dir,pose,frame});
      }byDir.push({dir,samples:12,uniqueRasterFrames:new Set(hashes).size});
    }coverage[kind][pose]=byDir;
  }
 });
 window.magicSheet=cv.toDataURL().split(',')[1];
 const callbacks=[],mutation=[],nativeErrors=[],directionFailures=[];let qaDir=0;const ground=document.createElement('canvas');ground.width=800;ground.height=800;const g=ground.getContext('2d');
 function run(label,F,fn){
   const actor=F.uni||F.dr||F.gr||F.dp?.pets[0];
   if(actor){fn([],g,F,-100,-100,100,100);actor.x+=Math.sin(qaDir*Math.PI/4)*.01;actor.y+=Math.cos(qaDir*Math.PI/4)*.01;}
   const before=JSON.stringify(F),L=[];try{fn(L,g,F,-100,-100,100,100);L.forEach(v=>v[1]());callbacks.push({label,count:L.length});if(actor&&L.length&&A.directionOf(actor)!==qaDir)directionFailures.push({label,expected:qaDir,actual:A.directionOf(actor)});}catch(e){nativeErrors.push({label,error:String(e.stack)});}if(before!==JSON.stringify(F))mutation.push(label);
 }
 for(let dir=0;dir<8;dir++)for(let frame=0;frame<12;frame++){
   qaDir=dir;const ph=frame/12,face=dir>4?-1:1;
   for(const st of ['graze','flee'])run('uni:'+dir+':'+st+':'+frame,{uni:{x:5,y:5,face,st,ph,t:ph,life:20,mv:st==='flee',fa:Math.PI/2-dir*Math.PI/4}},unicornDraw);
   for(const stage of [0,1])for(const sp of ['forest','fire','ice','swamp'])for(const st of ['nest','out','land','fire','back','pet','gone'])run('dragon:'+stage+':'+sp+':'+dir+':'+st+':'+frame,{dr:{x:6,y:6,nx:3,ny:4,tx:8,ty:8,stage,sp,face,st,ph,z:['nest','land','gone'].includes(st)?0:14,loot:2,talk:true,fire:st==='fire'?[8,8,{}]:null}},dragonDraw);
   for(const pose of ['idle','walk','fly','take','atk','die']){
     const gr={x:6,y:6,nx:3,ny:4,wx:7,wy:6,face,st:pose==='die'?'dying':'patrol',ph,tr:3,z:['fly','take','atk'].includes(pose)?14:0,wlk:pose==='walk',tk:pose==='take'?GRI_TAKE_T*(1-ph):0,at:pose==='atk'?GRI_ATK_T*(ph||.001):0,dyT:pose==='die'?GRI_DIE_T*ph:0};run('griffin:'+dir+':'+pose+':'+frame,{gr},griffinDraw);
   }
   for(const sp of ['forest','fire','ice','swamp'])for(const st of ['home','with','away'])run('pet:'+sp+':'+dir+':'+st+':'+frame,{dp:{pets:[{x:6,y:6,z:st==='with'?20:0,sp,st,face,ph,lv:8,sick:frame%2,shot:{x:8,y:8,t:Game.time,fr:sp==='fire'}}]}},dpDraw);
 }
 const savedBuildings=Game.buildings;
 try{for(const rot of [0,1,2,3]){const b={id:-9876,doorX:5,doorY:5,rot};Game.buildings=[b];for(let f=0;f<12;f++)for(const bright of [.25,1])run('sal:'+rot+':'+bright+':'+f,{sal:[{bid:b.id,ph:f/12,bright}]},salamanderDraw);}}finally{Game.buildings=savedBuildings;}
 const repeat=A.preview('forest',2,'fly',0)===A.preview('forest',2,'fly',0);
 for(let i=0;i<2048;i++)A.preview(kinds[i%8],i%8,'cache-stress-'+(i%19),i%12);
 const stats=A.stats();return{ready:A.ready,errors:A.errors,coverage,clipped,mutation,nativeErrors,directionFailures,nativeCases:callbacks.length,nativeCallbacks:callbacks.reduce((a,b)=>a+b.count,0),repeat,stats};
});
report.mobile=mobile;report.pageErrors=errors;results.push(report);
if(!mobile){const sheet=await page.evaluate(()=>magicSheet);fs.writeFileSync(path.join(__dirname,'all-beasts-review.png'),Buffer.from(sheet,'base64'));}
await page.close();}
fs.writeFileSync(path.join(__dirname,'qa-full-result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({mobile:r.mobile,ready:r.ready,errors:r.errors,nativeCases:r.nativeCases,nativeErrors:r.nativeErrors.slice(0,3),directionFailures:r.directionFailures.length,mutations:r.mutation.length,clipped:r.clipped.length,repeat:r.repeat,stats:r.stats,pageErrors:r.pageErrors}))));
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
