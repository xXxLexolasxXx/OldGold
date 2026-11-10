'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.OG_PLAYWRIGHT||'./browsers/node_modules/playwright-core');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const target=path.resolve(process.argv[3]||path.join(root,'assets/fantasy'));
const chrome=[
  process.env.VT_CHROME,'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome','/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(p=>p&&fs.existsSync(p));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};

async function main() {
  const server=http.createServer(async (req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const name=path.resolve(root,'.'+pathname);
      if(!name.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const bytes=await fs.promises.readFile(name);
      res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'});
      res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:chrome});
  try{
    const page=await browser.newPage({serviceWorkers:'block'});
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
    await page.waitForFunction(()=>globalThis.GoblinFamilyDirections?.ready);
    const kinds=await page.evaluate(()=>GoblinFamilyDirections.kinds);
    const meta={};
    fs.mkdirSync(target,{recursive:true});
    for(const kind of kinds){
      const baked=await page.evaluate(kind=>{
        const G=GoblinFamilyDirections,paint=G.authorFrame||G.frame;
        const states=[...new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar])];
        const frames=[],views=['S','SE','E','NE','N'];
        const width=1024;
        for(const view of views)for(const fr of states){
          const {cv}=paint(kind,fr,view),c=cv.getContext('2d');
          const im=c.getImageData(0,0,cv.width,cv.height),data=im.data;
          let l=cv.width,t=cv.height,r=-1,b=-1;
          for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
            if(!data[(y*cv.width+x)*4+3])continue;
            if(x<l)l=x;if(y<t)t=y;if(x>r)r=x;if(y>b)b=y;
          }
          if(r<0){frames.push({key:view+'|'+fr,l:0,t:0,w:0,h:0});continue;}
          const w=r-l+1,h=b-t+1;
          const pixels=new ImageData(w,h);
          for(let y=0;y<h;y++){
            const start=((y+t)*cv.width+l)*4;
            pixels.data.set(data.subarray(start,start+w*4),y*w*4);
          }
          frames.push({key:view+'|'+fr,l,t,w,h,pixels});
        }
        const shelves=[];
        for(const f of frames.filter(f=>f.w).sort((a,b)=>b.h-a.h||b.w-a.w)){
          const w=f.w+2,h=f.h+2;
          let row=shelves.find(p=>p.x+w<=width&&p.h>=h);
          if(!row){const previous=shelves.at(-1);row={x:0,y:previous?previous.y+previous.h:0,h};shelves.push(row);}
          f.x=row.x+1;f.y=row.y+1;row.x+=w;
        }
        const last=shelves.at(-1);
        const atlas=document.createElement('canvas');atlas.width=width;atlas.height=last.y+last.h;
        const c=atlas.getContext('2d');
        const entries={};
        for(const f of frames){
          entries[f.key]=f.w?[f.x,f.y,f.w,f.h,f.l,f.t]:[0,0,0,0,0,0];
          if(f.w)c.putImageData(f.pixels,f.x,f.y);
        }
        return {width,height:atlas.height,entries,png:atlas.toDataURL()};
      },kind);
      const {width,height,entries,png}=baked;
      const name='goblin-family-'+kind+'.png';
      fs.writeFileSync(path.join(target,name),Buffer.from(png.split(',')[1],'base64'));
      meta[kind]={name,width,height,entries};
      console.log(kind,Object.keys(entries).length,width,height,fs.statSync(path.join(target,name)).size);
    }
    fs.writeFileSync(path.join(target,'goblin-family-frame-bank.json'),JSON.stringify(meta)+'\n');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
