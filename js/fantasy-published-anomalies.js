'use strict';
// Harmless non-animal night anomalies only. Sprite paint and presentation; native
// ST_KINDS, stFrame, stTick, replacement/restoration and creature objects stay intact.
(() => {
 if(window.FantasyPublishedAnomalies)return;
 const native={jelly:stJellySprite,lamp:stLampSprite,clock:stClockSprite,ribbon:stRibbonSprite,shards:stShardSprite,moon:stMoonSprite,draw:stDraw};
 const cache=new Map(),K=2,counts={jelly:6,lamp:8,clock:8,ribbon:8,shards:8,moon:6};
 const info=window.FantasyPublishedAnomalies={version:1,native,cache,rasterScale:K,counts,drawn:0,ready:Promise.resolve(),errors:[],auditStatus:'front-only; directional actor redesign pending',maxNativeEntries:44};
 function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.round(w*2)/2,Math.round(h*2)/2);}
 function oval(c,x,y,rx,ry,col){c.fillStyle=col;for(let yy=Math.floor((y-ry)*2)/2;yy<y+ry;yy+=.5){const q=(yy+.25-y)/ry;if(Math.abs(q)>=1)continue;const w=Math.sqrt(1-q*q)*rx,a=Math.ceil((x-w)*2)/2,z=Math.floor((x+w)*2)/2;if(z>a)c.fillRect(a,yy,z-a,.5);}}
 function shape(c,p,col){c.fillStyle=col;for(let y=Math.floor(Math.min(...p.map(a=>a[1]))*2)/2;y<Math.max(...p.map(a=>a[1]));y+=.5){const h=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],q=y+.25;if((a[1]<=q&&b[1]>q)||(b[1]<=q&&a[1]>q))h.push(a[0]+(q-a[1])*(b[0]-a[0])/(b[1]-a[1]));}h.sort((a,b)=>a-b);for(let i=0;i+1<h.length;i+=2){const x=Math.ceil(h[i]*2)/2,z=Math.ceil(h[i+1]*2)/2;if(z>x)c.fillRect(x,y,z-x,.5);}}}
 function line(c,x,y,xx,yy,w,col){const n=Math.max(1,Math.ceil(Math.hypot(xx-x,yy-y)*2));for(let i=0;i<=n;i++)rect(c,x+(xx-x)*i/n-w/2,y+(yy-y)*i/n-w/2,w,w,col);}
 function eye(c,x,y,blink=false){if(blink){rect(c,x,y+1,2,.5,'#38453b');return;}oval(c,x+1,y+1,1.6,1.8,'#5b6550');oval(c,x+1,y+1,1.2,1.5,'#ede8c8');rect(c,x+1,y+.5,.75,1.5,'#34463b');rect(c,x+.5,y,.5,.5,'#fff0ca');}
 const P={ink:'#35473c',deep:'#43634f',jade:'#779d78',light:'#b8c6a2',glint:'#e3dfb4',bronze:'#916c45',gold:'#c3a164',cream:'#e6dbb3',wood:'#68513a'};
 function paint(c,key,f,w,h){
  if(key==='jelly'){
   const cy=h/2,rx=f===2?5.8:f===5?5.6:5.1,ry=Math.max(1.3,(h-1)/2);
   oval(c,w/2,cy,rx,Math.min(ry,cy),P.ink);oval(c,w/2-.3,cy-.6,rx-.5,Math.min(ry-.6,cy-.5),'#6d9879');oval(c,w/2-.7,cy-.9,rx-1.2,Math.max(.7,Math.min(ry-1.2,cy-.8)),'#a2b58b');
   const top=Math.max(.5,cy-ry+1);oval(c,w/2-2,top+1.2,1.6,.7,'#d0d5a4');rect(c,w/2-2.5,top+1,1,.5,'#eee6bd');oval(c,w/2+2,cy-.7,1.4,.8,'#5b846b');
   const ey=Math.max(.5,Math.min(h-2.5,1.5));for(const x of [3.5,7.5]){oval(c,x,ey+.6,1,.8,'#ede8c8');rect(c,x,ey+.5,.5,1,'#34463b');}rect(c,5.5,Math.min(h-1,ey+2),1,.5,'#536c50');
   for(const x of [2.5,5.5,8.5])oval(c,x,h-1.3,.8,.6,'#567f65');
   if(f===4)rect(c,5.5,h-1,.5,1,'#b7c99e');
  }else if(key==='lamp'){
   const dim=f>=4,step=f&3,bob=step%2*.5,light=dim?(f===4?'#9b9d75':'#b7a779'):'#ead59b';
   line(c,5.5,7+bob,5.5,14,.8,P.wood);line(c,5.5,11,2,11.5+(step&1),.6,P.bronze);line(c,5.5,11,9,11.5-(step&1),.6,P.bronze);
   const legs=[[[4.5,16],[7,16]],[[5,15.5],[7,16]],[[3.5,16],[8,16]],[[5,16],[6.5,15.5]]][step];for(const[x,y]of legs){line(c,5.5,13.5,x,y,.7,P.wood);rect(c,x-.6,y,1.4,.5,P.bronze);}
   shape(c,[[3,10],[6,10.5],[8,12],[6,13],[3,12]],'#a47063');rect(c,3.5,10.5,2,.5,'#d0b28b');rect(c,7,11.5,.5,2,'#c4a06c');
   oval(c,5.5,1.7+bob,1.5,1.5,P.bronze);c.save();c.globalCompositeOperation='destination-out';oval(c,5.5,1.7+bob,.8,.8,'#000');c.restore();
   shape(c,[[1,3+bob],[4,1.5+bob],[7,1.5+bob],[10,3+bob],[9,4+bob],[2,4+bob]],'#496b5b');rect(c,2,3+bob,7,.5,'#a7b18b');rect(c,2.5,4+bob,6,4.5,P.bronze);rect(c,3,4.5+bob,5,3.5,light);rect(c,5,4+bob,.5,5,'#765e3d');rect(c,2,8.5+bob,7,1,P.bronze);rect(c,3,8.5+bob,5,.5,P.gold);rect(c,3.5,5+bob,1,2,dim?'#bbc097':'#fff0bd');
  }else if(key==='clock'){
   const m=9.5,rot=(f%4)*Math.PI/16;
   for(let i=0;i<10;i++){const a=i*Math.PI/5+rot;oval(c,m+Math.cos(a)*7.5,m+Math.sin(a)*7.5,1.8,1.8,P.bronze);oval(c,m+Math.cos(a)*7.4-.3,m+Math.sin(a)*7.4-.3,1.2,1.2,P.gold);}
   oval(c,m,m,8,8,'#514e3b');oval(c,m-.2,m-.2,7.2,7.2,'#c5ab76');oval(c,m,m,6.3,6.3,'#735f44');oval(c,m-.2,m-.2,5.6,5.6,'#e0d6af');
   for(let j=0;j<12;j++){const a=j*Math.PI/6;rect(c,m+Math.cos(a)*4.7-.25,m+Math.sin(a)*4.7-.25,.5,.5,'#947952');}
   const a=f*Math.PI/4-Math.PI/2,aa=f*Math.PI/24;line(c,m,m,m+Math.cos(a)*4,m+Math.sin(a)*4,.6,'#4d5544');line(c,m,m,m+Math.cos(aa)*2.5,m+Math.sin(aa)*2.5,.7,'#a17355');oval(c,m,m,.8,.8,P.gold);
   eye(c,5,5.5,f===3||f===7);eye(c,11,5.5,f===3||f===7);rect(c,8.5,12,2,.5,'#8e8861');rect(c,5,3.2,2.5,.5,'#f0e4ba');
  }else if(key==='ribbon'){
   const ys=x=>8+Math.sin(x*.45-f*Math.PI/4)*(1.5+x*.12);
   for(let x=0;x<26;x+=.5){const y=ys(x),th=x<4?1.5:x>22?4:3;rect(c,x,y-1,.5,th+1,'#654456');rect(c,x,y-.5,.5,th-.1,(Math.floor(x/3)&1)?'#c7a5a4':'#92596e');rect(c,x,y-.5,.5,.5,'#d5ba94');rect(c,x,y+th-1,.5,.5,'#b9a38a');if(Math.floor(x)%5===0)rect(c,x,y+.5,.5,.5,'#e7d3a4');}
   const y=Math.max(3,Math.min(h-4,ys(25)));shape(c,[[25,y-3],[28,y-3],[30,y-1],[29,y+3],[26,y+4],[24,y+2]],'#775064');rect(c,26,y-2,2,.5,'#d8b78d');eye(c,26,y-.5,f===3);rect(c,26,y+2,2,.5,'#bd8c83');
  }else if(key==='shards'){
   const m=13,a0=f*(Math.PI*2/5)/8;
   oval(c,m,m,3.6,2.5,'#6a725e');oval(c,m,m-.5,2.8,1.8,'#bba473');oval(c,m,m-.7,1.4,1.2,'#d1bcc0');rect(c,m-.5,m-1.5,.5,.5,'#f0e4c0');
   const parts=Array.from({length:5},(_,i)=>{const a=a0+i*Math.PI*2/5;return{x:m+Math.cos(a)*8.5,y:m+Math.sin(a)*4.6,front:Math.sin(a)>0};}).sort((a,b)=>a.y-b.y);
   for(const p of parts){shape(c,[[p.x-2,p.y],[p.x-1,p.y-3.3],[p.x,p.y-4],[p.x+2,p.y],[p.x,p.y+3.5]],'#4d7474');shape(c,[[p.x-1.5,p.y],[p.x-.6,p.y-2.8],[p.x,p.y-3.4],[p.x,p.y+2.5]],p.front?'#c4ddd1':'#8caea9');shape(c,[[p.x,p.y-3],[p.x+1.5,p.y],[p.x,p.y+2.5]],p.front?'#82b7b5':'#5d8f98');rect(c,p.x-1.5,p.y,3,.5,P.gold);rect(c,p.x-.5,p.y-2,.5,1.5,'#e3e6c2');}
  }else{
   const walk=f<4?f:0,bob=walk%2*.5,cx=8,cy=8+bob;
   // Gilded crescent, carved craters, two native stacked eyes and little copper feet.
   for(let y=0;y<17;y+=.5)for(let x=0;x<18;x+=.5){const out=Math.hypot(x+.25-cx,y+.25-cy),cut=Math.hypot(x+.25-(cx+5),y+.25-cy);if(out>7.5||cut<=5.7)continue;const edge=out>6.7||cut<6.4;rect(c,x,y,.5,.5,edge?'#9c8754':x<cx-2?'#e2d5a4':'#c3b678');}
   for(const[x,y,r]of[[4,3,1],[3,13,1],[6,1,.7]]){oval(c,x,y+bob,r,r,'#c0b27f');rect(c,x-.5,y-.5+bob,.5,.5,'#f0e1b3');}
   for(const y of [4,9]){if(f===5){rect(c,2,y+1+bob,3,.5,'#6f6849');rect(c,2.5,y+1.5+bob,2,.5,'#e9dfb5');}else eye(c,2,y+bob,f===4);}
   const legs=[[[5,0],[9,0]],[[6,-1],[9,1]],[[5.5,0],[9,0]],[[4,1],[9,-1]]][walk];for(const[x,d]of legs){line(c,x,16+bob,x,20.5+d,.7,P.bronze);rect(c,x-1,21+d,2.5,.5,P.wood);rect(c,x-.5,20.5+d,1,.5,P.gold);}
  }
 }
 function sprite(key,f){f=Math.trunc(Number(f)||0);f=((f%counts[key])+counts[key])%counts[key];const tag=key+f;if(cache.has(tag))return cache.get(tag);const src=native[key](f),w=src.width,h=src.height,cv=mkCanvas(w*K,h*K),c=cv.getContext('2d');c.scale(K,K);c.imageSmoothingEnabled=false;paint(c,key,f,w,h);cache.set(tag,cv);return cv;}
 stJellySprite=f=>sprite('jelly',f);stLampSprite=f=>sprite('lamp',f);stClockSprite=f=>sprite('clock',f);stRibbonSprite=f=>sprite('ribbon',f);stShardSprite=f=>sprite('shards',f);stMoonSprite=f=>sprite('moon',f);
 stDraw=function(c,o){const kind=ST_KINDS[o.k];if(!kind)return native.draw(c,o);const vis=Math.max(0,Math.min(1,(nightAmt()-.12)/.3));if(vis<=.02)return;const key=kind.id,f=stFrame(o),spr=sprite(key,f),w=spr.width/K,h=spr.height/K,px=o.x*TILE,py=o.y*TILE+3,lift=kind.fly?kind.hover+Math.sin(o.ph*2)*2:0;
  c.save();c.globalAlpha=vis;c.fillStyle='rgba(10,8,4,'+(.28-(kind.fly?.12:0))+')';c.beginPath();c.ellipse(px,py,kind.fly?6:5,1.8,0,0,7);c.fill();const light=o.k===1?[255,220,120,o.fl>0?.08:.22,18,-h+6]:o.k===4?[140,220,255,.2,18,-h/2]:o.k===2?[255,210,120,.1,12,-h/2]:o.k===5?[255,244,170,.16,16,-h/2]:null;
  if(light){const composite=c.globalCompositeOperation;c.globalCompositeOperation='lighter';for(let r=3;r>=1;r--){c.fillStyle='rgba('+light[0]+','+light[1]+','+light[2]+','+light[3]*vis/r+')';const R2=light[4]*(4-r)/3;c.beginPath();c.ellipse(px,py-lift+light[5],R2,R2*.8,0,0,7);c.fill();}c.globalCompositeOperation=composite;}
  c.imageSmoothingEnabled=R.smooth;c.translate(Math.round(px),Math.round(py-h-lift+1));if(o.face<0&&o.k!==4&&o.k!==2)c.scale(-1,1);c.drawImage(spr,-Math.round(w/2),0,w,h);c.restore();info.drawn++;
 };
})();


