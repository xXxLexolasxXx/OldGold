/* Build shared-scale x2 atlases against cold-native E, never fit each view separately. */
const fs=require('fs'),path=require('path'),{chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const dest='D:/для игры/feod/output/publish/oldgold-pages-20261104/assets/fantasy-birds';
(async()=>{
 const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'pack-plan.json'),'utf8'));
 const cold=JSON.parse(fs.readFileSync(path.join(__dirname,'cold-native.json'),'utf8')).data;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),manifest=[];
  for(const def of plan){
   const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'candidates',def.source+'.json'),'utf8'));
   const png=fs.readFileSync(path.join(__dirname,'candidates',def.source+'.png')).toString('base64');
   const baseline=cold[def.coldId||def.kind];if(!baseline)throw Error('Missing cold reference '+def.id);
   const coldPng=fs.readFileSync(path.join(__dirname,'cold-native',(def.coldId||def.kind)+'.png')).toString('base64');
   const result=await page.evaluate(async({def,raw,png,baseline,coldPng})=>{
    async function image64(s){const im=new Image();await new Promise((r,j)=>{im.onload=r;im.onerror=j;im.src='data:image/png;base64,'+s;});return im;}
    const im=await image64(png),old=await image64(coldPng),[w,h,ax,ay]=def.box;
    const source=document.createElement('canvas');source.width=im.width;source.height=im.height;const sc=source.getContext('2d');sc.drawImage(im,0,0);const pixels=sc.getImageData(0,0,im.width,im.height).data;
    function foot(data,pitch,x,y,bw,bh){for(let yy=Math.min(pitch===im.width?im.height:old.height,y+bh)-1;yy>=y;yy--){let sum=0,n=0;for(let xx=x;xx<x+bw;xx++)if(data[(yy*pitch+xx)*4+3]>=96){sum+=xx+.5;n++;}if(n)return[sum/n,yy+1];}return[x+bw*.5,y+bh];}
    const oc=document.createElement('canvas');oc.width=old.width;oc.height=old.height;const og=oc.getContext('2d');og.drawImage(old,0,0);const oldFoot=foot(og.getImageData(0,0,old.width,old.height).data,old.width,0,0,old.width,old.height).map(v=>v/2);
    const ref=raw.rows[2][def.referenceColumn??0];
    // A single transform is computed from E and used unchanged for all views and states.
    const xs=baseline.bbox[2]/ref[2],ys=baseline.bbox[3]/ref[3];
    const cols=def.takeColumns||Array.from({length:def.columns},(_,i)=>i);
    if(def.appendAttackWalkFeet)for(let i=0;i<12;i++)cols.push(13);
    const cv=document.createElement('canvas');cv.width=w*2*cols.length;cv.height=h*2*5;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;const rows=[];
    for(let row=0;row<5;row++){
     const rr=[];
     for(let j=0;j<cols.length;j++){
      const [sx,sy,sw,sh]=raw.rows[row][cols[j]],sf=foot(pixels,im.width,sx,sy,sw,sh),tx=j*w*2,ty=row*h*2;
      const dx=tx+(oldFoot[0]-(sf[0]-sx)*xs)*2,dy=ty+(oldFoot[1]-sh*ys)*2;
      c.save();c.beginPath();c.rect(tx,ty,w*2,h*2);c.clip();c.drawImage(im,sx,sy,sw,sh,dx,dy,sw*xs*2,sh*ys*2);
      if(def.appendAttackWalkFeet&&j>=def.columns){
       const [lx,ly,lw,lh]=raw.rows[row][j-def.columns],lf=foot(pixels,im.width,lx,ly,lw,lh),depth=5,band=Math.min(lh,Math.ceil(depth/ys));
       c.clearRect(tx,ty+(oldFoot[1]-depth)*2,w*2,depth*2+2);
       const legs=document.createElement('canvas');legs.width=lw;legs.height=band;const lg=legs.getContext('2d');lg.drawImage(im,lx,ly+lh-band,lw,band,0,0,lw,band);const ld=lg.getImageData(0,0,lw,band);
       const orange=(x,y)=>{if(x<0||y<0||x>=lw||y>=band)return false;const i=(y*lw+x)*4;return ld.data[i+3]>=96&&ld.data[i]>ld.data[i+1]*1.15&&ld.data[i]>ld.data[i+2]*1.5&&ld.data[i+1]>45;};
       const keep=new Uint8Array(lw*band);for(let y=0;y<band;y++)for(let x=0;x<lw;x++)if(orange(x,y)||orange(x-1,y)||orange(x+1,y)||orange(x,y-1)||orange(x,y+1))keep[y*lw+x]=1;
       for(let i=0;i<keep.length;i++)if(!keep[i])ld.data[i*4+3]=0;lg.putImageData(ld,0,0);
       c.drawImage(legs,tx+(oldFoot[0]-(lf[0]-lx)*xs)*2,ty+(oldFoot[1]-band*ys)*2,lw*xs*2,band*ys*2);
      }
      c.restore();rr.push([tx,ty,w*2,h*2]);
     }
     rows.push(rr);
    }
    const data=c.getImageData(0,0,cv.width,cv.height);for(let i=3;i<data.data.length;i+=4)data.data[i]=data.data[i]>=96?255:0;c.putImageData(data,0,0);
    return{png:cv.toDataURL(),meta:{compiled:true,pixelRatio:2,box:def.box,columns:cols.length,rows,width:cv.width,height:cv.height,worldScale:{reference:'cold-native E',referenceColumn:def.referenceColumn??0,x:xs,y:ys,sharedAcrossAllFiveViews:true,nativeVisible:baseline.bbox,nativeSupport:oldFoot}}};
   },{def,raw,png,baseline,coldPng});
   const stem=def.id+'-runtime-v'+(def.version||1);
   fs.writeFileSync(path.join(dest,stem+'.png'),Buffer.from(result.png.split(',')[1],'base64'));
   fs.writeFileSync(path.join(dest,stem+'.json'),JSON.stringify(result.meta,null,2));
   if(def.inManifest!==false)manifest.push({...def,source:undefined,columns:result.meta.columns,file:stem});
   console.log(def.id,result.meta.width,result.meta.height,JSON.stringify(result.meta.worldScale));
  }
  fs.writeFileSync(path.join(dest,'extra-packs.json'),JSON.stringify({packs:manifest},null,2));
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();process.exit(process.exitCode||0)}
})();
