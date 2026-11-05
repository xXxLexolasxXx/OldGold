const fs=require('fs'),path=require('path');
const root=path.resolve('feod/output/publish/oldgold-pages-20261104');
const out=path.resolve('feod/output/fantasy/animals-waterlife');
const serve=require('../pages-compat/qa-static-server.cjs');
const {chromium}=require('../../../tools/browsers/node_modules/playwright-core');
(async()=>{const s=await serve(root),b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await b.newPage({serviceWorkers:'block'});await p.goto(s.url);await p.waitForFunction(()=>typeof seaSheet==='function');const info=await p.evaluate(()=>({roster:Object.fromEntries(Object.entries(SEA_ART).filter(([k])=>!['gull','corm','boat','pearl'].includes(k)).map(([k,A])=>[k,{w:A.w,h:A.h,ax:A.ax,ay:A.ay,pad:A.pad,anims:A.anims,frames:SEA_12.has(k)?12:null,pw:A.pw,ph:A.ph,pax:A.pax,pay:A.pay}])) ,image:seaSheet().toDataURL()}));fs.writeFileSync(path.join(out,'native-sea-sheet.png'),Buffer.from(info.image.split(',')[1],'base64'));delete info.image;fs.writeFileSync(path.join(out,'native-roster-raw.json'),JSON.stringify(info,null,2));await b.close();await s.close();})();
