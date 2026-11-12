'use strict';
// Current publication yard layer. Native AI, routes, clocks, atlas and anchors stay native.
(() => {
 if(window.FantasyPublishedYard)return;
 if(typeof FantasyPublishedArt==='undefined'){window.FantasyPublishedYard={version:2,available:false,errors:['Missing FantasyPublishedArt'],ready:Promise.resolve(false)};return;}
 // Bound both retained source pixels and replacement canvases, not only entries.
 class YardCanvasCache {
  constructor(maxEntries=64,maxBytes=64*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.map=new Map();this.weights=new Map();this.bytes=0;this.hits=0;this.misses=0;this.stores=0;this.evictions=0;this.skipped=0;}
  get(key){if(!this.map.has(key)){this.misses++;return undefined}const v=this.map.get(key);this.map.delete(key);this.map.set(key,v);this.hits++;return v;}
  set(key,value){const buffers=new Set([key,value?.canvas||value,value?.shadow]),weight=[...buffers].reduce((n,cv)=>n+(cv?.width&&cv?.height?cv.width*cv.height*4:0),0);this.delete(key);this.stores++;if(weight>this.maxBytes){this.skipped++;return this}while(this.map.size&&(this.map.size>=this.maxEntries||this.bytes+weight>this.maxBytes)){this.delete(this.map.keys().next().value);this.evictions++}this.map.set(key,value);this.weights.set(key,weight);this.bytes+=weight;return this;}
  delete(key){if(!this.map.delete(key))return false;this.bytes-=this.weights.get(key)||0;this.weights.delete(key);return true;}
  clear(){this.map.clear();this.weights.clear();this.bytes=0;this.hits=0;this.misses=0;this.stores=0;this.evictions=0;this.skipped=0;}
  get stats(){return{entries:this.map.size,bytes:this.bytes,maxEntries:this.maxEntries,maxBytes:this.maxBytes,hits:this.hits,misses:this.misses,stores:this.stores,evictions:this.evictions,skipped:this.skipped};}
 }
 const A=window.FantasyPublishedYard={version:2,available:true,CanvasCache:YardCanvasCache,native:{buildingSprite,drawFolk,drawInnPorch,drawSawYard,drawSchoolYard,drawLoad,innFoodSprite,personSprite,slapPerson,slapHatDraw},cache:new YardCanvasCache(),scale:2/3,get errors(){return[...(FantasyPublishedArt.errors||[]),...(window.FantasyPublishedAppearanceArt?.errors||[]),...(typeof window.FantasyPublishedAppearanceArt?.removeHat==='function'?[]:['Missing FantasyPublishedAppearanceArt.removeHat'])]}};
 A.ready=Promise.all([FantasyPublishedArt.ready,window.FantasyPublishedAppearanceArt?.ready]).then(()=>{A.cache.clear();return A.errors.length===0});
 const P={ink:'#302d25',deep:'#4c392a',wood:'#805733',mid:'#aa7945',hi:'#d2a566',edge:'#e3c48d',iron:'#465751',steel:'#80958b',silver:'#b9c7b3',shine:'#e0e0bf'};
 const half=n=>Math.round(n*2)/2;
 function r(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(half(x),half(y),Math.max(.5,half(w)),Math.max(.5,half(h)));}
 function ln(c,x,y,X,Y,col,w=.5){let a=Math.round(x*2),b=Math.round(y*2);const e=Math.round(X*2),f=Math.round(Y*2),dx=Math.abs(e-a),dy=-Math.abs(f-b),sx=a<e?1:-1,sy=b<f?1:-1;let err=dx+dy;const size=Math.max(1,Math.round(w*2));for(;;){r(c,(a-(size>>1))/2,(b-(size>>1))/2,size/2,size/2,col);if(a===e&&b===f)break;const q=err*2;if(q>=dy){err+=dy;a+=sx}if(q<=dx){err+=dx;b+=sy}}}
 function poly(c,pts,col){for(let y=Math.floor(Math.min(...pts.map(p=>p[1]))*2)/2;y<Math.max(...pts.map(p=>p[1]));y+=.5){const hits=[],yy=y+.25;for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length];if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))hits.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]))}hits.sort((a,b)=>a-b);for(let k=0;k+1<hits.length;k+=2)r(c,hits[k],y,hits[k+1]-hits[k],.5,col)}}
 function oval(c,x,y,rx,ry,col){for(let yy=-ry;yy<=ry;yy+=.5){const q=Math.sqrt(Math.max(0,1-(yy/ry)**2))*rx;r(c,x-q,y+yy,q*2,.5,col)}}
 function bolt(c,x,y){r(c,x-.5,y-.5,1.5,1.5,P.ink);r(c,x-.5,y-.5,1,1,P.steel);r(c,x-.5,y-.5,.5,.5,P.shine)}
 function beam(c,x,y,w,h){r(c,x-.5,y-.5,w+1,h+1,P.ink);r(c,x,y,w,h,P.wood);r(c,x,y,w,.5,P.hi);r(c,x+w-1,y+.5,1,h-1,P.deep);for(let j=1;j<h-1;j+=1.5)for(let k=2;k<w-2;k+=7)ln(c,x+k,y+j,x+k+3,y+j+(k%2)*.5,j%3?P.mid:P.deep,.5)}
 function board(c,x,y,w=24){beam(c,x,y,w,2);for(const dx of [2,w-3]){beam(c,x+dx,y+2,2,8);bolt(c,x+dx+.5,y+1)}ln(c,x+3,y+7,x+w-3,y+7,P.mid,1)}
 function disc(c,x,y,radius,rotation=0,aspect=1){
   for(let yy=-radius-1.5;yy<=radius+1.5;yy+=.5)for(let xx=-radius-1.5;xx<=radius+1.5;xx+=.5){
     const dx=xx/aspect,d=Math.hypot(dx,yy),a=Math.atan2(yy,dx);
     const phase=(((a-rotation)*20/(Math.PI*2))%1+1)%1;
     const tooth=phase<.24?.2+phase/.24:phase<.62?1.2-(phase-.24)/.38:.2,limit=radius+tooth;
     if(d>limit)continue;
     const light=dx*.45+yy*.7;
     let color=light<-radius*.28?'#aabeb1':light>radius*.28?'#6d8179':'#8c9f93';
     if(d>limit-.55)color=P.ink;
     else if(d>radius-.55)color=light<0?'#dbe2c8':'#788e84';
     else if(d>radius-1.15)color='#52685f';
     else if(d>radius-1.65)color='#b5c3ac';
     else if(d<2.8)color=d>2.25?P.ink:d>1.25?light<0?'#d6ac64':'#946638':d>.55?P.silver:P.ink;
     r(c,x+xx,y+yy,.5,.5,color);
   }
   for(let i=0;i<4;i++){
     const a=rotation+i*Math.PI/2+.35,dx=Math.cos(a)*aspect,dy=Math.sin(a);
     ln(c,x+dx*3,y+dy*3,x+dx*(radius-1.7),y+dy*(radius-1.7),P.iron,.5);
     r(c,x+dx*radius*.64,y+dy*radius*.64,.5,.5,P.shine);
   }
 }
 function eraseFlat(cv,box,colors){const c=cv.getContext('2d'),k=cv.width/box.worldWidth,x=Math.max(0,Math.floor(box.x*k)),y=Math.max(0,Math.floor(box.y*k)),w=Math.min(cv.width-x,Math.ceil(box.w*k)),h=Math.min(cv.height-y,Math.ceil(box.h*k));if(w<=0||h<=0)return;const d=c.getImageData(x,y,w,h),set=new Set(colors);for(let i=0;i<d.data.length;i+=4){const p=d.data;if(set.has((p[i]<<16)|(p[i+1]<<8)|p[i+2]))p[i+3]=0}c.putImageData(d,x,y)}
 function props(c,s,type){
  if(type==='sawmill'&&s.saw){const[x,y]=s.saw,R=s.sawR;
   if(s.sawSide&&s.workers?.length>=2){
    const deck=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len*2.4,ny=dx/len*2.4;
     for(const p of[a,b]){beam(c,p[0]-1,p[1]+1,2,7);bolt(c,p[0]-.5,p[1]+1)}
     poly(c,[[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny+2],[a[0]+nx,a[1]+ny+2]],P.ink);
     poly(c,[[a[0]-nx+.5,a[1]-ny+.5],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny],[a[0]+nx,a[1]+ny]],P.mid);
     for(const side of[-.7,.7])ln(c,a[0]+nx*side,a[1]+ny*side,b[0]+nx*side,b[1]+ny*side,side<0?P.edge:P.deep,.5);
     for(let k=0;k<len;k+=6){const f=k/len,X=a[0]+dx*f,Y=a[1]+dy*f;ln(c,X-nx,Y-ny,X+nx,Y+ny,P.deep,.5);bolt(c,X+nx*.7,Y+ny*.7)}
     ln(c,a[0],a[1]+7,b[0],b[1]+7,P.deep,1);ln(c,a[0],a[1]+6.5,b[0],b[1]+6.5,P.mid,.5);
    },feed=[s.workers[0][0]-4,s.workers[0][1]-8],catcher=[s.workers[1][0]+4,s.workers[1][1]-8],joint=[x,y+6];
    deck(feed,joint);deck(joint,catcher);beam(c,x-3,y+6,6,10);bolt(c,x-1,y+11);disc(c,x,y,R,0,.45);
    for(const p of[feed,catcher]){beam(c,p[0]-5,p[1]-2,10,1.5);beam(c,p[0]-4,p[1]-3,8,1);ln(c,p[0]-3,p[1]-3,p[0]+2,p[1]-3,P.edge)}
    beam(c,x-4,y+7,8,2);bolt(c,x-3,y+8);bolt(c,x+2,y+8);return;
   }
   beam(c,x-4,y-4,8,20);for(const yy of [-1,12]){r(c,x-4, y+yy,8,1,P.iron);bolt(c,x-2,y+yy);bolt(c,x+2,y+yy)}
   poly(c,[[x-8,y+7],[x-5,y+3.5],[x+30,y+3.5],[x+29,y+7]],P.ink);
   poly(c,[[x-7,y+6.5],[x-4.5,y+4],[x+29,y+4],[x+28.5,y+6.5]],'#b9955f');
   poly(c,[[x-35,y+12],[x-32,y+8.5],[x-5,y+8.5],[x-7,y+12]],P.ink);
   poly(c,[[x-34,y+11.5],[x-31.5,y+9],[x-6,y+9],[x-7.5,y+11.5]],'#b9955f');
   for(const dx of[-30,-23,-16,-9,1,8,15,22])ln(c,x+dx,y+(dx<0?9:4),x+dx-2,y+(dx<0?11.5:6.5),'#6f5034');
   board(c,x-8,y+7,37);board(c,x-35,y+12,28);
   // Feed and receiving decks reach the native workers' hands, not their heads.
   for(let j=0;j<3;j++){beam(c,x+3,y+4+j*.8,25,1.1);ln(c,x+8,y+4+j*.8,x+21,y+4+j*.8,'#dfbe86',.5)}
   oval(c,x+27,y+5.5,1.2,1.3,'#d8b67b');oval(c,x+27,y+5.5,.7,.8,'#9e7648');
   for(let j=0;j<3;j++)beam(c,x-33,y+9+j*.8,23,1);
   disc(c,x,y,R);
   for(const dx of[-6,8]){r(c,x+dx,y+4,1.5,3,P.iron);r(c,x+dx,y+4,1.5,.5,P.silver);bolt(c,x+dx,y+5.5)}
   beam(c,x-9,y+7,18,3);bolt(c,x-7,y+8);bolt(c,x+6,y+8);
   beam(c,x-3,y+10,6,7);r(c,x-2.5,y+12,5,1,P.iron);bolt(c,x-1,y+12);
   ln(c,x-32,y+20,x-10,y+15,P.deep,1.5);ln(c,x-32,y+19.5,x-10,y+14.5,P.mid,.5);
   ln(c,x+9,y+16,x+26,y+10,P.deep,1.5);ln(c,x+9,y+15.5,x+26,y+9.5,P.hi,.5);
   oval(c,x-1,y+13,2.6,2.6,P.ink);oval(c,x-1,y+13,2,2,P.iron);oval(c,x-1,y+13,1.3,1.3,P.mid);bolt(c,x-1.5,y+12.5);
   for(const dx of [-25,-18,-11,10,17,24]){bolt(c,x+dx,y+(dx<0?13:8));r(c,x+dx+1,y+(dx<0?12:7),2,.5,P.edge)}
  }
  if(type==='quarry'&&s.block){const[x,y]=s.block;
   poly(c,[[x-10,y-1],[x-8,y-8],[x-3,y-10],[x+7,y-8],[x+10,y-3],[x+8,y+1],[x-7,y+1]],P.ink);
   poly(c,[[x-8,y-7],[x-3,y-9],[x+6,y-7],[x+4,y-4],[x-5,y-4]],'#b8bf9e');
   poly(c,[[x-8,y-7],[x-5,y-4],[x+4,y-4],[x+6,y],[x-7,y]],'#8f9d85');
   poly(c,[[x+6,y-7],[x+9,y-3],[x+7,y],[x+4,y-4]],'#61776b');
   ln(c,x-6,y-7,x-1,y-8,'#d8d8b4');ln(c,x-2,y-6,x-1,y-4,'#647565');ln(c,x-1,y-4,x-3,y-2,'#536659');
   for(const [dx,dy]of[[-7,-2],[5,-1],[9,2],[-10,2]])r(c,x+dx,y+dy,1.5,.5,'#b2bda1');
   for(const[dx,dy]of[[-6,-6],[-3,-7],[2,-6],[-4,-3],[0,-2],[3,-3],[7,-4]]){r(c,x+dx,y+dy,1.5,.5,'#c0c5a6');r(c,x+dx+.5,y+dy+.5,.5,.5,'#667b6a')}
   ln(c,x+1,y-7,x+2,y-5,'#7b8b73');ln(c,x+2,y-5,x+1,y-4,'#647866');
  }
  if(type==='school'&&s.play){const p=s.play;
   for(const q of p.swing||[]){const[x,y]=q;for(const dx of[-10,10]){beam(c,x+dx,y-30,2,32);bolt(c,x+dx+.5,y-29)}beam(c,x-12,y-32,26,3);for(const dx of[-4,5]){ln(c,x+dx,y-28,x+dx,y-6,'#5d5b43',1);ln(c,x+dx+.5,y-28,x+dx+.5,y-6,'#b9ac76')}beam(c,x-6,y-5,13,2)}
   if(p.read)board(c,p.read[0]-9,p.read[1]-5,18);
   if(p.sand){const[x,y]=p.sand;for(const dy of[-4,4])beam(c,x-10,y+dy,21,2);for(const dx of[-10,10])beam(c,x+dx,y-3,2,9);for(const dx of[-7,0,6])r(c,x+dx,y,1,.5,'#eed7a3')}
   if(p.garden){const[x,y]=p.garden;beam(c,x-10,y+4,22,2);for(const dx of[-8,-2,4,8]){ln(c,x+dx,y+2,x+dx,y-3,'#607648');r(c,x+dx-.5,y-2,2,.5,'#acb977')}}
   if(p.seesaw)for(const[x,y]of p.seesaw){beam(c,x-7,y-4,14,2);bolt(c,x,y-3)}
   if(p.slide){const[x,y]=p.slide;beam(c,x-2,y-17,3,20);for(let j=0;j<12;j++)ln(c,x+j,y-12+j,x+j+4,y-12+j,j%3?'#b6bfad':'#e0dec0',1)}
  }
  if(type==='inn'){
   for(const [x,y]of s.seats||[])board(c,x-5,y-5,10);
   if(s.chop){const[x,y]=s.chop;beam(c,x-5,y-4,10,5);oval(c,x,y-4,5,1.8,'#d4af75');ln(c,x-2,y-4,x+2,y-4,'#94683e');beam(c,x-4,y-6,8,2)}
   if(s.darts){const[x,y]=s.darts;beam(c,x-5,y-15,2,16);oval(c,x,y-13,6,6,'#60472f');oval(c,x,y-13,4.8,4.8,'#be9c66');oval(c,x,y-13,3.2,3.2,'#7d6250');oval(c,x,y-13,1.5,1.5,'#b65b3d');bolt(c,x-.5,y-13.5)}
   if(s.stage)board(c,s.stage[0]-9,s.stage[1]-2,18);
   if(s.oven){const[x,y]=s.oven;for(let j=0;j<4;j++)for(let i=0;i<3;i++){const xx=x-8+i*5+(j%2),yy=y-15+j*4;ln(c,xx,yy,xx+3,yy,'#d8b67d');ln(c,xx,yy,xx,yy+2,'#6c4d35')}r(c,x-6,y-6,12,8,'#332b23');r(c,x-5,y-5,10,6,'#5f3b26');for(const dx of[-4,0,4])r(c,x+dx,y-1,2,.5,'#ca8040');beam(c,x-9,y+3,18,2)}
   if(s.spit){const[x,y]=s.spit;for(const dx of[-12,11])beam(c,x+dx,y-7,2,13);ln(c,x-13,y-4,x+14,y-4,P.silver,1);bolt(c,x+12,y-5);oval(c,x,y-2,5,2.8,'#8b5733');oval(c,x-1,y-3,3.5,1.3,'#c39450')}
  }
 }
 A.paint={r,ln,poly,oval,beam,board,bolt,disc,P};A.nativeBuilding=buildingSprite;
 buildingSprite=function(type,...args){const s=A.nativeBuilding(type,...args);if(!['inn','school','quarry','sawmill'].includes(type)||!s._publishedArt)return s;const prior=A.cache.get(s.canvas);if(prior)return prior;const cv=mkCanvas(s.canvas.width,s.canvas.height),c=cv.getContext('2d');c.drawImage(s.canvas,0,0);const k=cv.width/s.w,copy={...s,canvas:cv,_publishedYard:true};
  if(type==='sawmill'&&s.saw){const[x,y]=s.saw;eraseFlat(cv,{x:x-21,y:y-17,w:44,h:37,worldWidth:s.w},[0xb5b8a6,0x535a4d,0x543821,0xc79854,0x6b482b,0xa97943]);c.save();c.setTransform(k,0,0,k,0,0);c.beginPath();c.arc(x,y,(s.sawR||12)+.6,0,Math.PI*2);c.clip();c.clearRect(x-(s.sawR||12)-2,y-(s.sawR||12)-2,2*(s.sawR||12)+4,2*(s.sawR||12)+4);c.restore();copy.sawR=Math.min(8,s.sawR||12)}
  if(type==='quarry'&&s.block){const[x,y]=s.block;eraseFlat(cv,{x:x-11,y:y-15,w:23,h:18,worldWidth:s.w},[0x414437,0xa5a58c,0xd2d0ac,0x797f6c])}
  c.save();c.setTransform(k,0,0,k,0,0);props(c,copy,type);c.restore();A.cache.set(s.canvas,copy);return copy};
 // W is a mirrored E row, never a front-facing fallback. Existing flip composes XOR.
 drawFolk=function(c,u,x,y,view,pose,frame,opt,flip){return view==='W'&&OUTFIT[u.type]?A.native.drawFolk(c,u,x,y,'E',pose,frame,opt,!flip):A.native.drawFolk(c,u,x,y,view,pose,frame,opt,flip)};
 const sawFeedTime=8/6,sawTakeTime=8/5;
 function sawmillCycle(s,time){
   const [feed,receiver]=s.workers;
   const joint=[s.saw[0],s.saw[1]+(s.sawSide?6:5)];
   const seat=foot=>[foot[0]+(joint[0]<foot[0]?-4:4),foot[1]-8];
   const start=seat(feed),end=seat(receiver),duration=sawFeedTime+sawTakeTime;
   const phase=((time%duration)+duration)%duration,raw=phase<sawFeedTime;
   const a=raw?start:joint,b=raw?joint:end,p=raw?phase/sawFeedTime:(phase-sawFeedTime)/sawTakeTime;
   const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
   const center=[a[0]+dx*p,a[1]+dy*p],axis=[dx/length,dy/length];
   const grip=raw&&p<.2?0:!raw&&p>.8?1:-1;
   const target=grip<0?null:[center[0]+axis[0]*(raw?-2:2),center[1]+axis[1]*(raw?-2:2)];
   return {center,axis,raw,grip,target,cut:Math.hypot(center[0]-joint[0],center[1]-joint[1])<4.5};
 }
 A.sawmillCycle=sawmillCycle;
 function sawWood(c,{center:[x,y],axis:[dx,dy],raw}){
   const point=(along,across)=>[x+dx*along-dy*across,y+dy*along+dx*across];
   function piece(lo,hi,halfWidth,edge,body,light){
     poly(c,[point(-4.5,lo-.5),point(4.5,lo-.5),point(4.5,hi+.5),point(-4.5,hi+.5)],edge);
     poly(c,[point(-4.5,lo),point(4.5,lo),point(4.5,hi),point(-4.5,hi)],body);
     ln(c,...point(-4,lo),...point(4,lo),light,.5);
     ln(c,...point(-3,halfWidth),...point(1.5,halfWidth+.3),raw?'#69482f':'#af8252',.5);
   }
   if(raw){
     piece(-1.8,1.8,.5,P.deep,'#a87645','#cda471');
     const [ex,ey]=point(4.5,0);
     oval(c,ex,ey,1.6,1.7,P.deep);
     oval(c,ex,ey,1.2,1.25,'#ddb880');
     oval(c,ex,ey,.65,.75,'#ab7949');
   }else{
     piece(-2.1,-.5,-1.4,P.deep,'#c4955b','#eed19c');
     piece(.5,2.1,1.3,P.deep,'#b6854f','#e8ba81');
   }
 }
 function sawWorker(c,b,s,ox,oy,i,cycle){
   const foot=s.workers[i],face=s.saw[0]<foot[0]?-1:1;
   const actor={type:'woodcutter',look:b.id*53+i+1},view=face<0?'W':'E';
   const handTarget=cycle?.grip===i?cycle.target:null;
   const shoulder=[foot[0]+face,foot[1]-7.2];
   const reaching=handTarget&&Math.hypot(handTarget[0]-shoulder[0],handTarget[1]-shoulder[1])<6;
   // Keep both states visible when a cold scene switches to or from a grip.
   // Populate the body before drawFolk marks it as decorative.
   const pose=reaching?'sawGrip':'sawRest';
   personSprite(actor,'E',pose,0,{});
   drawFolk(c,actor,ox+foot[0],oy+foot[1],view,pose,0,{});
   if(!reaching)return;
   const skin=SKINS[lookOf(actor).skin%SKINS.length],coat=OUTFIT.woodcutter.coat;
   const hx=ox+handTarget[0],hy=oy+handTarget[1],sx=ox+shoulder[0],sy=oy+shoulder[1];
   // In profile the far arm stays behind the material.
   const ex=(sx+hx)/2,ey=(sy+hy)/2+.55;
   ln(c,sx,sy,ex,ey,P.ink,1.5);
   ln(c,ex,ey,hx,hy,P.ink,1.5);
   ln(c,sx,sy,ex,ey,coat,.85);
   ln(c,ex,ey,hx,hy,coat,.85);
   r(c,hx-.5,hy-.5,1.5,1.25,skin[2]);
   r(c,hx-.5,hy-.5,1,.5,skin[0]);
 }
 drawSawYard=function(c,b,s,ox,oy){
   if(!s._publishedYard||!s.saw||b.state!=='done'||(s.workers?.length||0)<2)return A.native.drawSawYard(c,b,s,ox,oy);
   const [x,y]=s.saw,rad=s.sawR,X=ox+x,Y=oy+y,t=Game.time;
   const cycle=b.working?sawmillCycle(s,t):null;
   c.save();
   c.imageSmoothingEnabled=false;
   if(cycle){
     c.save();
     c.translate(ox,oy);
     sawWood(c,cycle);
     c.restore();
   }
   c.save();
   c.beginPath();
   c.rect(X-rad-2,Y-rad-2,2*rad+4,rad+9);
   c.clip();
   disc(c,X,Y,rad,cycle?t*14:0,s.sawSide?.45:1);
   c.restore();
   for(const dx of(s.sawSide?[]:[-6,8])){
     r(c,X+dx,Y+4,1.5,3,P.iron);
     r(c,X+dx,Y+4,1.5,.5,P.silver);
     bolt(c,X+dx,Y+5.5);
   }
   if(cycle?.cut)for(let k=0;k<8;k++){
     const f=(t*3+k/8)%1;
     r(c,X-cycle.axis[0]*f*10+Math.sin(k*3.1)*3,Y+2-Math.sin(f*Math.PI)*6+f*6,1,1,['#e8c868','#c8a448','#f2e0a0'][k%3]);
   }
   for(let i=0;i<2;i++)sawWorker(c,b,s,ox,oy,i,cycle);
   c.restore();
 };
 // A plate is painted underneath the dish, retaining contrast at actual zoom.
 function food(c,kind,x,y,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);oval(c,.4,.6,3.9,1.1,'#3e4032');oval(c,0,0,3.8,1.1,'#b9c0a3');oval(c,0,-.2,3.1,.7,'#e3dbc0');
  if(kind==='beer'||kind==='darkbeer'){r(c,-1.5,-4,3,3.5,kind==='darkbeer'?'#775135':'#bb8a3e');r(c,-1,-3.5,.5,2.5,'#e6bd70');r(c,-1.5,-4.5,3,.7,'#ece1ba');ln(c,1.5,-3.5,2.5,-3.5,P.iron);ln(c,2.5,-3.5,2.5,-1.5,P.iron);ln(c,1.5,-1.5,2.5,-1.5,P.iron)}
  else if(kind==='steak'){oval(c,0,-.8,2.8,1.3,'#79422c');oval(c,-.2,-1,2.2,.8,'#b5734b');for(const dx of[-1.5,0,1.5])ln(c,dx,-1.5,dx+.7,-.5,'#7d4d33')}
  else if(kind==='chickenleg'||kind==='chicken'){oval(c,-1,-1.2,2.1,1.5,'#8e5d36');oval(c,-1.4,-1.7,1.4,.7,'#cd9954');ln(c,.5,-.7,2.6,.2,'#dfd4ae',1);r(c,2.4,-.3,1,1,'#f0e5c0')}
  else if(kind==='fish'){poly(c,[[-3,-1],[-1,-2],[2,-1.5],[2.5,-.5],[0,0],[-2,-.2]],'#a0b29d');poly(c,[[2,-1],[3.6,-2],[3.6,0]],'#6a8582');ln(c,-2,-1.5,1,-1.5,'#d3d6b7');r(c,-2,-1.2,.5,.5,P.ink)}
  else if(kind==='sausage'){ln(c,-2.5,-1,1.8,-.8,'#75402d',2);ln(c,-2.2,-1.5,1.5,-1.2,'#bd7c53',1);for(const dx of[-1,1])r(c,dx,-1.5,.5,.5,'#dfad7a')}
  else if(kind==='croissant'){poly(c,[[-3,-.3],[-2.5,-1.5],[-1,-2],[1,-2],[2.5,-1.5],[3,-.3],[1.5,-.6],[.5,-1.2],[-.5,-1.2],[-1.5,-.6]],'#b47b3d');for(const dx of[-2,-.5,1])ln(c,dx,-1.8,dx+.5,-.5,'#e1bc77')}
  else{oval(c,0,-1.1,2.8,1.4,'#b88c50');oval(c,-.5,-1.5,2.1,.8,'#e0c183');for(const dx of[-1.5,0,1.5])ln(c,dx,-1.8,dx+.3,-.9,'#966a3f')}
  c.restore()}
 innFoodSprite=function(c,kind,x,y){const near=porchIdentity&&Math.abs(y-(porchIdentity.ty-5.2))<.02;return food(c,kind,x,y+(near?A.porchGap:0))};
 drawLoad=function(c,kind){if(typeof kind!=='string'||!kind.startsWith('tray:'))return A.native.drawLoad(c,kind);oval(c,.3,2.7,7.3,1.1,P.deep);oval(c,0,2,7.3,1.1,'#a9804c');ln(c,-6.5,1.8,6.5,1.8,'#d8b77e');r(c,-5.5,-1.6,2.5,3.5,'#ad7837');r(c,-5,-1.1,.5,2.5,'#dfb55d');r(c,-5.5,-2,2.5,.7,'#ece0b6');food(c,kind.slice(5),2.2,1.1,.75)};
 const proxyCache=new WeakMap(),hats=new WeakSet();
 function peopleContext(c){if(proxyCache.has(c))return proxyCache.get(c);const q=new Proxy(c,{get(t,p){if(p==='rect')return(x,y,w,h)=>t.rect(x,y+(porchIdentity&&w===28&&h===46&&Math.abs(y-(porchIdentity.ty-41))<.02?A.porchGap:0),w,h);if(p==='drawImage')return(img,...a)=>{if(a.length===4&&Math.abs(a[2]-PW)<.001&&Math.abs(a[3]-PH)<.001&&!hats.has(img)){const[x,y,w,h]=a,s=A.scale,fx=x+PFX,fy=y+PFY+(porchIdentity?.frontImages.has(img)?A.porchGap:0);return t.drawImage(img,fx-PFX*s,fy-PFY*s,w*s,h*s)}return t.drawImage(img,...a)};const v=Reflect.get(t,p,t);return typeof v==='function'?v.bind(t):v},set(t,p,v){return Reflect.set(t,p,v,t)}});proxyCache.set(c,q);return q}
 // Native seat() intentionally drops carried loads, but must retain the actual
 // seated guest's sex and hero appearance. Bind by native seat order, not look.
 const nativeFolkSprite=folkSprite;A.native.folkSprite=nativeFolkSprite;let porchIdentity=null;
 folkSprite=function(u,view,pose,frame,opt){if(porchIdentity&&pose==='idle'&&frame===0&&opt?.gest==='eat'){const i=porchIdentity.cursor++,guest=porchIdentity.guests[i];if(guest){const sp=nativeFolkSprite({...guest,carry:null,_spr:null},view,pose,frame,opt);if(i%2&&sp)porchIdentity.frontImages.add(sp);return sp}}return nativeFolkSprite(u,view,pose,frame,opt)};
 A.porchGap=8;A.native.innTable=innTable;A.native.innBench=innBench;A.native.innAwning=innAwning;
 function porchDeck(c,x,y,hw){const bottom=y+8+A.porchGap;r(c,x-hw+1,bottom+1,hw*2,2,'#342c21');beam(c,x-hw,y-9,hw*2,bottom-y+9);for(let yy=y-8;yy<bottom;yy+=2.5){ln(c,x-hw+.5,yy,x+hw-1,yy,P.deep);for(let xx=x-hw+3;xx<x+hw-3;xx+=9){ln(c,xx,yy+1,xx+4,yy+1,P.mid);r(c,xx-.5,yy+.5,.5,.5,P.iron)}}beam(c,x-hw,bottom,hw*2,1.5)}
 innTable=function(c,x,y,w){if(!porchIdentity)return A.native.innTable(c,x,y,w);const g=A.porchGap;oval(c,x+2,y+1+g,w/2+2,3.5,'rgba(12,10,6,.3)');for(const dx of w>40?[-w/2+3,0,w/2-4]:[-w/2+3,w/2-4])beam(c,x+dx,y-5+g,2,5);r(c,x-w/2,y-9,w,5+g,'#a9743f');for(let row=0;row<Math.ceil((5+g)/1.8);row++)for(let k=0;k<w;k+=4)r(c,x-w/2+k,y-9+row*1.8,Math.min(4,w-k),Math.min(1.8,5+g-row*1.8),((k>>2)+row)%2?'#eee2c6':'#b84c37');beam(c,x-w/2,y-4+g,w,1.4);ln(c,x-w/2,y-9,x+w/2,y-9,'#8d5237')};
 innBench=function(c,x,y,w){return A.native.innBench(c,x,y+(porchIdentity&&Math.abs(y-(porchIdentity.ty+7))<.02?A.porchGap:0),w)};
 innAwning=function(c,x,y,k,sc){if(!porchIdentity)return A.native.innAwning(c,x,y,k,sc);const top=y-30,bw=16*sc,fw=19*sc,depth=11+A.porchGap;c.save();c.globalAlpha=Math.min(1,k*2);c.fillStyle='#5a3a1e';for(const[dx,h0,ph]of[[-bw+3,top+2,y-10],[bw-3,top+2,y-10],[-fw+3,top+depth,y+4+A.porchGap],[fw-3,top+depth,y+4+A.porchGap]])r(c,x+dx-.7,h0,1.6,ph-h0,'#5a3a1e');c.globalAlpha=1;const front=top+depth*k,fwk=bw+(fw-bw)*k;for(let i=0;i<10;i++){const a=i/10,b=(i+1)/10;c.fillStyle=i%2?'#f0e6cc':'#b8402c';poly(c,[[x-bw+a*2*bw,top],[x-bw+b*2*bw,top],[x-fwk+b*2*fwk,front],[x-fwk+a*2*fwk,front]],c.fillStyle);if(k>.85){const X=x-fwk+a*2*fwk,Z=x-fwk+b*2*fwk;poly(c,[[X,front],[Z,front],[(X+Z)/2,front+4]],c.fillStyle)}}r(c,x-fwk,front-.8,fwk*2,.8,'rgba(0,0,0,.18)');r(c,x-bw,top,bw*2,.8,'rgba(255,255,255,.25)');c.restore()};
 drawInnPorch=function(c,b,s,ox,oy){if(!s.porch)return A.native.drawInnPorch(c,b,s,ox,oy);const previous=porchIdentity,tx=Math.round(ox+s.porch[0]),ty=Math.round(oy+s.porch[1]);porchIdentity={guests:(INS_DINE.get(b)||[]).slice(0,innSeatsN(b)),cursor:0,tx,ty,frontImages:new WeakSet()};try{porchDeck(c,tx,ty,innHalf(b));return A.native.drawInnPorch(peopleContext(c),b,s,ox,oy)}finally{porchIdentity=previous}};
 slapPerson=function(c,sp,x,y,...args){c.save();c.translate(x,y);c.scale(A.scale,A.scale);A.native.slapPerson(c,sp,0,0,...args);c.restore()};
 // Correct only the accessory state requested by the existing nohat contract.
 const bareCache=new YardCanvasCache(128,8*1024*1024);
 personSprite=function(u,view,pose,frame,opt={}){if(opt.nohat&&typeof window.FantasyPublishedAppearanceArt?.removeHat==='function')return FantasyPublishedAppearanceArt.removeHat(u,view,pose,frame,opt);const full=A.native.personSprite(u,view,pose,frame,opt);if(!opt.nohat||!OUTFIT[u.type]||u.type==='kid'||!full)return full;if(bareCache.has(full))return bareCache.get(full);const holder=window.FantasyPublishedAppearance?FantasyPublishedAppearance.resolve(u).holder||u:u;const female=personSex(holder)==='f'||!!OUTFIT[holder.type]?.fem||holder.type==='waitress',art=FantasyPublishedArt.images[female?'gnome-woman-walk':'gnome-walk'];if(!art)return full;
  const f=pose==='walk'?Math.floor((frame%WALK_FRAMES)*8/WALK_FRAMES):0,row=view==='E'?1:view==='N'?2:0,src=art.frames[row*8+f];if(!src)return full;const k=full.width/PW,sc=Math.min(25/art.maxW,33/art.maxH),dw=Math.round(src[2]*sc),dh=Math.round(src[3]*sc),x=PFX+Math.round(-src[2]*sc/2),y=PFY+Math.round(-src[3]*sc),dip=pose==='duck'||pose==='tame'?2:pose==='idle'?-(IDLE_BREATH[(Number(frame)||0)%IDLE_FRAMES]||0):pose==='work'?Math.sin((frame.f||0)*Math.PI/4):0;
  const raw=mkCanvas(full.width,full.height),g=raw.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(art.image,...src,x*k,(y+dip)*k,dw*k,dh*k);const rd=g.getImageData(0,0,raw.width,raw.height),mask=new Uint8Array(raw.width*raw.height),top=Math.max(0,Math.floor((y+dip)*k)),bottom=Math.min(raw.height,Math.ceil((y+dip+dh*.40)*k));
  if(!female){for(let yy=top;yy<bottom;yy++)for(let xx=0;xx<raw.width;xx++){const i=(yy*raw.width+xx)*4,p=rd.data;if(p[i+3]>128&&p[i+1]>p[i]*.83&&p[i+1]>p[i+2]*1.35&&p[i+1]>48)mask[yy*raw.width+xx]=1}}
  else{for(let yy=top;yy<Math.min(bottom,top+dh*.29*k);yy++)for(let xx=0;xx<raw.width;xx++){const i=(yy*raw.width+xx)*4,p=rd.data;if(p[i+3]>128&&p[i]>150&&p[i+1]>145&&p[i+2]>95&&Math.abs(p[i]-p[i+1])<55)mask[yy*raw.width+xx]=1}}
  for(let yy=top;yy<top+dh*.18*k;yy++)for(let xx=0;xx<raw.width;xx++)if(rd.data[(yy*raw.width+xx)*4+3]>128)mask[yy*raw.width+xx]=1;const expanded=mask.slice();for(let yy=top;yy<bottom;yy++)for(let xx=0;xx<raw.width;xx++)if(mask[yy*raw.width+xx])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(Math.abs(dx)+Math.abs(dy)>2)continue;const X=xx+dx,Y=yy+dy;if(X<0||X>=raw.width||Y<top||Y>=bottom)continue;const i=(Y*raw.width+X)*4,p=rd.data;if(p[i+3]>128&&Math.max(p[i],p[i+1],p[i+2])<110)expanded[Y*raw.width+X]=1}
  const cv=mkCanvas(full.width,full.height),c=cv.getContext('2d');c.drawImage(full,0,0);const d=c.getImageData(0,0,cv.width,cv.height);for(let i=0;i<expanded.length;i++)if(expanded[i])d.data[i*4+3]=0;const seen=new Uint8Array(expanded.length),queue=[];for(let yy=bottom;yy<cv.height;yy++)for(let xx=0;xx<cv.width;xx++){const i=yy*cv.width+xx;if(d.data[i*4+3]){seen[i]=1;queue.push(i)}}for(let q=0;q<queue.length;q++){const i=queue[q],xx=i%cv.width,yy=Math.floor(i/cv.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=xx+dx,Y=yy+dy,j=Y*cv.width+X;if(X>=0&&X<cv.width&&Y>=top&&Y<cv.height&&!seen[j]&&d.data[j*4+3]){seen[j]=1;queue.push(j)}}}for(let yy=top;yy<bottom;yy++)for(let xx=0;xx<cv.width;xx++){const i=yy*cv.width+xx;if(!seen[i])d.data[i*4+3]=0}c.putImageData(d,0,0);c.save();c.scale(k,k);c.globalCompositeOperation='destination-over';const L=lookOf(holder),skin=SKINS[L.skin%SKINS.length],cx=PFX+(view==='E'?1.4:0),cy=y+dip+dh*.29;ln(c,cx-2.5,cy-2.2,cx+1,cy-2.5,'#9d784d');oval(c,cx-.6,cy-.7,view==='E'?2.6:3.6,2.5,skin[0]);oval(c,cx,cy,view==='E'?3.4:4.5,3.6,skin[1]);c.restore();bareCache.set(full,cv);u._spr=cv;return cv};
 // Hat flight/landing clocks remain native. Match the scaled accessory to the head.
 let slapContext=null;const nativeScene=drawSlapScene;
 drawSlapScene=function(c,b,s,tx,ty,ox,oy){const prev=slapContext;slapContext={el:Game.time-b._slap.t0};try{return nativeScene(peopleContext(c),b,s,tx,ty,ox,oy)}finally{slapContext=prev}};
 slapHatDraw=function(c,hat,x,y,ang,flip){hats.add(hat.cv);let dx=0,dy=0;if(slapContext){const el=slapContext.el,e=el-3.583;if(e>=0&&e<hat.tl){const f=1-e/hat.tl;dx=(A.scale-1)*hat.cx*f;dy=(A.scale-1)*hat.cy*f}else if(el>=7&&el<7.5){const q=Math.max(0,Math.min(1,(el-7)/.5)),p=q*q*(3-2*q),dir=flip?-1:1;dx=(A.scale-1)*dir*(hat.cx*p+3.5*(1-p));dy=(A.scale-1)*(hat.cy*p-17*(1-p))}}c.save();c.translate(x+dx,y+dy);c.scale(A.scale,A.scale);A.native.slapHatDraw(c,hat,0,0,ang,flip);c.restore()};
 drawSchoolYard=function(c,b,s,ox,oy){A.native.drawSchoolYard(c,b,s,ox,oy);if(s.play?.read&&b.state==='done'&&!isNightNow()){const[x,y]=s.play.read;const X=ox+x,Y=oy+y-7;poly(c,[[X-3,Y-1],[X,Y-2],[X+3,Y-1],[X+3,Y+1],[X,Y],[X-3,Y+1]],'#d3c59d');ln(c,X,Y-1,X,Y,'#8d7751');for(const dx of[-2,1])ln(c,X+dx,Y-1,X+dx+1,Y-1,'#9e997b')}};
 if(typeof SLAP_HATS!=='undefined')for(const key of Object.keys(SLAP_HATS))delete SLAP_HATS[key];
 if(FantasyPublishedArt.people)FantasyPublishedArt.people.clear();if(typeof FOLK_LAST!=='undefined')FOLK_LAST.clear();
})();















