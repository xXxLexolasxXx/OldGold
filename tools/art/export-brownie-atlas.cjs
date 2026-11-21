'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PW_CORE || path.resolve(__dirname,'../../tools/browsers/node_modules/playwright-core'));
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const out=path.resolve(process.argv[3]||path.join(root,'output/art/brownie-atlas'));
fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.html':'text/html','.png':'image/png','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
const save=zlib.gunzipSync(fs.readFileSync(path.join(root,'tests/saves/v0.11.9-solo-meadow-s12.json.gz'))).toString();
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
 for(const mobile of [false]){
  const label=mobile?'mobile':'desktop';console.log('start',label,path.basename(root));
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},
    isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(), errors=[], assetFailures=[]; page.setDefaultTimeout(120000);if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  page.on('pageerror',err=>errors.push(err.message));
  page.on('response',res=>{if(res.status()>=400 && /salamander|gold-goose/.test(res.url()))assetFailures.push(res.url())});
  await page.addInitScript(raw=>{let seed=123456789;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};localStorage.setItem('feod.save.manual',raw);localStorage.setItem('feod.save.manual.meta','{"time":1}');},save);
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded',timeout:120000});
  const preflight=await page.evaluate(async()=>{
   if(!window.OldGoldGoblinRuntime)throw Error('Production index did not register goblin runtime');
   return {ok:await OldGoldGoblinRuntime.ready,errors:OldGoldGoblinRuntime.errors,artErrors:OldGoldFrogTrollArtwork.errors};
  });
  if(!preflight.ok)throw Error(JSON.stringify(preflight));
  await page.waitForFunction(()=>{const b=document.querySelector('#start-menu [data-sm="continue"]');return b&&b.offsetWidth&&!b.disabled});
  await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.offsetWidth&&b.textContent.trim()==='Понятно')?.click();document.querySelector('#start-menu [data-sm="continue"]').click()});
  await page.waitForFunction(()=>typeof Game!=='undefined'&&!StartMenu.open&&Game.buildings.length>0);




 const audit=await page.evaluate(async()=>{
  const A=FantasyForestRosterV4;await A.readyPromise;Game.paused=true;
  if(A.loadBrownieSource&&!(await A.loadBrownieSource()))throw Error('Brownie authoring source unavailable');
  const dirs=['S','SE','E','NE','N','NW','W','SW'],frames=['i0',...Array.from({length:9},(_,i)=>'peek'+i)],atlas=mkCanvas(960,896),c=atlas.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;
  const raw=[],entries=[],sourceModels={};
  for(const [row,dir]of dirs.entries()){
   const view=({SW:'SE',W:'E',NW:'NE'})[dir]||dir,M=A.models.brownie[view];sourceModels[view]={p:M.p,foot:M.foot,footY:M.footY,sockets:M.sockets,hips:M.legs.map(q=>q.hip)};
   for(const [col,fr]of frames.entries()){
    const sp=A.brownieSourceFrame?A.brownieSourceFrame(fr,dir):A.frame('brownie',fr,dir);if(sp.cv.width!==96||sp.cv.height!==112||sp.ax!==24||sp.ay!==52)throw Error('Unexpected brownie frame envelope');
    const d=sp.cv.getContext('2d').getImageData(0,0,96,112).data;raw.push(d);c.drawImage(sp.cv,col*96,row*112);entries.push({dir,fr,box:[col*96,row*112,96,112],anchor:[24,52],world:[48,56]});
   }
  }
  const d=c.getImageData(0,0,960,896).data;let difference=0;
  for(const [i,e]of entries.entries())for(let y=0;y<112;y++)for(let x=0;x<96;x++)for(let q=0;q<4;q++)if(raw[i][(y*96+x)*4+q]!==d[((e.box[1]+y)*960+e.box[0]+x)*4+q])difference++;
  if(difference)throw Error('Atlas composition changed '+difference+' RGBA channels');
  const png=atlas.toDataURL(),image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=png;});
  const decoded=mkCanvas(960,896),dc=decoded.getContext('2d',{willReadFrequently:true});dc.drawImage(image,0,0);const check=dc.getImageData(0,0,960,896).data;let decodeDifferences=0;for(let i=0;i<d.length;i++)if(d[i]!==check[i])decodeDifferences++;if(decodeDifferences)throw Error('PNG decode changed '+decodeDifferences+' RGBA channels');
  let bytes='';for(let i=0;i<d.length;i+=8192)bytes+=String.fromCharCode(...d.subarray(i,i+8192));
  return{images:[{name:'brownie-peek-v1',image:png}],raws:[],atlasRgba:btoa(bytes),entries,sourceModels,compositionDifferences:difference,decodeDifferences,errors:[]};
 });
 fs.writeFileSync(path.join(out,label+'-brownie-atlas.rgba'),Buffer.from(audit.atlasRgba,'base64'));delete audit.atlasRgba;
 for(const x of audit.raws)fs.writeFileSync(path.join(out,label+'-'+x.name+'.rgba'),Buffer.from(x.rgba,'base64'));delete audit.raws;
 for(const x of audit.images)fs.writeFileSync(path.join(out,label+'-'+x.name+'.png'),Buffer.from(x.image.split(',')[1],'base64'));delete audit.images;
 reports[label]={...audit,pageErrors:errors,assetFailures};fs.writeFileSync(path.join(out,'focused-checks.json'),JSON.stringify(reports,null,2));console.log(label,JSON.stringify({candidate:audit.candidate,measurements:audit.measurements,errors:audit.errors,pageErrors:errors,cache:audit.cache,masks:audit.masks,zooms:audit.zooms}));await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'focused-checks.json'),JSON.stringify(reports,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
