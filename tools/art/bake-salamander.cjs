'use strict';
// Build-only lossless export of the approved native E frames. W is mirrored.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {chromium}=require(process.env.PW_CORE||path.join(root,'tools/browsers/node_modules/playwright-core'));
async function main(){
 const source=fs.readFileSync(path.join(__dirname,'salamander-source.js'));
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Salamander build</title>')}
  if(req.url==='/js/salamander-build-source.js'){res.setHeader('Content-Type','text/javascript');return res.end(source)}
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/html');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.VT_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{window.fyBlit=()=>{};window.sprSalamander=()=>null;window.salamanderDraw=()=>{};});
  await page.addScriptTag({url:base+'/js/salamander-build-source.js'});
  const result=await page.evaluate(async()=>{
   if(!await FantasySalamander.readyPromise)throw Error(FantasySalamander.errors.join(';'));
   const frames=[0,...Array.from({length:12},(_,i)=>30+i)],first=FantasySalamander.frame(2,0),w=first.img.width,h=first.img.height;
   const cv=Object.assign(document.createElement('canvas'),{width:w*frames.length,height:h}),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
   const hashes=[],dest=first.dest;
   for(const [i,fr]of frames.entries()){
    const f=FantasySalamander.frame(2,fr);if(JSON.stringify(f.dest)!==JSON.stringify(dest)||f.img.width!==w||f.img.height!==h)throw Error('Nonuniform cell');
    const pixels=f.img.getContext('2d').getImageData(0,0,w,h).data;
    hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),n=>n.toString(16).padStart(2,'0')).join(''));
    c.drawImage(f.img,...f.source,i*w,0,w,h);
   }
   return{png:cv.toDataURL('image/png'),meta:{frames,cell:[w,h],dest,rgbaSha256:hashes}};
  });
  const dir=path.join(root,'assets/fantasy/magicbeasts'),png=Buffer.from(result.png.split(',')[1],'base64');
  fs.writeFileSync(path.join(dir,'salamander-frames.png'),png);
  result.meta.pngSha256=crypto.createHash('sha256').update(png).digest('hex');
  result.meta.sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'salamander.png'))).digest('hex');
  fs.writeFileSync(path.join(dir,'salamander-frames.json'),JSON.stringify(result.meta,null,2)+'\n');
  console.log(JSON.stringify({bytes:png.length,...result.meta}));
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
