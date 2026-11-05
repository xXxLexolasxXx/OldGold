'use strict';
// All seven native roadside curiosities, painted at2px/world. No scene/gameplay hooks.
// Load after fantasy-streets.js. Native drawDecorObj owns growth and night morphs.
(() => {
 if(window.FantasyPublishedObelisk||typeof drawMagicObj!=='function')return;
 const native=drawMagicObj,W=64,H=76,K=2,OX=16,OY=46,base=new Map();
 const info=window.FantasyPublishedObelisk={version:1,native,base,rasterScale:K,drawn:0,kinds:['rune','well','scarecrow','mushroomRing','stoneDwarf','cauldron','crystalPillar']};
 const P={ink:'#3b3c30',deep:'#414d45',shade:'#69786b',stone:'#97a18a',light:'#c2c4a2',edge:'#e0d5ad',bronze:'#8e6941',gold:'#c3a165',shine:'#ead29a',wood:'#614a31',grain:'#a0804d',moss:'#66805a'};
 function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.round(w*2)/2,Math.round(h*2)/2);}
 function shape(c,pts,col){c.fillStyle=col;for(let y=Math.floor(Math.min(...pts.map(p=>p[1]))*2)/2;y<Math.max(...pts.map(p=>p[1]));y+=.5){const hits=[];for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length],yy=y+.25;if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))hits.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let k=0;k+1<hits.length;k+=2){const x=Math.ceil(hits[k]*2)/2,z=Math.ceil(hits[k+1]*2)/2;if(z>x)c.fillRect(x,y,z-x,.5);}}}
 function oval(c,x,y,rx,ry,col){c.fillStyle=col;for(let yy=Math.floor((y-ry)*2)/2;yy<y+ry;yy+=.5){const q=(yy+.25-y)/ry;if(Math.abs(q)>=1)continue;const w=Math.sqrt(1-q*q)*rx,a=Math.ceil((x-w)*2)/2,z=Math.floor((x+w)*2)/2;if(z>a)c.fillRect(a,yy,z-a,.5);}}
 function foot(c,w=19){oval(c,17,26.5,w*.65,2.3,'rgba(25,36,25,.24)');shape(c,[[16-w/2,25],[17-w/2,21.5],[15+w/2,21.5],[16+w/2,25],[16+w/2-1,27],[16-w/2+1,27]],P.ink);rect(c,17-w/2,23,w-2,3,P.shade);rect(c,18-w/2,22,w-4,1,P.light);rect(c,18-w/2,25,w-4,.5,P.gold);for(const dx of [-4,0,4])rect(c,16+dx,24.5,1,.5,P.edge);}
 function moss(c,x,y){rect(c,x,y,3,.5,P.moss);rect(c,x+1,y-.5,2,.5,'#91a86a');rect(c,x+3,y+.5,2,.5,'#51684c');}
 function rune(c,x,y,col,style=0){
  const paths=style%3===0?[[0,0],[3,2],[0,4],[3,6]]:style%3===1?[[0,0],[0,6],[3,4],[0,2]]:[[0,0],[3,0],[1.5,2],[1.5,6]];
  for(let i=1;i<paths.length;i++){const[a,b]=[paths[i-1],paths[i]],n=Math.ceil(Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]))*2);for(let j=0;j<=n;j++){const t=j/n;rect(c,x+a[0]+(b[0]-a[0])*t,y+a[1]+(b[1]-a[1])*t,.5,.5,col);}}
 }
 function mushroom(c,x,y,s,col){rect(c,x-s*.45,y-s*2,Math.max(.5,s*.8),s*2,'#dad1aa');rect(c,x-s*.45,y-s*1.4,.5,s*1.3,'#a19373');oval(c,x+.4,y-s*2.2,s*2.1,s*.8,P.ink);oval(c,x,y-s*2.6,s*2,s*1.35,col);oval(c,x-s*.4,y-s*3,s*1.1,s*.55,'#e8c995');rect(c,x-s*.8,y-s*3,.5,.5,'#f2e3b8');}
 function body(c,v){
  if(v===0){foot(c,20);shape(c,[[7,22],[8,2],[11,-5],[19,-7],[24,-2],[25,22]],P.ink);shape(c,[[9,21],[10,2],[12,-3],[18,-5],[21,-2],[22,21]],P.stone);shape(c,[[18,-5],[22,-2],[23,21],[18,21]],P.shade);shape(c,[[10,3],[12,-2],[17,-4],[17,-2],[12,1],[11,17],[10,19]],P.light);rect(c,9.5,4,12,2,P.bronze);rect(c,10,4,10,.5,P.shine);rect(c,10,19,12,2,P.bronze);rect(c,10,19,11,.5,P.gold);shape(c,[[12,8],[19,7],[20,17],[12,18]],P.deep);rect(c,12.5,8,6,.5,P.ink);rune(c,14,9,P.gold);rect(c,10.5,1,1.5,.5,P.edge);rect(c,20.5,8,.5,5,P.light);rect(c,20.5,15,1,.5,P.deep);moss(c,7,22);moss(c,21,25);}
  else if(v===1){
   foot(c,25);rect(c,4,15,24,8,P.ink);rect(c,5,15,22,7,P.shade);rect(c,5,17,22,1,P.deep);rect(c,5,20,22,.5,P.deep);for(const[xx,yy]of[[10,15],[20,15],[14,18],[23,18]])rect(c,xx,yy,.5,3,P.deep);rect(c,6,15,4,1,P.light);rect(c,16,18,6,1,P.stone);oval(c,16,14,12.5,4.5,P.ink);oval(c,16,13.5,11.5,4,P.light);oval(c,16,13.5,9,2.8,'#2e5655');oval(c,16,14,7.5,1.8,'#4d8380');
   for(const x of [5,25]){rect(c,x,0,2,15,P.wood);rect(c,x+.5,.5,.5,13,P.grain);rect(c,x-.5,11,3,1,P.bronze);rect(c,x,11,2,.5,P.gold);}
   shape(c,[[0,2],[3,-1],[13,-6],[17,-7],[23,-4],[32,2],[30,4],[3,4]],P.ink);shape(c,[[2,2],[13,-4.5],[17,-5.5],[19,-4],[15,2.5]],'#7c9a7d');shape(c,[[17,-5.5],[23,-3],[30,2],[16,2.5]],'#4b7566');for(const[y,x,w]of[[-2,11,10],[0,6,19],[2,3,27]])rect(c,x,y,w,.5,y===2?P.gold:'#a7b395');for(const x of [9,15,22])rect(c,x,-1,1,1,'#3d6559');
   rect(c,15.5,3,.5,7,P.grain);rect(c,13.5,9,4.5,3.5,P.wood);rect(c,14,9,4,.5,P.gold);rect(c,14.5,10,.5,2,'#c3a47a');moss(c,4,23);moss(c,25,24);
  }else if(v===2){
   oval(c,17,26,9,2,'rgba(25,36,25,.25)');rect(c,15,0,2,26,P.wood);rect(c,15.5,8,.5,17,P.grain);rect(c,3,6,26,2,P.wood);rect(c,4,6,23,.5,P.grain);
   for(const x of [3,27]){shape(c,[[x-3,7],[x+1,6],[x+3,9],[x+2,10],[x,8],[x-2,10]],'#c2a463');rect(c,x,7,.5,4,'#e2c486');}
   shape(c,[[10,6],[21,6],[24,18],[21,20],[18,18],[14,20],[8,18]],'#374e43');shape(c,[[11,7],[20,7],[22,17],[18,17],[15,18],[10,17]],'#648373');rect(c,11,8,2,6,'#8f9a79');rect(c,15,8,2,10,'#3e6356');rect(c,12,14,4,3,'#b18a60');rect(c,13,14,2,.5,'#d5b67d');
   for(const x of [10,13,19,21]){rect(c,x,18,.5,5,'#d7ba78');rect(c,x+.5,19,.5,2,'#9b8252');}
   oval(c,16,5,4.8,5,P.ink);oval(c,15.5,4.5,4.1,4.4,'#cda36a');rect(c,14.5,3,1,1,'#414233');rect(c,17.5,3,1,1,'#414233');rect(c,14,6,4,.5,'#6f5739');rect(c,15,5,.5,2,'#6f5739');
   shape(c,[[9,2],[11,-2],[12,-8],[17,-10],[19,-7],[20,-3],[23,1],[22,3]],'#423f44');shape(c,[[11,0],[13,-4],[14,-8],[17,-9],[18,-5],[20,0]],'#846773');rect(c,9,1,14,1.5,P.bronze);rect(c,10,1,11,.5,P.shine);rect(c,20,2,2,5,'#b88d52');rect(c,21,5,1,3,'#d7b77c');
  }else if(v===3){
   oval(c,16,23,15,5.3,'rgba(31,56,36,.38)');oval(c,16,22,13.5,4.7,'#5e7952');oval(c,16,22,10.5,3.5,'#78915f');oval(c,16,22,6,2,'#4d6751');
   for(let j=0;j<8;j++){const a=j/8*Math.PI*2,x=16+Math.cos(a)*12,y=22+Math.sin(a)*4.7;oval(c,x,y+.5,2,1.2,P.deep);mushroom(c,x,y,1+(j%3)*.15,j%2?'#a55b4c':'#c5ae7c');}
   shape(c,[[13,22],[14,19],[18,19],[20,22],[17,24],[14,24]],P.bronze);rect(c,14,21,4,.5,P.gold);rect(c,16,20,1,3,'#b9cc9b');moss(c,4,25);moss(c,25,26);
  }else if(v===4){
   foot(c,21);shape(c,[[9,21],[8,15],[10,7],[13,5],[20,6],[24,15],[23,21]],P.ink);shape(c,[[11,20],[10,15],[12,8],[19,7],[22,16],[21,20]],P.stone);rect(c,11,12,2,5,P.light);rect(c,18,12,2,6,P.shade);rect(c,12,19,4,2,P.deep);rect(c,18,19,3,2,P.deep);
   shape(c,[[10,8],[12,3],[14,2],[19,3],[22,8],[20,12],[16,17],[12,13]],P.light);shape(c,[[12,9],[14,13],[16,15],[18,11],[20,8]],P.stone);for(const[x,y,h]of[[13,9,3],[15,10,4],[18,8,3]])rect(c,x,y,.5,h,P.edge);
   oval(c,16,7.5,4,3.2,P.stone);rect(c,14.5,7.5,1,1,P.deep);rect(c,17.5,7.5,1,1,P.deep);oval(c,16,9.5,1.5,1,P.edge);
   shape(c,[[10,5],[12,2],[14,-4],[18,-6],[20,-2],[22,5]],P.ink);shape(c,[[12,4],[14,0],[16,-3],[18,-4],[19,-1],[20,4]],P.shade);rect(c,11,4,10,1.5,P.bronze);rect(c,12,4,8,.5,P.gold);
   rect(c,23,6,1,15,P.bronze);shape(c,[[20,6],[23,3],[27,4],[29,7],[26,6],[23,6],[21,8]],P.light);rect(c,23,4,3,.5,P.edge);c.save();c.translate(15,23);c.scale(.5,.5);rune(c,0,0,P.gold,2);c.restore();moss(c,7,23);
  }else if(v===5){
   oval(c,16,26,13,2.3,'rgba(25,35,24,.26)');for(const[x,y]of[[5,25],[25,25],[16,27]]){rect(c,x,y-8,1.5,8,P.wood);rect(c,x+.5,y-7,.5,5,P.grain);}
   oval(c,16,23,8.5,2.2,'#604f39');for(const x of [10,16,22]){shape(c,[[x-3,24],[x-2,21],[x+1,20],[x+4,23],[x+2,25]],P.shade);rect(c,x-1,21,2,.5,P.light);}
   shape(c,[[5,9],[6,17],[9,21],[23,21],[26,17],[27,9]],'#303e3b');shape(c,[[7,10],[8,17],[11,20],[22,20],[24,17],[25,10]],'#506a60');rect(c,9,13,2,4,'#829381');rect(c,12,17,4,.5,'#7b8a72');rect(c,23,11,.5,5,'#263e37');
   oval(c,16,9,12.5,4.5,P.ink);oval(c,16,8.5,11.5,4,P.bronze);oval(c,16,8,10.5,3.5,P.gold);oval(c,16,8,8.8,2.7,'#304d3c');oval(c,16,8.5,7.5,1.8,'#93b873');rect(c,7,9,2,.5,P.shine);rect(c,20,10,3,.5,P.shine);
   for(const x of [3,27]){oval(c,x,12,2.5,3,P.bronze);oval(c,x,12,1.3,1.8,'#4f6354');rect(c,x,9,1,.5,P.gold);}
  }else{foot(c,20);rect(c,10,20,12,3,P.bronze);rect(c,11,20,10,.5,P.gold);rect(c,12,22,8,.5,P.shine);for(const x of [9,22]){shape(c,[[x,21],[x-1,17],[x+1,14],[x+2,18],[x+3,21]],P.bronze);rect(c,x,17,.5,3,P.gold);}c.save();c.translate(15,23);c.scale(.5,.5);rune(c,0,0,P.gold,1);c.restore();moss(c,6,25);}
 }
 function crystal(c,x,y,h,w,col,light){shape(c,[[x-w,y],[x-w*.7,y-h*.7],[x,y-h],[x+w*.65,y-h*.7],[x+w,y],[x,y+2]],'#3e5555');shape(c,[[x-w+.5,y],[x-w*.5,y-h*.72],[x,y-h+1],[x,y+1]],light);shape(c,[[x,y-h+1],[x+w*.5,y-h*.68],[x+w-.5,y],[x,y+1]],col);rect(c,x-.5,y-h+3,.5,h*.5,'#e2e9c7');}
 function animated(c,v,t,px){const wave=Math.sin(t*2+px),bright=wave>.3?'#ece9b5':wave<-.3?'#9bbba7':'#c6d4ad';
  if(v===0){glow(c,16,11,16,'183,216,167',.055+.02*wave);rune(c,14,9,bright);rect(c,13.5,8.5,.5,5,'#6d9384');if(wave>.6)rect(c,18.5,17,1,.5,'#ead8a4');}
  else if(v===1){for(let j=0;j<2;j++){const q=(t*.5+j*.5)%1;rect(c,12+q*5,14-q,3-q*2,.5,q<.5?'#a5c8b2':'#639e92');}}
  else if(v===3){for(let k=0;k<4;k++){const q=((t*.4+k*.25+px)%1+1)%1,xx=10+k*4+Math.sin(q*6+k)*1.5,yy=20-q*16;c.save();c.globalAlpha=.65*(1-q);rect(c,xx,yy,1,.5,'#e6d7a1');if(q<.3)rect(c,xx+.5,yy-.5,.5,1.5,'#cdd9ae');c.restore();}}
  else if(v===5){for(let k=0;k<3;k++){const q=Math.sin(t*9+k*2),x=11+k*5;shape(c,[[x-1,24],[x-2,22],[x+q,18+k%2],[x+1,21],[x+2,24]],'#c77e3c');shape(c,[[x,23],[x+.5,20.5],[x+1,23]],'#efc77d');}for(let k=0;k<3;k++){const q=((t*.7+k*.33)%1+1)%1;c.save();c.globalAlpha=.35*(1-q);oval(c,12+k*4+Math.sin(q*5+k),5-q*13,1+q,1+q*1.5,'#d4e0bf');c.restore();}const q=(t*.8)%1;oval(c,15+Math.sin(t)*3,8-q,1.5,.6,'#c1d6a2');}
  else if(v===6){const bob=Math.round(Math.sin(t*1.4+px)*3.2)/2;glow(c,16,10+bob,16,'170,203,206',.06+.02*wave);crystal(c,11,18+bob*.7,15,3,'#648b91','#b6c8b3');crystal(c,21,18+bob*.7,13,3,'#66816e','#afc4a5');crystal(c,16,18+bob*1.2,23,4.2,'#7c919d','#c2d4cb');rect(c,14,7+bob,1,.5,'#e8e3ba');}
 }
 function sprite(v){let cv=base.get(v);if(cv)return cv;cv=mkCanvas(W*K,H*K);const c=cv.getContext('2d');c.setTransform(K,0,0,K,OX*K,OY*K);c.imageSmoothingEnabled=false;body(c,v);base.set(v,cv);return cv;}
 const scratch=mkCanvas(W*K,H*K),g=scratch.getContext('2d');
 drawMagicObj=function(c,px,py,o){const v=((o.v||0)%7+7)%7;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,scratch.width,scratch.height);g.drawImage(sprite(v),0,0);g.setTransform(K,0,0,K,OX*K,OY*K);g.imageSmoothingEnabled=false;animated(g,v,Game.time,px);c.save();c.imageSmoothingEnabled=typeof R!=='undefined'?R.smooth:false;c.drawImage(scratch,px-OX,py-OY,W,H);c.restore();info.drawn++;};
 info.bounds=[-OX,-OY,W,H];
})();

