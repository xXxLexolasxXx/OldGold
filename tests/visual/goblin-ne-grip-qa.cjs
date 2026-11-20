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
  const source=OldGoldFrogTrollArtwork.frame('goblin','a6','E'),actual=OldGoldGoblinRuntime.strikeFrame('goblin','NE'),original=OldGoldFrogTrollArtwork.frame('goblin','a6','NE');
  const a=actual.cv.getContext('2d').getImageData(0,0,120,112).data,base=original.cv.getContext('2d').getImageData(0,0,120,112).data;
  const regions={},handSeeds=[];
  for(const [name,box]of [['blade',[79,63,10,7]],['grip',[73,63,7,8]]]){
   const part=mkCanvas(120,112),c=part.getContext('2d');c.imageSmoothingEnabled=false;const patch=mkCanvas(120,112),p=patch.getContext('2d');p.drawImage(source.cv,...box,...box);
   c.translate(70,65);c.rotate(-.45);c.translate(-66,-65);c.drawImage(patch,0,0);
   const pixels=c.getImageData(0,0,120,112).data;let expected=0,matching=0;const lost=[];
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=128){expected++;if(a[i+3]&&Math.max(Math.abs(pixels[i]-a[i]),Math.abs(pixels[i+1]-a[i+1]),Math.abs(pixels[i+2]-a[i+2]))<=4){matching++;if(name==='grip')handSeeds.push([i/4%120,Math.floor(i/4/120)]);}else lost.push([i/4%120,Math.floor(i/4/120)])}
   regions[name]={expected,matching,visible:matching/expected,lost};
  }
  const feet=[];
  for(const [x0,x1]of [[0,56],[56,120]]){let ink=0,diffs=0;for(let y=84;y<112;y++)for(let x=x0;x<x1;x++){const i=(y*120+x)*4;if(base[i+3])ink++;for(let k=0;k<4;k++)if(a[i+k]!==base[i+k]){diffs++;break}}
   feet.push({x0,x1,ink,diffs});if(!ink||diffs)throw Error('Foot pixels changed');}
  const gx=Math.round((actual.weapon.grip[0]+actual.ax)*2),gy=Math.round((actual.weapon.grip[1]+actual.ay)*2),seen=new Set(),queue=handSeeds.slice();let connected=false;
  while(queue.length){const [x,y]=queue.pop(),key=y*120+x;if(x<40||x>=100||y<62||y>=85||seen.has(key)||!a[key*4+3])continue;seen.add(key);if(x>=54&&x<=62&&y>=74&&y<=83){connected=true;break;}for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)queue.push([x+dx,y+dy]);}
  if(!connected)throw Error('Grip disconnected below the hood');
  if(regions.blade.visible<.95||regions.grip.visible<.95)throw Error('Weapon or hand hidden by body');
  const reverse=OldGoldGoblinRuntime.strikeFrame('goblin','NW');if(reverse.cv!==actual.cv||!reverse.mirror)throw Error('NW projection mismatch');
  const A=source,raw=OldGoldGoblinRuntime.strikeFrame('goblin','E').weapon,beforeLength=Math.hypot(raw.tip[0]-raw.grip[0],raw.tip[1]-raw.grip[1]),afterLength=Math.hypot(actual.weapon.tip[0]-actual.weapon.grip[0],actual.weapon.tip[1]-actual.weapon.grip[1]);
  if(Math.abs(beforeLength-afterLength)>1e-8)throw Error('Weapon length changed');
  return{regions,feet,connected,weaponLength:afterLength,weapon:actual.weapon};
 });
 reports[label]={...audit,errors,assetFailures};await context.close();
 }
 }finally{await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'ne-visibility-probe.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
}
main().catch(e=>{console.error(e);process.exitCode=1});