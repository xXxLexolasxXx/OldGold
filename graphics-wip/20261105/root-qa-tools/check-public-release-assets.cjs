const{execFileSync}=require("child_process");
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('./browsers/node_modules/playwright-core');
const root=path.resolve(__dirname,'../output/publish/oldgold-pages-20261104');
const base=process.env.OLDGOLD_QA_URL||'https://xxxlexolasxxx.github.io/OldGold/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const p=await browser.newPage({viewport:{width:1366,height:900},serviceWorkers:'block'}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const files=['index.html','sw.js','js/changelog.js','css/fantasy-published-ui.css',...html.matchAll(/src="(js\/fantasy-[^"]+\.js)"/g)].map(x=>typeof x==='string'?x:x[1]);
 await p.goto(base,{waitUntil:'load',timeout:120000});
 await p.waitForFunction(()=>window.FantasyPublishedArt&&window.FantasyPublishedHaunts&&window.FantasyPublishedAppearanceArt,null,{polling:100,timeout:120000});
 const runtime=await p.evaluate(async()=>{const names=['FantasyPublishedArt','FantasyPublishedAppearanceArt','FantasyPublishedHaunts','FantasyDarkCourtPolish'];for(const n of names)if(window[n]?.ready)await window[n].ready;return{version:GAME_VERSION,mainAssets:Object.keys(FantasyPublishedArt.images).length,buildings:Object.keys(BUILDINGS).length,missingBuildings:Object.keys(BUILDINGS).filter(t=>!buildingSprite(t,0,1)._publishedArt),artErrors:FantasyPublishedArt.errors,hauntsErrors:FantasyPublishedHaunts.assets.errors,courtErrors:window.FantasyDarkCourtPolish?.assets?.errors||[],modules:Object.keys(window).filter(n=>/^Fantasy/.test(n)).sort()};});
 const checks=[];for(const file of [...new Set(files)]){const r=await p.request.get(new URL(file,base).href);checks.push({file,status:r.status(),exact:r.ok()&&sha(await r.body())===sha(execFileSync("git",["show","main:"+file],{cwd:root,maxBuffer:20*1024*1024}))});}
 // Native optional coop discovery is absent on a static Pages host; preserve it
 // explicitly without mistaking it for a missing game script or image.
 const optionalCoopRequests=requests.filter(r=>/\/coop-info(?:\?|$)/.test(r.url));
 const blockingRequests=requests.filter(r=>!optionalCoopRequests.includes(r));
 const report={base,...runtime,checks,errors,requests,optionalCoopRequests,blockingRequests};
 fs.writeFileSync(path.resolve(__dirname,'../output/fantasy/pages-compat/public-release-assets.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(checks.some(c=>!c.exact)||runtime.missingBuildings.length||runtime.artErrors.length||runtime.hauntsErrors.length||runtime.courtErrors.length||errors.length||blockingRequests.length)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
