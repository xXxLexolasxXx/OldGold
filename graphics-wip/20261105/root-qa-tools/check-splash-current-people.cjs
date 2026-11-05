const fs=require('fs');
const {chromium}=require('./browsers/node_modules/playwright-core');
(async()=>{const server=await require('../output/fantasy/pages-compat/qa-static-server.cjs')('D:/для игры/feod/output/publish/oldgold-pages-20261104');
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{for(const width of[1400,390]){
  const p=await b.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  let release;const hold=new Promise(r=>release=r);
  await p.route('**/js/fantasy-published-ground.js',async r=>{await hold;await r.continue().catch(()=>{});});
  try{
   await p.goto(server.url,{waitUntil:'commit',timeout:120000});
   await p.waitForFunction(()=>window.FantasySplash?.people>10,null,{polling:100,timeout:120000});
   const result=await p.evaluate(()=>({people:FantasySplash.people,frames:FantasySplash.frames,failures:FantasySplash.failures,headVersion:FantasyPublishedAppearanceArt.version,visible:!document.getElementById('loading').classList.contains('hidden')}));
   await p.screenshot({path:`output/fantasy/pages-compat/splash-current-head-${width}.png`});
   console.log(JSON.stringify({width,...result,errors,method:'actual startup, final graphic script held for observation; no function substitution'}));
   if(!result.visible||result.people<10||result.headVersion<3||result.failures.length||errors.length)process.exitCode=1;
  }finally{release();await p.close();}
 }}finally{await b.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
