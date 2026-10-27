// лист: каждый PNG из папки dir в сетку (по умолчанию ×1)
const fs=require('fs'),path=require('path');
const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async()=>{
 const dir=process.argv[2],out=process.argv[3],sc=+(process.argv[4]||1),cols=+(process.argv[5]||4);
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png'));
 const br=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const pg=await br.newPage({viewport:{width:cols*800*sc,height:1200}});
 const html='<body style="margin:0;background:#4a5d36;display:flex;flex-wrap:wrap;font:14px sans-serif;color:#fff">'+files.map(f=>`<div style="width:${790*sc}px;padding:4px"><div>${f}</div><img style="image-rendering:pixelated;width:${'AUTO'}" src="data:image/png;base64,${fs.readFileSync(path.join(dir,f)).toString('base64')}" onload="this.style.width=this.naturalWidth*${sc}+'px'"></div>`).join('');
 await pg.setContent(html);await pg.waitForTimeout(500);
 await pg.screenshot({path:out,fullPage:true});await br.close();
})();
