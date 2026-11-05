const fs=require('fs');
const {chromium}=require('./browsers/node_modules/playwright-core');
(async()=>{const state=JSON.parse(fs.readFileSync('output/fantasy/current-graphics-preview.json','utf8'));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
  const p=await b.newPage({viewport:{width:1400,height:1000},serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(state.url,{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForFunction(()=>window.FantasyPublishedGallery?.ready,null,{polling:100,timeout:180000});
  await p.waitForTimeout(1200);
  const result=await p.evaluate(()=>({buildings:FantasyPublishedGallery.buildings.length,galleryErrors:FantasyPublishedGallery.errors,artErrors:FantasyPublishedArt.errors,canvas:[R.canvas.width,R.canvas.height],toolbar:!!document.querySelector('#gallery-controls'),nativeVersion:GAME_VERSION}));
  await p.screenshot({path:'output/fantasy/current-graphics-preview.png'});
  const report={...state,...result,errors};fs.writeFileSync('output/fantasy/current-graphics-preview-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(result.buildings!==41||errors.length||result.artErrors.length||result.galleryErrors.length||!result.toolbar)process.exitCode=1;
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
