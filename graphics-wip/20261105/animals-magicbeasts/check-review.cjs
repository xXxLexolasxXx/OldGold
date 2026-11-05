const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const serve=require('../pages-compat/qa-static-server.cjs'),fs=require('fs'),path=require('path');
(async()=>{const server=await serve('D:/для игры/feod/output'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:850},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(server.url+'/fantasy/animals-magicbeasts/animation-review.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('QA-просмотр'),null,{timeout:120000});
 const checks=[];
 for(const [kind,pose]of [['unicorn','walk'],['forest','fly'],['fire','atk'],['ice','sleep'],['swamp','fly'],['adult','atk'],['griffin','die'],['salamander','atk']]){
  await page.selectOption('#kind',kind);await page.selectOption('#pose',pose);await page.waitForTimeout(150);await page.screenshot({path:path.join(__dirname,'animation-'+kind+'-'+pose+'.png')});checks.push({kind,pose});
 }
 fs.writeFileSync(path.join(__dirname,'review-check.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
