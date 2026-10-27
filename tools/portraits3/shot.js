const fs=require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async()=>{
 const br=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
 const pg=await br.newPage({viewport:{width:1200,height:800}});
 pg.on('pageerror',e=>console.log('pageerror',e.message)); pg.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 await pg.goto('file:///D:/wt-portraits3/index.html'); await pg.waitForTimeout(2500);
 await pg.addScriptTag({content:fs.readFileSync('D:/wt-portraits3/js/campaign/facespx.js','utf8')});
 const Z=+(process.argv[3]||4);
 const d=await pg.evaluate(async(Z)=>{
  const ids=Object.keys(PXF_DRAW), S=72, cw=S*Z*2+S*2+40, chh=S*Z+40;
  const cols=2, rows=Math.ceil(ids.length/cols);
  const cv=document.createElement('canvas'); cv.width=cols*cw+20; cv.height=rows*chh+20; const c=cv.getContext('2d'); c.imageSmoothingEnabled=false; c.fillStyle='#2a2018'; c.fillRect(0,0,cv.width,cv.height); c.font='bold 16px sans-serif';
  const ld=async u=>{const im=new Image(); im.src=u; await im.decode(); return im;};
  for(let i=0;i<ids.length;i++){const x=10+(i%cols)*cw, y=10+Math.floor(i/cols)*chh;
   const a=await ld(campFaceUrl(ids[i],0)), b=await ld(pxfFaceUrl(ids[i],0)), b1=await ld(pxfFaceUrl(ids[i],1));
   c.fillStyle='#4a3a2a'; c.fillRect(x,y,S*Z,S*Z); c.fillRect(x+S*Z+8,y,S*Z,S*Z); c.drawImage(a,x,y,S*Z,S*Z); c.drawImage(b,x+S*Z+8,y,S*Z,S*Z);
   c.fillRect(x+2*S*Z+16,y,S,S); c.drawImage(b,x+2*S*Z+16,y); c.fillRect(x+2*S*Z+16,y+S+6,S,S); c.drawImage(b1,x+2*S*Z+16,y+S+6);
   c.fillStyle='#fff'; c.fillText(ids[i]+': было → стало',x,y+S*Z+22);}
  return cv.toDataURL();},Z);
 fs.writeFileSync(process.argv[2],Buffer.from(d.split(',')[1],'base64')); await br.close();})();
