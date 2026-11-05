'use strict';
// The title scene shares the production village assets, including its fire atlas.
// It runs before the game scripts, and needs no world or simulation state.
(() => {
  if (window.loadingStop) window.loadingStop();
  const cv=document.getElementById('load-cv'), box=document.getElementById('loading');
  const c=cv.getContext('2d'), art={}, failures=[];
  window.FantasySplash={art,failures,frames:0,people:0};
  const names=['inn','school','storehouse','bonfire-hearth','bonfire-flames'];
  for(const name of names) {
    const im=new Image(); im.onload=()=>{
      const scan=document.createElement('canvas'); scan.width=im.width; scan.height=im.height;
      const g=scan.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
      const data=g.getImageData(0,0,im.width,im.height).data;
      let l=im.width,t=im.height,r=0,b=0;
      for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(data[(y*im.width+x)*4+3]>100){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
      art[name]={im,rect:[l,t,r-l+1,b-t+1]};
    }; im.onerror=()=>failures.push(name); im.src='assets/fantasy/'+name+'-v1.png';
  }
  const subtitle=document.createElement('p');subtitle.className='fantasy-subtitle';subtitle.textContent='У каждого очага начинается история';
  box.querySelector('.load-title').appendChild(subtitle);
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
  const poly=(p,col)=>{c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
  const rand=n=>{let h=Math.imul(n+19,1597334677);h=Math.imul(h^(h>>>16),2246822519);return(h>>>0)/4294967295;};
  // The native heading is transparent: its DOM box only specifies placement.
  // Keep one thresholded pixel mask, rather than restoring smooth CSS text.
  let titleRaster=null,titleKey='';
  function title(W,H){
    const heading=box.querySelector('.load-title h1');if(!heading)return;
    const bounds=heading.getBoundingClientRect(),screen=cv.getBoundingClientRect();
    const size=Math.max(9,Math.round(parseFloat(getComputedStyle(heading).fontSize)*H/screen.height));
    const key=size+':'+W;
    if(key!==titleKey){
      const mask=document.createElement('canvas'),g=mask.getContext('2d',{willReadFrequently:true});
      const font=`bold ${size}px Georgia, serif`;g.font=font;
      mask.width=Math.ceil(g.measureText('OldGold').width)+8;mask.height=Math.ceil(size*1.5)+6;
      g.font=font;g.fillStyle='#fff';g.fillText('OldGold',4,size+2);
      const pixels=g.getImageData(0,0,mask.width,mask.height).data;
      const on=(x,y)=>x>=0&&y>=0&&x<mask.width&&y<mask.height&&pixels[(y*mask.width+x)*4+3]>115;
      const raster=document.createElement('canvas');raster.width=mask.width;raster.height=mask.height;
      const r=raster.getContext('2d'),ramp=['#fff3bc','#f4d780','#dca94e','#b77732','#79502c'];
      for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
        if(on(x,y)){r.fillStyle=ramp[Math.min(4,Math.floor((y-2)/size*5))];r.fillRect(x,y,1,1);}
        else if(on(x-1,y-1)||on(x+1,y)||on(x-1,y)||on(x,y-1)||on(x,y+1)){
          r.fillStyle='#382b27';r.fillRect(x,y,1,1);
        }
      }
      titleRaster=raster;titleKey=key;
    }
    const w=Math.min(titleRaster.width,W-12),h=titleRaster.height*w/titleRaster.width;
    const center=(bounds.top-screen.top+bounds.height/2)*H/screen.height;
    c.drawImage(titleRaster,Math.round((W-w)/2),Math.round(center-h/2),Math.round(w),Math.round(h));
    window.FantasySplash.title={width:Math.round(w),height:Math.round(h)};
  }
  function sprite(name,x,y,w,h){const a=art[name];if(a)c.drawImage(a.im,...a.rect,Math.round(x-w/2),Math.round(y-h),Math.round(w),Math.round(h));}
  function pine(x,y,s,col){const trees=window.FantasyTreesPolish?.base;if(trees?.length){const image=trees[Math.abs(Math.round(x))%trees.length],h=Math.max(8,Math.round(s*18)),w=Math.round(h*64/92);c.save();c.imageSmoothingEnabled=false;c.globalAlpha*=.8;c.drawImage(image,Math.round(x-w/2),Math.round(y-h),w,h);c.restore();return;}rect(x-s,y-s*8,s*2,s*9,'#443d2c');for(let k=0;k<3;k++)poly([[x,y-s*(18-k*4)],[x-s*(6+k),y-s*(6-k*3)],[x+s*(6+k),y-s*(6-k*3)]],col);}
  const previewPeople=new Map();
  function person(x,y,female,frame,view='S'){
    if(!window.FantasyPublishedAppearanceArt||typeof FantasyArt==='undefined')return;
    if(!FantasyArt.images[female?'gnome-woman-walk':'gnome-walk']?.frames)return;
    const key=(female?'f':'m')+view;
    if(!previewPeople.has(key))previewPeople.set(key,{type:'serf',look:female?14:23,sx:female?'f':'',carry:null});
    const walking=view==='E',phase=walking?Math.floor((frame%8)*WALK_FRAMES/8):0;
    const image=personSprite(previewPeople.get(key),view,walking?'walk':'idle',phase,{});
    const scale=2/3;
    c.drawImage(image,Math.round(x-PFX*scale),Math.round(y-PFY*scale),PW*scale,PH*scale);
    window.FantasySplash.people++;
  }
  let live=true,last=0;
  window.loadingStop=()=>{live=false;};
  const observer=new MutationObserver(()=>{if(box.classList.contains('hidden')){live=false;observer.disconnect();}});
  observer.observe(box,{attributes:true,attributeFilter:['class']});
  function frame(now){
    if(!live)return;requestAnimationFrame(frame);if(now-last<65||document.hidden)return;last=now;
    const W=Math.max(160,Math.ceil(cv.clientWidth/3)),H=Math.max(100,Math.ceil(cv.clientHeight/3));
    // Same 2 raster pixels per logical pixel as the approved building sprites.
    // Keep the authored composition in logical coordinates, not screen pixels.
    if(cv.width!==W*2||cv.height!==H*2){cv.width=W*2;cv.height=H*2;}
    c.setTransform(2,0,0,2,0,0);
    c.imageSmoothingEnabled=false;const t=now/1000,mobile=cv.clientWidth<700;
    const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#192d37');sky.addColorStop(.6,'#647a6d');sky.addColorStop(1,'#62724a');c.fillStyle=sky;c.fillRect(0,0,W,H);
    for(let i=0;i<45;i++)rect(rand(i)*W,rand(i+70)*H*.39,1,1,i%5?'#aeb6a0':'#e4d3a1');
    // Broad quiet silhouettes keep the title and the village readable.
    for(let k=0;k<3;k++){
      const p=[[0,H]];for(let x=-30;x<W+30;x+=24)p.push([x,H*(.38+k*.09)-rand(x+k*613)*H*.14]);p.push([W,H]);
      poly(p,['#354e52','#3e5c52','#4b684e'][k]);
    }
    poly([[0,H*.65],[W*.18,H*.57],[W*.53,H*.62],[W*.8,H*.56],[W,H*.66],[W,H],[0,H]],'#526e45');
    for(let i=0;i<150;i++){const x=rand(i+500)*W,y=H*(.63+rand(i+900)*.37);rect(x,y,2+rand(i)*3,1,i%3?'#5e7b4d':'#748853');}
    for(let i=0;i<18;i++){const left=i<9,x=left?rand(i+83)*W*.18:W*(.84+rand(i+83)*.16);pine(x,H*(.57+rand(i+44)*.27),.7+rand(i+92)*.7,i%2?'#2d493b':'#3b5940');}
    const cy=H*(mobile?.57:.72),cx=W*.5;
    // A winding slate path through the clearing, rather than a rectangular mat.
    for(let row=0;row<15;row++){
      const yy=cy+10+row*5,xx=cx+Math.sin(row*.35)*9;
      for(let k=-2;k<=2;k++){const x=xx+k*6+(row%2)*2;poly([[x,yy],[x+4,yy-1],[x+6,yy+2],[x+4,yy+4],[x,yy+3]],['#9c9d85','#a7a28a','#899681'][(row+k+20)%3]);}
    }
    const houseW=Math.min(mobile?67:100,W*.25);
    sprite('school',cx-W*.27,cy-6,houseW*.78,houseW*.95);
    sprite('inn',cx+W*.27,cy-6,houseW,houseW*.95);
    if(!mobile)sprite('storehouse',cx-W*.40,cy+11,houseW*.64,houseW*.59);
    // Chimney smoke is a separate drifting layer.
    for(let k=0;k<5;k++){const p=(t*.18+k*.2)%1;c.globalAlpha=(1-p)*.22;rect(cx+W*.27+houseW*.26+Math.sin(p*5)*4,cy-houseW*.97-p*24,3+p*5,2+p*3,'#d0cab4');}c.globalAlpha=1;
    person(cx-31,cy-10,false,0);person(cx+30,cy-9,true,0);
    const glow=c.createRadialGradient(cx,cy-8,1,cx,cy-8,47);glow.addColorStop(0,'#f4b86145');glow.addColorStop(1,'#f4b86100');c.fillStyle=glow;c.fillRect(cx-47,cy-55,94,94);
    sprite('bonfire-hearth',cx,cy+8,61,35);
    if(typeof FantasyArt!=='undefined'){
      const a=FantasyArt.images['bonfire-flames'];if(a?.frames){const f=a.frames[Math.floor(t*9)%8],h=37,w=f[2]/f[3]*h;c.drawImage(a.image,...f,Math.round(cx-w/2),cy-2-h,Math.round(w),h);}
    }
    for(let i=0;i<5;i++){const p=(t*.32+i*.2)%1;rect(cx+Math.sin(i*7+p*5)*9,cy-12-p*37,1,1,p<.5?'#edc984':'#b88e53');}
    person(cx-35,cy+21,true,0);person(cx+34,cy+20,false,0);
    const walk=(t*7)%(W*.42);person(cx-W*.21+walk,cy+42,false,Math.floor(t*7),'E');
    // A few fireflies, with deliberately restrained brightness.
    for(let i=0;i<6;i++){c.globalAlpha=.25+.25*Math.sin(t*1.5+i);rect(W*(.15+rand(i+808)*.7)+Math.sin(t*.4+i)*4,H*(.42+rand(i+801)*.32),1,1,'#dfd49a');}c.globalAlpha=1;
    const vignette=c.createRadialGradient(W/2,H*.52,H*.15,W/2,H*.52,Math.max(W,H)*.66);vignette.addColorStop(0,'#101d2000');vignette.addColorStop(1,'#101d20b3');c.fillStyle=vignette;c.fillRect(0,0,W,H);
    title(W,H);
    window.FantasySplash.frames++;
  }
  requestAnimationFrame(frame);
})();
