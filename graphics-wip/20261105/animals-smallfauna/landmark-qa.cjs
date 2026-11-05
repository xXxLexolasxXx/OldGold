const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs');
(async()=>{const srv=await serve('D:/для игры/feod/output/publish/oldgold-pages-20261104'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const page=await browser.newPage({serviceWorkers:'block'});await page.goto(srv.url,{waitUntil:'load'});await page.evaluate(()=>FantasyPublishedSmallfauna.readyPromise);const result=await page.evaluate(()=>{
 const A=FantasyPublishedSmallfauna,frames=[...Array.from({length:12},(_,i)=>'i'+i),...Array.from({length:12},(_,i)=>'w'+i),...Array.from({length:6},(_,i)=>'h'+i),...Array.from({length:12},(_,i)=>'v'+i)],failures=[];let checks=0,maxError=0;
 for(const kind of['snail','newt','moth'])for(const fr of frames){const P=naPose(fr),up=P.up>.5?1:0,cur=P.hurt>.4?1.8:.9,sc=NA_SPEC[kind].sc;
  // Independent native anatomical coordinates from drawSnail / drawNewt / drawMoth,
  // not alpha extrema (a moth's highest opaque pixel is usually a wing).
  const nativeHead=kind==='snail'?(P.hurt>.4?null:[14.2,-5-up*3]):kind==='newt'?[15.2,-3.8+Math.sin((P.leg||0)*1.8)*cur-up*3.6]:[6,-18],nativeLantern=kind==='moth'?[-4.4,-14.4]:null;
  const pose=q=>{if(!q)return null;const rot=kind==='snail'?P.rot*.5:0,factor=kind==='moth'?.4:.5;return[(q[0]*Math.cos(rot)-q[1]*Math.sin(rot)+P.x*factor)*sc,6+(q[0]*Math.sin(rot)+q[1]*Math.cos(rot)+P.y*factor)*sc];};
  const got=A.landmarks(kind,fr,2);for(const[k,expected]of[['head',pose(nativeHead)],['lantern',pose(nativeLantern)],['ground',[0,6]]]){checks++;const actual=got[k];if(!expected){if(actual!==null)failures.push({kind,fr,k,expected,actual});continue;}const error=Math.max(...expected.map((v,i)=>Math.abs(v-actual[i])));maxError=Math.max(maxError,error);if(error>1e-6)failures.push({kind,fr,k,error,expected,actual});}
  for(let d=0;d<8;d++){const m=A.landmarks(kind,fr,d);if(m.ground[0]!==0||m.ground[1]!==6)failures.push({kind,fr,d,k:'ground'});}
 }
 return{ready:A.ready,scriptCount:[...document.scripts].filter(s=>s.src.includes('fantasy-published-smallfauna.js')).length,checks,maxError,failures,errors:A.errors,note:'Anatomical head centers and native lantern FX point in E, all 42 native poses per kind; native ground anchor in all 8 headings. Highest/lowest mask pixels are separate silhouette metrics.'};});
 fs.writeFileSync(path.join(__dirname,'landmark-qa-results.json'),JSON.stringify(result,null,2));assert(result.ready&&result.scriptCount===1&&result.failures.length===0&&result.errors.length===0,'Landmark/native anchor contract failed');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await srv.close();}})().catch(e=>{console.error(e);process.exitCode=1});
