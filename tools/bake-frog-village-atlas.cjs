'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {chromium} = require(process.env.OG_PLAYWRIGHT || './browsers/node_modules/playwright-core');
const paint = require('./frog-village-art.cjs');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root,'js/fantasy-frog-village.js'),'utf8');
const entries = vm.runInNewContext('('+runtime.match(/const atlasEntries = (\{[\s\S]*?\});/)[1]+')');
const asset = runtime.match(/const assetPath = '([^']+)'/)[1];
const size = runtime.match(/atlas\.width!==(\d+)\|\|atlas\.height!==(\d+)/).slice(1).map(Number);
const chromePaths = [
  process.env.VT_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

async function main() {
  const executablePath = chromePaths.find(p=>p&&fs.existsSync(p));
  const browser = await chromium.launch({executablePath});
  try {
    const page = await browser.newPage();
    await page.addScriptTag({content:'window.paintVillage = '+paint.toString()});
    const result = await page.evaluate(({entries,size})=>{
      const canvas=(w,h)=>{
        const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;
      };
      const atlas=canvas(...size),c=atlas.getContext('2d');
      const metrics=[];
      for(const [key,[x,y,w,h,ax,ay]] of Object.entries(entries)){
        const [scale,level,phase,name]=key.split('|'),W=w*2,H=h*2;
        const layer=canvas(W,H),q=layer.getContext('2d',{willReadFrequently:true});
        paintVillage(q,name,phase,+level,+scale,ax,ay);
        const data=q.getImageData(0,0,W,H).data;
        let count=0,x0=W,y0=H,x1=-1,y1=-1;
        for(let iy=0;iy<H;iy++)for(let ix=0;ix<W;ix++){
          const a=data[(iy*W+ix)*4+3];
          if(a!==0&&a!==255)throw Error('Partial alpha '+key);
          if(!a)continue;
          count++;x0=Math.min(x0,ix);y0=Math.min(y0,iy);x1=Math.max(x1,ix);y1=Math.max(y1,iy);
        }
        if(!count||!x0||!y0||x1===W-1||y1===H-1)throw Error('Empty or clipped layer '+key);
        if(x<1||y<1||x+W>=size[0]||y+H>=size[1])throw Error('Layer outside atlas '+key);
        metrics.push({key,count,bounds:[x0,y0,x1,y1]});
        c.drawImage(layer,x,y);
      }
      return {png:atlas.toDataURL(),metrics};
    },{entries,size});
    fs.writeFileSync(path.join(root,asset),Buffer.from(result.png.split(',')[1],'base64'));
    console.log(JSON.stringify({asset,size,layers:result.metrics},null,2));
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
