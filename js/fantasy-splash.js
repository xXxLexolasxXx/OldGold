'use strict';
// The title scene shares the production village assets, including its fire atlas.
// It runs before the game scripts, and needs no world or simulation state.
(() => {
  if (window.loadingStop) window.loadingStop();
  const cv=document.getElementById('load-cv'), box=document.getElementById('loading');
  const c=cv.getContext('2d'), art={}, failures=[];
  window.FantasySplash={art,failures,frames:0};
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
  function sprite(name,x,y,w,h){const a=art[name];if(a)c.drawImage(a.im,...a.rect,Math.round(x-w/2),Math.round(y-h),Math.round(w),Math.round(h));}
  function pine(x,y,s,col){rect(x-s,y-s*8,s*2,s*9,'#443d2c');for(let k=0;k<3;k++)poly([[x,y-s*(18-k*4)],[x-s*(6+k),y-s*(6-k*3)],[x+s*(6+k),y-s*(6-k*3)]],col);}
  function person(x,y,female,frame,view='S'){
    if(typeof FantasyArt==='undefined')return;
    const a=FantasyArt.images[female?'gnome-woman-walk':'gnome-walk'];if(!a?.frames)return;
    const f=a.frames[(view==='E'?8:0)+(frame%8)];if(!f)return;
    const h=22,w=f[2]/f[3]*h;
    c.drawImage(a.image,...f,Math.round(x-w/2),Math.round(y-h),Math.round(w),h);
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
    window.FantasySplash.frames++;
  }
  requestAnimationFrame(frame);
})();
