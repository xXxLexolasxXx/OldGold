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
 const yards = new Set(['school','inn']);
 const oldProps = fpaPaintProps;
 fpaPaintProps=function(c,s,k,type){
  if(!yards.has(type))oldProps(c,s,k,type);
 };
 function threshold(s,type){
  const [x,y,w,h]=s._artBox, mirror=[1,2].includes(s._artRotation);
  const u=type==='school'?.40:.41, v=type==='school'?.985:.97;
  return [half(x+w*(mirror?1-u:u)),half(y+h*v)];
 }
 function arrange(s,type){
  if(!yards.has(type))return s;
  const d=bDims(type,s._artRotation), lv=s.pxLv||1, [dx,dy]=threshold(s,type), y=s.baseY;
  const side=d.rot===1||d.rot===2, flip=d.rot===2, l=s.padx, w=s.fw;
  const position=(x,y)=>[l+(flip?w-x:x),y];
  if(type==='school'){
   const play=side ? {
    hop:position(15,y-8), swing:[position(48,y-6),position(61,y-6)], read:position(81,y-4),
    sand:position(80,y+11),garden:position(15,y+9),
    seesaw:[position(34,y+10),position(54,y+10)], slide:position(4,y-8)
   }:{
    hop:[dx-21,y-6], swing:[[l+w-15,y-5],[l+w-2,y-5]], read:[dx-37,y-25],
    sand:[l+w-14,y+10], garden:[l+w-12,y-23],
    seesaw:[[dx-29,y+9],[dx-13,y+9]], slide:[l+w-34,y-9]
   };
   if(lv<3){play.swing=play.swing.slice(0,1);delete play.seesaw;delete play.slide;}
   if(lv<2){delete play.sand;delete play.garden;}
   return {...s,play,doorPt:[dx,dy]};
  }
  const porch=side?[dx+(flip?-6:6),dy+27]:[s._artBox[0]+s._artBox[2]+17,dy+27];
  const fire=side?position(w-8, y+5):[l+14,y+7];
  const oven=side?position(w+22,dy-22):[l+w+17,dy+8];
  const [fx,fy]=fire, [vx,vy]=oven, sign=flip?-1:1;
  const seats=[[fx-10,fy+2],[fx+10,fy+2],[fx-11,fy-7],[fx+11,fy-7],[fx-3,fy+8],[fx+4,fy+8]];
  const pantry=[[vx+sign*13,vy+1],[vx+sign*18,vy+1],[vx+sign*13,vy-5],[vx+sign*18,vy-5]];
  const stock=[[vx-sign*9,vy-15],[vx-sign*2,vy-15],[vx+sign*5,vy-15]];
  const chimneys=s.chimneys?.map((q,i)=>i===1?[vx,vy-13]:q);
  return {...s,doorPt:[dx,dy],porch,fire,oven,chimneys,seats,pantry,stock,spit:[fx,fy-3],
   tables:lv>=2&&!side?[[vx+sign*8,vy+24]]:[],
   chop:side?position(5,y+4):[l+16,dy+15],
   darts:lv>=2?(side?position(w+16,y-21):[vx+13,dy-3]):null,
   stage:lv>=3?(side?position(12,y-20):[l+2,y-23]):null};
 }
 A.obstacles=function(s,type){
  if(!s._publishedYard||!yards.has(type))return [];
  const boxes=[];
  const add=(q,w,back,front)=>{if(q)boxes.push([q[0]-w,q[1]-back,q[0]+w,q[1]+front]);};
  if(type==='school'){
   const p=s.play;
   add(p.read,10,5,4);add(p.hop,7,10,6);add(p.sand,11,5,5);add(p.garden,10,4,5);
   if(p.swing?.length){
    const [[first,y],last]=p.swing,x=last?.[0]??first;
    boxes.push([Math.min(first,x)-9,y-4,Math.max(first,x)+9,y+8]);
   }
   if(p.seesaw){const [a,b]=p.seesaw;boxes.push([Math.min(a[0],b[0])-5,a[1]-5,Math.max(a[0],b[0])+5,a[1]+4]);}
   if(p.slide)boxes.push([p.slide[0]-5,p.slide[1]-6,p.slide[0]+16,p.slide[1]+6]);
  }else{
   const half=innHalf({level:s.pxLv});
   add(s.porch,half,8,11+A.porchGap);add(s.fire,17,7,9);add(s.oven,11,8,6);
   add(s.chop,5,5,3);add(s.darts,6,6,3);add(s.stage,10,4,5);
   for(const table of s.tables||[])add(table,13,5,5);
   for(const stock of s.stock||[])add(stock,4,4,2);
  }
  return boxes;
 };
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
     else if(d>radius-1.35)color='#52685f';
     else if(d>radius-2.1)color='#b5c3ac';
     else if(d<3.25){
       color=d>2.75?P.ink:d>2.15?light<0?'#ecd08b':'#a77944':
         d>1.4?light<0?'#b98a4b':'#755035':d>.65?P.silver:P.ink;
     }
     r(c,x+xx,y+yy,.5,.5,color);
   }
   for(let i=0;i<4;i++){
     const a=rotation+i*Math.PI/2+.35,dx=Math.cos(a)*aspect,dy=Math.sin(a);
     ln(c,x+dx*3.35,y+dy*3.35,x+dx*(radius-2.15),y+dy*(radius-2.15),P.iron,.5);
     r(c,x+dx*radius*.64,y+dy*radius*.64,.5,.5,P.shine);
   }
 }
 function eraseFlat(cv,box,colors){const c=cv.getContext('2d'),k=cv.width/box.worldWidth,x=Math.max(0,Math.floor(box.x*k)),y=Math.max(0,Math.floor(box.y*k)),w=Math.min(cv.width-x,Math.ceil(box.w*k)),h=Math.min(cv.height-y,Math.ceil(box.h*k));if(w<=0||h<=0)return;const d=c.getImageData(x,y,w,h),set=new Set(colors);for(let i=0;i<d.data.length;i+=4){const p=d.data;if(set.has((p[i]<<16)|(p[i+1]<<8)|p[i+2]))p[i+3]=0}c.putImageData(d,x,y)}
 function peg(c,x,y,low,width=2){
  oval(c,x+.5,y+.5,width+1,1.3,'rgba(27,30,17,.4)');
  poly(c,[[x-width,y+1],[x-width+.5,y-low+1],[x-width+1,y-low],[x+width-.5,y-low],
   [x+width,y-low+1],[x+width,y+1]],P.ink);
  r(c,x-width+.5,y-low+1,width*2-1,low-1,P.wood);
  r(c,x-width+.5,y-low+1,.5,low-2,P.hi);
  ln(c,x-width+1,y-low+4,x-width+1.5,y-2,P.mid);
  r(c,x+width-1,y-low+2,1,low-2,P.deep);
  r(c,x-width,y-3,width*2,.7,P.iron);r(c,x-width+.5,y-3,width,.5,P.steel);
 }
 function paddedBench(c,x,y,w){
  oval(c,x+1,y+1,w/2+1,1.8,'rgba(27,30,17,.33)');
  for(const off of[-w/2+2,w/2-2])peg(c,x+off,y,4,1.4);
  beam(c,x-w/2,y-6,w,2.4);
  r(c,x-w/2+1,y-6.5,w-2,1.5,'#527664');
  ln(c,x-w/2+2,y-6.5,x+w/2-2,y-6.5,'#94a87a');
  for(let off=-w/2+3;off<w/2-2;off+=4){r(c,x+off,y-5.5,.5,.5,'#d7b674');}
 }
 function stone(c,x,y,tone=0){
  const top=['#b5ad8d','#978d72','#a09e83'][tone];
  poly(c,[[x-3,y],[x-2.5,y-2],[x-1,y-3],[x+2,y-2.5],[x+3.5,y-.5],[x+2.5,y+1],[x-2,y+1]],'#4e4838');
  poly(c,[[x-2.5,y-1.5],[x-1,y-2.5],[x+2,y-2],[x+2.7,y-.8],[x-.4,y-.6]],top);
  ln(c,x-1.5,y-1.9,x+.5,y-2,P.edge);
  ln(c,x+.5,y-.8,x+2,y-.5,'#736a54');
 }
 function schoolProps(c,s){
  const p=s.play;
  if(p.swing?.length){
   const [[a,y],q]=p.swing,b=q?.[0]??a,left=Math.min(a,b)-8,right=Math.max(a,b)+8;
   peg(c,left,y+4,26);peg(c,right,y+4,26);
   beam(c,left-2,y-25,right-left+4,3);
   for(const x of[left,right]){bolt(c,x,y-23.5);bolt(c,x,y-20);ln(c,x,y-17,x+(x===left?5:-5),y-23,P.mid,1);}
   for(const [x] of p.swing){
    r(c,x-2.5,y-23,1.5,2,P.iron);r(c,x+1.5,y-23,1.5,2,P.iron);
    oval(c,x,y+3,4,1.5,'rgba(26,30,18,.21)');
   }
  }
  if(p.read){const[x,y]=p.read;paddedBench(c,x,y,17);beam(c,x-8,y-10,16,2);}
  if(p.hop){
   const[x,y]=p.hop;
   [[-1,3],[-1,-1],[-3,-5],[2,-5],[-1,-9]].forEach(([a,b],i)=>{
    const X=x+a,Y=y+b;
    poly(c,[[X-2.5,Y-1.5],[X+1.5,Y-2],[X+2.4,Y-1],[X+2.4,Y+1.5],[X-2.7,Y+1.5]],i%2?'#778778':'#899e7a');
    r(c,X-1.8,Y-1,3.8,1.8,'#465844');r(c,X-.2,Y-.5,.6,1.5,'#b6b190');
   });
  }
  if(p.sand){
   const[x,y]=p.sand;
   poly(c,[[x-10,y-4],[x+9,y-4],[x+11,y+4],[x-11,y+4]],'#454133');
   poly(c,[[x-9,y-3.5],[x+8.5,y-3.5],[x+9.5,y+3],[x-9.5,y+3]],'#b69a68');
   for(const[xx,yy]of[[-7,-1],[-4,2],[5,-1],[7,1],[-1,-2],[3,1]])r(c,x+xx,y+yy,1,.5,'#d3b884');
   for(const dy of[-4,3.5])beam(c,x-10,y+dy,21,1.5);
   for(const dx of[-10,9]){ln(c,x+dx,y-3,x+dx,y+4,P.wood,1.5);bolt(c,x+dx,y+3);}
   poly(c,[[x+5,y+1],[x+8,y+1],[x+7.5,y+3],[x+5.5,y+3]],'#557e72');
   r(c,x+5.5,y+.5,2,.5,'#aabb96');
  }
  if(p.garden){
   const[x,y]=p.garden;
   r(c,x-9,y-3,18,8,'#4e4130');beam(c,x-10,y+4,20,1.5);beam(c,x-10,y-4,20,1.5);
   for(const dx of[-7,-3,2,6]){
    ln(c,x+dx,y+3,x+dx,y-1,'#697849');r(c,x+dx-1,y-.5,2,.75,'#879662');
    r(c,x+dx,y-1.5,.75,.75,dx<0?'#c29861':'#a2ad6c');
   }
  }
  if(p.seesaw){const [a,b]=p.seesaw,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;stone(c,x,y+1,1);peg(c,x,y,5,1.7);}
  if(p.slide){
   const[x,y]=p.slide;
   peg(c,x-3,y-1,17,1.4);for(let k=3;k<17;k+=4)beam(c,x-5,y-k,7,1);
   poly(c,[[x-1,y-14],[x+4,y-14],[x+16,y-1],[x+14,y+1],[x+11,y+1]],P.ink);
   poly(c,[[x,y-13],[x+3,y-13],[x+14.5,y-.4],[x+12,y+.4]],'#738782');
   ln(c,x+1,y-12,x+12.5,y-.5,'#a7b5a1');stone(c,x+14,y+1,1);
  }
 }
 function innProps(c,s){
  for(const [x,y]of s.seats||[]){
   oval(c,x+.5,y+2,3.8,1.3,'rgba(20,19,12,.28)');
   poly(c,[[x-3.7,y-4],[x+3.7,y-4],[x+3.3,y+1],[x-2.5,y+2]],P.ink);
   r(c,x-2.5,y-4,5,4.5,P.wood);ln(c,x-1,y-1,x-1.5,y+1,P.deep);
   oval(c,x,y-4,3.5,1.4,P.hi);oval(c,x,y-4,2,.7,P.mid);
  }
  if(s.oven){
   const[x,y]=s.oven;
   oval(c,x,y+4,12,2.5,'rgba(24,22,17,.31)');
   poly(c,[[x-10,y+4],[x-10,y-10],[x-7,y-15],[x+5,y-17],[x+9,y-13],[x+11,y-9],[x+11,y+4]],P.ink);
   poly(c,[[x-9,y+3],[x-9,y-10],[x-6,y-14],[x+4,y-16],[x+8,y-12],[x+10,y-8],[x+10,y+3]],'#746252');
   for(const[rise,half]of[[14,5],[11,8],[8,8],[4,9],[0,9]]){
    for(let i=-half;i<half;i+=4){
     const px=x+i,py=y-rise;
     r(c,px,py,3.5,2,((i+rise)&1)?'#95816b':'#aa957b');
     r(c,px,py,2,.5,'#c9b499');
    }
   }
   poly(c,[[x-6,y+2],[x-6,y-4],[x-4,y-7],[x+3,y-7],[x+6,y-4],[x+6,y+2]],'#3b2e26');
   ln(c,x-8,y+3,x+9,y+3,'#c4a982',1.5);
  }
  if(s.fire){const[x,y]=s.fire;for(const[dx,dy,i]of[[-6,0,1],[-4,3,0],[1,4,0],[5,2,2],[6,-1,1]])stone(c,x+dx,y+dy,i);}
  if(s.spit){
   const[x,y]=s.spit;
   for(const dx of[-10,10]){peg(c,x+dx,y+5,10,1.3);bolt(c,x+dx,y-4.5);}
   ln(c,x-11,y-3,x+13,y-3,P.iron,1);ln(c,x-10,y-3.5,x+11,y-3.5,P.silver);
   oval(c,x,y-1.5,4.9,2.6,'#80402a');oval(c,x-.5,y-2.3,4,1.6,'#b16a3b');
   ln(c,x-3,y-2.8,x+.5,y-3.2,'#d18b4d');ln(c,x+3,y-1,x+6,y-.5,'#ccb78c',.75);
  }
  if(s.chop){const[x,y]=s.chop;peg(c,x,y+1,5,3.5);oval(c,x,y-4,4,1.6,P.hi);oval(c,x,y-4,2.5,.7,P.mid);}
  if(s.darts){
   const[x,y]=s.darts;peg(c,x-1,y+1,15,1.5);oval(c,x,y-11,6,6,P.ink);
   oval(c,x,y-11,5.25,5.25,'#a98356');oval(c,x,y-11,3.6,3.6,'#607764');oval(c,x,y-11,1.7,1.7,'#ad5240');bolt(c,x-.5,y-11.5);
  }
  if(s.stage){const[x,y]=s.stage;beam(c,x-10,y+1,21,4);for(const dx of[-8,8])peg(c,x+dx,y+5,3,1);}
  for(const [x,y]of s.tables||[]){paddedBench(c,x,y,21);beam(c,x-12,y-8,24,3);}
  if(s.pantry?.length){
   const [x,y]=s.pantry[0];
   for(const dy of[-5,1])beam(c,x-4,y+dy,14,2);
   for(const dx of[-4,9])peg(c,x+dx,y+5,13,1);
  }
 }
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
  if(type==='school'&&s.play)schoolProps(c,s);
  if(type==='inn')innProps(c,s);
 }
 A.paint={r,ln,poly,oval,beam,board,bolt,disc,P};A.nativeBuilding=buildingSprite;
 buildingSprite=function(type,...args){const s=A.nativeBuilding(type,...args);if(!['inn','school','quarry','sawmill'].includes(type)||!s._publishedArt)return s;const prior=A.cache.get(s.canvas);if(prior)return prior;const cv=mkCanvas(s.canvas.width,s.canvas.height),c=cv.getContext('2d');c.drawImage(s.canvas,0,0);const k=cv.width/s.w,copy={...arrange(s,type),canvas:cv,_publishedYard:true};
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
   return {center,axis,raw,grip,target,p,length,cut:Math.hypot(center[0]-joint[0],center[1]-joint[1])<4.5};
 }
 A.sawmillCycle=sawmillCycle;
 function sawWood(c,{center:[x,y],axis:[dx,dy],raw}){
   const point=(along,across)=>[x+dx*along-dy*across,y+dy*along+dx*across];
   function piece(lo,hi,halfWidth,edge,body,light){
     poly(c,[point(-4.5,lo-.5),point(4.5,lo-.5),point(4.5,hi+.5),point(-4.5,hi+.5)],edge);
     poly(c,[point(-4.5,lo),point(4.5,lo),point(4.5,hi),point(-4.5,hi)],body);
     ln(c,...point(-4,lo),...point(4,lo),light,.5);
     ln(c,...point(-3,halfWidth),...point(1.5,halfWidth+.3),raw?'#69482f':'#af8252',.5);
     ln(c,...point(-4,hi-.35),...point(3,hi-.35),raw?'#755134':'#8e623a',.5);
   }
   if(raw){
     piece(-1.8,1.8,.5,P.deep,'#a87645','#cda471');
     const [ex,ey]=point(4.5,0);
     oval(c,ex,ey,1.6,1.7,P.deep);
     oval(c,ex,ey,1.2,1.25,'#ddb880');
     oval(c,ex,ey,.65,.75,'#ab7949');
     r(c,ex-.25,ey-.5,.5,.5,'#eed4a0');
   }else{
     piece(-2.1,-.5,-1.4,P.deep,'#c4955b','#eed19c');
     piece(.5,2.1,1.3,P.deep,'#b6854f','#e8ba81');
   }
 }
 function sawWorkerPose(s,i,cycle){
   const foot=s.workers[i],face=s.saw[0]<foot[0]?-1:1;
   const moving=cycle&&(cycle.raw?i===0:i===1);
   const bend=moving?Math.max(0,Math.min(1,cycle.raw?(1-cycle.p/.32):(cycle.p-.68)/.32)):0;
   const resting=[[2.7,-5.1],[.2,-5.7]];
   const rest={foot,face,bend,grips:null,hands:resting,showFar:false};
   if(!moving)return rest;
   const [x,y]=cycle.center,[dx,dy]=cycle.axis;
   const travel=cycle.p*cycle.length+(cycle.raw?2:-2);
   const sx=x-dx*travel-foot[0]-face,sy=y-dy*travel-foot[1]+7.2;
   const across=-sx*dy+sy*dx;
   if(Math.abs(across)>=6.8)return rest;
   const along=sx*dx+sy*dy,reachRadius=Math.sqrt(6.8**2-across*across);
   const first=(-reachRadius-along)/cycle.length,last=(reachRadius-along)/cycle.length;
   if(cycle.raw?last<=0:first>=1)return rest;
   const edge=cycle.raw?Math.min(.2,last):Math.max(.8,first);
   const touching=cycle.grip===i&&(cycle.raw?cycle.p<edge:cycle.p>edge);
   const transition=cycle.raw?cycle.p>=edge&&cycle.p<edge+.16:cycle.p>edge-.13&&cycle.p<=edge;
   if(!touching&&!transition)return rest;
   const shift=touching?0:(edge-cycle.p)*cycle.length;
   const point=(along,across)=>[x+dx*(along+shift)-dy*across,y+dy*(along+shift)+dx*across];
   const points=cycle.raw?[point(-2.7,-.8),point(-.6,.9)]
     :[point(2.7,-1.3),point(.65,1.3)];
   const reach=touching?1:cycle.raw?1-(cycle.p-edge)/.16:1-(edge-cycle.p)/.13;
   const weight=reach*reach*(3-2*reach);
   const hands=points.map(([x,y],i)=>[
     resting[i][0]+((x-foot[0])*face-resting[i][0])*weight,
     resting[i][1]+(y-foot[1]-resting[i][1])*weight,
   ]);
   return {foot,face,bend,grips:touching?points:null,hands,showFar:weight>.35};
 }
 A.sawmillWorkerPose=sawWorkerPose;
 let sawWorkerCanvas;
 function sawWorker(c,b,s,ox,oy,i,cycle){
   const {foot,face,bend,hands,showFar}=A.sawmillWorkerPose(s,i,cycle);
   // The simulation still employs a woodcutter at the mill. Its work clothes
   // belong to the carpentry station, without changing that worker's job.
   const actor={type:'carpenter',look:b.worker?.look??b.id*53+i+1,sx:b.worker?personSex(b.worker):''};
   const source=personSprite(actor,'E','work',{anim:'chop',f:9},{sowRigBase:true});
   if(!source._fantasyAppearance){
     drawFolk(c,actor,ox+foot[0],oy+foot[1],face<0?'W':'E','sawRest',0,{});
     return;
   }
   const cv=sawWorkerCanvas??=mkCanvas(52,54),p=cv.getContext('2d');
   p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,cv.width,cv.height);
   p.setTransform(2,0,0,2,26,45);p.imageSmoothingEnabled=false;
   const scale=YARD_K*A.scale,lean=half(bend*1.5),dip=half(bend*.75);
   const part=(x,y,w,h,dx=0,dy=0)=>p.drawImage(source,(PFX+x)*2,(PFY+y)*2,w*2,h*2,
     x*scale+dx,y*scale+dy,w*scale,h*scale);
   const fold=(points,color)=>poly(p,points.map(([x,y])=>[x+lean*Math.min(1,(-y-3)/5),
     y+dip*Math.min(1,(-y-3)/5)]),color);
   const normalized=(actor.look>>>0)>=0x20000?actor.look:LOOK_POOL[(actor.look>>>0)%LOOK_POOL.length];
   const skin=SKINS[lookOf({...actor,look:normalized}).skin%SKINS.length];
   const cloth=OUTFIT[actor.type].coat,wear=dwarfWorkwear(actor);
   const arm=(shoulder,hand,far)=>{
     const elbow=[(shoulder[0]+hand[0])/2-.35,(shoulder[1]+hand[1])/2+.9];
     ln(p,...shoulder,...elbow,P.ink,3);
     ln(p,...elbow,...hand,P.ink,2.5);
     ln(p,...shoulder,...elbow,shade(cloth,far?-.25:0),2.5);
     ln(p,...elbow,...hand,shade(cloth,far?-.1:.18),1.5);
   };
   const fist=([x,y],far)=>{
     poly(p,[[x-1.25,y-.55],[x-.6,y-1],[x+.65,y-1],[x+1.1,y-.35],
       [x+.9,y+.8],[x-.6,y+1],[x-1.15,y+.5]],P.ink);
     r(p,x-.7,y-.55,1.5,1.15,far?skin[1]:skin[0]);
     r(p,x-.55,y-.55,.75,.5,far?skin[2]:skin[1]);
   };
   part(-PFX,-6,PW,6);
   fold([[-3,-8],[-1.5,-9.5],[2,-9],[3.3,-7.2],[2.8,-3.1],[-2.8,-3.1],[-3.4,-5.6]],P.ink);
   fold([[-2.6,-7.7],[-1.4,-9],[1.5,-8.5],[2.7,-7],[2.3,-4],[-2.5,-4]],shade(cloth,-.25));
   fold([[-2.2,-7.5],[-1,-8.3],[1.1,-8],[2.2,-6.4],[1.4,-4.5],[-2.2,-4.4]],cloth);
   fold([[-2.2,-7.2],[-.7,-7.6],[.5,-7.1],[-.5,-6],[-2,-5.7]],shade(cloth,.2));
   fold([[-2.5,-4.7],[2.5,-4.7],[2.3,-3.5],[-2.4,-3.5]],'#473225');
   fold([[1,-4.7],[2,-4.7],[2,-3.7],[1,-3.7]],'#c39859');
   arm([1+lean,-7.2+dip],hands[1],true);
   part(-PFX,-PFY,PW,17.5,lean,dip);
   part(.5,-17.5,10,5,lean,dip);
   arm([-1.2+lean,-7.2+dip],hands[0],false);
   if(wear)paintWorkwearShoulder(wear,(px,py)=>[(-3.2-px)*scale+lean,(-15+py)*scale+dip],
     (points,color)=>poly(p,points,color));
   if(showFar)fist(hands[1],true);
   fist(hands[0],false);
   c.save();c.translate(ox+foot[0],oy+foot[1]);c.scale(face,1);
   c.imageSmoothingEnabled=false;c.drawImage(cv,-13,-22.5,26,27);c.restore();
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
 function skipPorchPaint(c,x,radius,minY,maxY,lastStyle){
  if(!c.canvas||typeof c.getTransform!=='function'||c.globalCompositeOperation!=='source-over'||
     c.filter!=='none'||c.shadowColor!=='rgba(0, 0, 0, 0)')return false;
  const {a,b,c:shear,d,e,f}=c.getTransform();
  if(b!==0||shear!==0||!(a>0)||!(d>0))return false;
  if((x+radius)*a+e>-1&&(x-radius)*a+e<c.canvas.width+1&&
     maxY*d+f>-1&&minY*d+f<c.canvas.height+1)return false;
  c.fillStyle=lastStyle;
  return true;
 }
 function porchDeck(c,x,y,hw){
  if(skipPorchPaint(c,x,hw+4,y-10,y+12+A.porchGap,P.shine))return;
  const left=x-hw,right=x+hw,top=y-9,bottom=y+8+A.porchGap;
  for(const off of[3,hw,2*hw-4])stone(c,left+off,bottom+1,1);
  poly(c,[[left+2,top],[right-2,top],[right,bottom],[right-1,bottom+2],[left+1,bottom+2],[left,bottom]],P.ink);
  const boards=['#76553a','#866246','#8b6849','#805b3d'];
  for(let i=0,yy=top+1;yy<bottom;i++,yy+=2.5){
   r(c,left+1,yy,right-left-2,2,boards[i%4]);
   ln(c,left+2,yy,right-2,yy,i%3===0?'#ab8055':'#99704d');
   for(let xx=left+5+(i%3)*3;xx<right-4;xx+=12){ln(c,xx,yy+1,xx+4,yy+1,P.mid);r(c,xx-.5,yy+.5,.5,1.5,P.deep);}
  }
  beam(c,left,bottom,hw*2,1.5);
  for(const off of[2,2*hw-3])bolt(c,left+off,bottom+.5);
 }
 innTable=function(c,x,y,w){
  if(!porchIdentity)return A.native.innTable(c,x,y,w);
  if(skipPorchPaint(c,x,w/2+4,y-10,y+7+A.porchGap,P.deep))return;
  const g=A.porchGap,left=x-w/2,right=x+w/2,top=y-9,bottom=y-4+g;
  oval(c,x+1,y+1+g,w/2+2,3.5,'rgba(12,10,6,.3)');
  for(const dx of w>40?[-w/2+3,0,w/2-4]:[-w/2+3,w/2-4])peg(c,x+dx,y+g,6,1.4);
  poly(c,[[left+.5,top],[right-.7,top],[right,bottom],[right-.8,bottom+2],[left+.7,bottom+2],[left,bottom]],P.ink);
  for(let i=0,yy=top+.5;yy<bottom;i++,yy+=2.5){
   r(c,left+.8,yy,w-1.6,2,['#a57043','#b1804e','#966437'][i%3]);
   ln(c,left+2,yy+.5,right-2,yy+.5,i%2?'#c29861':'#bc8854');
  }
  const ty=y-3;
  poly(c,[[left+1,ty-1],[right-1,ty-1],[right-1,ty+3],[left+1,ty+3]],'#944d3c');
  for(const a of[-.5,2.5])ln(c,left+2,ty+a,right-2,ty+a,'#c38b63');
  for(let xx=left+4;xx<right-3;xx+=4){r(c,xx,ty+.5,1,1,'#ddba83');}
  beam(c,left,bottom,w,1.5);
 };
 innBench=function(c,x,y,w){
  if(!porchIdentity)return A.native.innBench(c,x,y,w);
  const g=Math.abs(y-(porchIdentity.ty+7))<.02?A.porchGap:0;
  const benchY=y+g+5;
  if(skipPorchPaint(c,x,w/2+4,benchY-8,benchY+8,'#d7b674'))return;
  paddedBench(c,x,benchY,w);
 };
 innAwning=function(c,x,y,k,sc){if(!porchIdentity)return A.native.innAwning(c,x,y,k,sc);const top=y-30,bw=16*sc,fw=19*sc,depth=11+A.porchGap;c.save();c.globalAlpha=Math.min(1,k*2);c.fillStyle='#5a3a1e';for(const[dx,h0,ph]of[[-bw+3,top+2,y-10],[bw-3,top+2,y-10],[-fw+3,top+depth,y+4+A.porchGap],[fw-3,top+depth,y+4+A.porchGap]])r(c,x+dx-.7,h0,1.6,ph-h0,'#5a3a1e');c.globalAlpha=1;const front=top+depth*k,fwk=bw+(fw-bw)*k;for(let i=0;i<10;i++){const a=i/10,b=(i+1)/10;c.fillStyle=i%2?'#f0e6cc':'#b8402c';poly(c,[[x-bw+a*2*bw,top],[x-bw+b*2*bw,top],[x-fwk+b*2*fwk,front],[x-fwk+a*2*fwk,front]],c.fillStyle);if(k>.85){const X=x-fwk+a*2*fwk,Z=x-fwk+b*2*fwk;poly(c,[[X,front],[Z,front],[(X+Z)/2,front+4]],c.fillStyle)}}r(c,x-fwk,front-.8,fwk*2,.8,'rgba(0,0,0,.18)');r(c,x-bw,top,bw*2,.8,'rgba(255,255,255,.25)');c.restore()};
 const nativeWaitress=drawWaitress;
 drawWaitress=function(c,b,s,tx,ty,ox,oy,guests,n,hw){
  if(!s._publishedYard||!s.doorPt)return nativeWaitress(c,b,s,tx,ty,ox,oy,guests,n,hw);
  const [dx,dy]=s.doorPt,[ax,ay,aw]=s._artBox;
  const doorX=ox+dx,doorY=oy+dy,wallX=ox+ax,wallY=oy+ay;
  const w=b[n?'_wt2':'_wt'],walk=w&&(w.st==='out'||w.st==='back');
  const target=tx+(n?1:-1)*Math.max(6,hw-10);
  const distance=Math.hypot(target-doorX,ty-16-doorY)||1;
  const f=walk?Math.min(1,Math.hypot(w.x-doorX,w.y-doorY-4)/distance):0;
  const bow=half(Math.sin(f*Math.PI)*Math.min(21,Math.abs(target-doorX)*.36));
  c.save();
  // The door briefly reveals the character from the sill down.
  const clip=new Path2D();
  clip.rect(ox-30,oy-30,s.w+60,s.h+60);
  clip.rect(wallX+1,wallY,aw-2,doorY-wallY-1);
  clip.rect(doorX-4.5,doorY-13,9,12);
  c.clip(clip,'evenodd');
  try{
   c.translate(0,bow);
   return nativeWaitress(c,b,s,tx,ty,ox,oy,guests,n,hw);
  }finally{c.restore();}
 };
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
 function pupil(c,b,id,x,y,view,pose='idle',frame=0,opt={}){
  const front=view==='W'?'E':view,s=.67;
  const sprite=folkSprite(kidFolk(b,id),front,pose,frame,opt);
  c.save();
  c.translate(half(x),half(y));
  if(view==='W')c.scale(-1,1);
  c.drawImage(sprite,-half(PFX*s),-half(PFY*s),half(PW*s),half(PH*s));
  c.restore();
 }
 drawSchoolYard=function(c,b,s,ox,oy){
  if(!s._publishedYard)return A.native.drawSchoolYard(c,b,s,ox,oy);
  if(b.state!=='done'||!s.play)return;
  const p=s.play,t=Game.time,day=!isNightNow(),x=q=>ox+q[0],y=q=>oy+q[1];
  const shadow=(X,Y,w=4)=>oval(c,X+.6,Y+.6,w,1.25,'rgba(28,30,18,.3)');
  c.save();c.imageSmoothingEnabled=false;
  if(p.hop&&day){
   const ph=(t*.6+b.id)%1,Y=y(p.hop)+6-ph*12,jump=Math.abs(Math.sin(ph*Math.PI*4))*2;
   shadow(x(p.hop),Y);pupil(c,b,0,x(p.hop),Y-jump,'N','walk',Math.floor(ph*4)%WALK_FRAMES);
  }
  if(p.swing)for(const[i,q]of p.swing.entries()){
   const a=day?Math.sin(t*2.4+i*1.3):0,X=x(q)+a*2,Y=y(q)-Math.abs(a)*1.5;
   for(const dx of[-2,2]){
    ln(c,x(q)+dx,y(q)-21,X+dx,Y-4,'#615039',1);
    ln(c,x(q)+dx-.5,y(q)-21,X+dx-.5,Y-4,'#c0aa76');
   }
   beam(c,X-3.5,Y-3.5,7,1.5);
   if(day)pupil(c,b,i?2:1,X,Y,'S','idle',0,i?{}:{gest:'clap',gf:gestCyc(t)});
  }
  if(p.read&&day)pupil(c,b,3,x(p.read),y(p.read),'S','idle',0,{gest:'read',gf:gestCyc(t*2)});
  if(p.sand&&day)pupil(c,b,4,x(p.sand),y(p.sand),'S','work',{anim:'pat',f:Math.floor(t*8)%8});
  if(p.garden&&day)pupil(c,b,11,x(p.garden),y(p.garden),'S','work',{anim:'dig',f:Math.floor(t*6)%8});
  if(p.seesaw){
   const[a,bp]=p.seesaw,aY=y(a)-(day?Math.sin(t*2)*2:0),bY=y(bp)+(day?Math.sin(t*2)*2:0);
   ln(c,x(a)-2,aY-3,x(bp)+2,bY-3,P.ink,2.5);
   ln(c,x(a)-2,aY-3.5,x(bp)+2,bY-3.5,P.hi,1);
   for(const[i,q]of p.seesaw.entries()){
    const Y=i?bY:aY;peg(c,x(q),Y-3,5,1);
    if(day)pupil(c,b,5+i,x(q),Y,i?'W':'E');
   }
  }
  if(p.slide&&day){
   const ph=(t*.5+b.id)%1,X=x(p.slide)+ph*12,Y=y(p.slide)-12+ph*12;
   pupil(c,b,7,X,Y,'E','idle',0);
  }
  c.restore();
 };
 if(typeof SLAP_HATS!=='undefined')for(const key of Object.keys(SLAP_HATS))delete SLAP_HATS[key];
 if(FantasyPublishedArt.people)FantasyPublishedArt.people.clear();if(typeof FOLK_LAST!=='undefined')FOLK_LAST.clear();
})();
















'use strict';
// Draw children on the original person canvas. The simulation owns motion and clocks.
(() => {
  const nativeSprite = personSprite;
  const nativePortrait = portraitURL;
  const poseCache = new Map(), portraits = new Map();
  const maxPoses = 320;
  const ink = '#342720', boot = '#634332', belt = '#61412c', buckle = '#bd8b4b';
  const viewTable = {
    S:  {turn:0,   width:1,   back:false, side:false},
    SE: {turn:1,   width:.94, back:false, side:false},
    E:  {turn:2.1, width:.77, back:false, side:true},
    NE: {turn:1,   width:.90, back:true,  side:false},
    N:  {turn:0,   width:1,   back:true,  side:false}
  };
  const mirrored = {SW:'SE', W:'E', NW:'NE'};
  const aliases = new Set(['idle','walk','work','duck','tame','smoke']);
  const tools = new Set(['dig','pat','toss']);
  const step = n => Math.round(n*2)/2;
  const rect = (c,x,y,w,h,color) => {
    c.fillStyle=color;
    c.fillRect(step(x),step(y),step(w),step(h));
  };
  const shape = (c,points,color) => fpaSowPolygon(c,points,color);
  const oval = (c,x,y,rx,ry,color) => {
    for(let row=step(y-ry);row<y+ry;row+=.5){
      const dy=(row+.25-y)/ry;
      if(Math.abs(dy)>=1)continue;
      const width=rx*Math.sqrt(1-dy*dy);
      rect(c,x-width,row,2*width,.5,color);
    }
  };
  const line = (c,a,b,w,color) => fpaSowBand(c,a,b,w,color);
  const pants = '#95633b';
  const remember = (cache,key,value,limit) => {
    if(cache.size>=limit)cache.delete(cache.keys().next().value);
    cache.set(key,value);
    return value;
  };

  function clothing(c,v,coat,x,y) {
    const form=(points,color)=>shape(c,points.map(([a,b])=>[x+a*v.width,y+b]),color);
    form([[-5,-10],[-3.8,-12],[-1.8,-12.5],[2.5,-12.5],[4.8,-10.5],[5,-7],
      [5.4,-5.7],[3.3,-4.5],[-3.5,-4.5],[-5.5,-5.8]],ink);
    form([[-4.5,-10],[-3,-11.5],[2.4,-12],[4.4,-10.2],[4.6,-7.2],
      [5,-6],[2.7,-5],[-3.4,-5.2],[-5,-6.2]],shade(coat,-.25));
    form([[-4.2,-9.6],[-2.8,-11.4],[2.5,-11.4],[4,-9.5],[4,-7.6],
      [1,-7],[-2.4,-7.4],[-4.2,-7.9]],coat);
    form([[-3.9,-9.5],[-2.8,-11.1],[-.7,-11.3],[-1.4,-9.9],[-3.7,-9]],shade(coat,.2));
    form([[-4.7,-7.7],[4.6,-7.7],[4.5,-6.3],[1,-6],[-4.5,-6.5]],belt);
    if(v.back){
      form([[0,-11],[-.5,-9],[-.25,-8],[.25,-8],[.4,-9.5]],shade(coat,-.35));
      form([[2.3,-7.8],[3.3,-7.8],[3.2,-6.6],[2.5,-6.6]],'#805835');
    }else{
      const b=x+(v.side?2.45:v.turn*.7);
      rect(c,b-1,y-7.9,2,1.8,buckle);
      rect(c,b-.5,y-7.4,1,.75,'#724c31');
      rect(c,b-1,y-8,1,.5,'#e1b273');
      form([[-2.7,-11.2],[0,-9.9],[2.4,-11.4],[0,-10.7]],'#546e70');
    }
  }

  function head(c,v,q,x,y,hat,turnPhase) {
    const h=q.hair, skin=SKINS[q.L.skin%SKINS.length];
    const faceSide=v.turn, xHead=x+v.turn*.52;
    const form=(points,color)=>shape(c,points.map(([a,b])=>[xHead+a,y+b]),color);
    const wide=v.side?4.6:5.0;
    const crown=[[-wide,-17],[-wide-.5,-20.4],[-3.6,-22],[2.6,-22.3],
      [wide,-20.6],[wide+.4,-17.5],[wide-.6,-14.5],[2,-13],[-2.2,-13.1],[-4.3,-15]];
    form(crown,ink);
    if(v.back){
      form([[-wide+.5,-17],[-wide,-20.2],[-2.5,-21.6],[2.6,-21.3],[wide-.25,-19.7],
        [wide-.05,-17.3],[3.8,-14.9],[2,-14.5],[.6,-15.1],[-1,-14.4],[-3.7,-15.1]],shade(h,-.29));
      form([[-4.3,-18],[-3.5,-20.1],[-.6,-20.6],[1.3,-19.8],[.7,-17.3],
        [-1.4,-16.3],[-3.3,-16]],h);
      if(!v.turn)oval(c,xHead-wide+.15,y-16.4,.85,1.25,skin[1]);
      oval(c,xHead+wide-.15,y-16.3,.85,1.25,skin[1]);
      rect(c,xHead-.9,y-14.4,1.8,1,skin[1]);
    }else{
      form([[-wide+.2,-17],[-wide,-19.5],[-3.1,-21],[2.8,-21.2],[wide-.3,-19.6],
        [wide+.05,-17.4],[4.3,-14.7],[1.9,-13.5],[-2.5,-13.6],[-4.1,-15]],skin[1]);
      form([[-3.8,-17.7],[-2.6,-19.2],[3.2,-19.2],[wide-.3,-17.7],[3.7,-15.6],
        [2,-14.2],[-1.7,-14.2],[-3.2,-15]],skin[0]);
      oval(c,xHead-wide+.1,y-16.7,1.05,1.35,skin[2]);
      oval(c,xHead-wide-.05,y-16.85,.65,.85,skin[1]);
      if(!v.side)oval(c,xHead+wide-.05,y-16.5,.7,1.1,skin[1]);
      form([[-4.8,-19.7],[-4,-21.1],[-1.5,-21.6],[2,-21.5],[4.6,-20.1],
        [4,-18.7],[1.8,-18.4],[.4,-19],[-1.8,-18.3],[-2.8,-17.8],[-4.3,-17.9]],shade(h,-.18));
      if(q.sex==='f'){
        for(const a of v.side?[-3.65]:[-3.65,3.8]){
          oval(c,xHead+a,y-14.3,.9,1.45,shade(h,-.26));
          rect(c,xHead+a-.4,y-13.35,1,.5,'#d9aa57');
        }
      }
      const nose=xHead+(v.side?4.6:faceSide*1.3);
      oval(c,nose,y-17,1.65,1.05,skin[2]);
      oval(c,nose-.1,y-17.26,1.35,.8,skin[0]);
      rect(c,nose-.75,y-17.7,.85,.5,shade(skin[0],.17));
      line(c,[nose-1.6,y-15.15],[nose+.15,y-15],.5,'#965c49');
      if(q.L.freckles&&!v.side){
        rect(c,xHead-2.6,y-16.5,.5,.5,'#c98b62');
        rect(c,xHead+2.6,y-16,.5,.5,'#c98b62');
      }
    }
    if(!hat)return;
    const color=q.cap, sign=v.back?1:-1;
    const cloth=(points,col)=>form(points.map(([a,b])=>[a*sign,b]),col);
    cloth([[-6.3,-18.4],[-5.6,-21.8],[-4.4,-24.5],[-2,-26.7],[.7,-27.5],
      [3.4,-27.4],[5.6,-26.2],[7.3,-24.55],[8.2,-22.65],[8.05,-20.9],
      [6.9,-21.4],[6,-22.9],[4.8,-23.55],[3.8,-22.8],[4.4,-20.8],
      [6.55,-19.75],[6.85,-18.65],[3.3,-18],[-3.3,-18]],ink);
    cloth([[-5.65,-19.1],[-5.1,-21.7],[-3.95,-24.3],[-1.8,-26.2],[.7,-26.9],
      [3.2,-26.9],[5.3,-25.75],[6.8,-24.3],[7.65,-22.6],[7.6,-21.75],
      [6.98,-22],[6.05,-23.65],[4.5,-24.1],[3.35,-22.75],[3.9,-20.6],
      [5.9,-19.7],[6.25,-19.15],[2.9,-18.64],[-3.2,-18.65]],shade(color,-.3));
    cloth([[-4.6,-21.2],[-3.35,-24.35],[-1.7,-25.85],[.8,-26.7],[3.05,-26.55],
      [4.85,-25.75],[6.3,-24.3],[6.85,-23.4],[5.6,-24.55],[4.3,-24.7],
      [3.1,-23.25],[3.05,-21.8],[1.35,-20.6],[-1.6,-20.55]],color);
    cloth([[-3.65,-23.8],[-1.65,-25.6],[.6,-26.37],[2.55,-26.42],[3.1,-26.1],
      [1.45,-25.76],[-.35,-24.85],[-1.9,-23.35],[-3.6,-22.7]],shade(color,.23));
    cloth([[-5.85,-19.9],[-3.7,-20.45],[3.45,-20.15],[6.2,-19.7],
      [6.2,-19],[3,-18.5],[-4,-18.75],[-5.85,-19.12]],shade(color,-.03));
    line(c,[xHead-4,y-19.85],[xHead+3.1,y-19.75],.5,shade(color,.33));
    line(c,[xHead+sign*2.9,y-23.8],[xHead+sign*2.25,y-21.1],.5,shade(color,-.22));
    for(const [a,b] of [[-.4,-22.4],[.6,-24.2],[2,-25.5],[-2.7,-22.8],[1.5,-21.5]])
      rect(c,xHead+sign*a,y+b,.5,1,shade(color,a<0?.14:-.15));
    oval(c,xHead+sign*(7.45+turnPhase*.25),y-22.2,1.12,1,shade(color,-.44));
    oval(c,xHead+sign*(7.5+turnPhase*.25),y-22.35,.76,.7,shade(color,.08));
  }

  function shoe(c,x,y,dx,lift,near){
    const X=x+dx,Y=y-lift,col=near?boot:shade(boot,-.2);
    shape(c,[[x-2,y-5.8],[x+2.3,y-5.8],[X+1.9,Y-2],[X-1.9,Y-1.6]],ink);
    shape(c,[[x-1.4,y-5.6],[x+1.7,y-5.3],[X+1.2,Y-2.5],[X-1.35,Y-2]],near?pants:shade(pants,-.16));
    shape(c,[[X-2,Y-3.1],[X+1.4,Y-3.3],[X+2.6,Y-1.8],[X+2.55,Y],[X-2.2,Y],[X-2.4,Y-1]],ink);
    shape(c,[[X-1.5,Y-2.9],[X+.9,Y-2.8],[X+2.1,Y-1.55],[X+2,Y-.5],[X-1.8,Y-.5]],col);
    rect(c,X-1.45,Y-2.5,1.5,.5,shade(col,.27));
    rect(c,X-.2,Y-1.4,1.6,.5,shade(col,-.24));
  }
  function book(c,x,y,f){
    shape(c,[[x-4.1,y-2.2],[x,y-1.1],[x+4.1,y-2.2],[x+3.7,y+1.25],
      [x,y+2.5],[x-3.7,y+1.25]],'#4e3b2a');
    shape(c,[[x-3.8,y-2],[x,y-1.3],[x+3.8,y-2],[x+3.2,y+.85],
      [x,y+1.9],[x-3.2,y+.85]],'#dcc89f');
    line(c,[x,y-1.3],[x,y+1.6],.5,'#8e7750');
    if(f>.65)line(c,[x,y-1.3],[x+2.7*f,y-3.2],.6,'#eddbad');
  }
  function grip(c,u,v,side,root,neutral,pose,frame,opt,skin){
    const primary=side===1, far=v.turn!==0&&!primary;
    const gest=opt.gest, phase=Number(opt.gf)||0;
    const f=['five','flirt','wslap','cheek'].includes(gest)?Math.max(0,Math.floor(phase)):gestK(phase);
    let target=neutral, opened=false;
    if(gest==='read'&&!v.back){
      target=[side*3.55+root[0]*.15,-7.8-(primary&&f>.65?.8:0)];
    }else if(gest&&gest!=='read'&&(primary||['clap','stretch','panic','six7'].includes(gest))){
      const joint=gestPts(gest,f,side,root[1],-18,v.side?'E':v.back?'N':'S')?.[1];
      if(Array.isArray(joint)&&joint.every(Number.isFinite)){
        target=[joint[0]*.9,joint[1]];
        opened=['wave','clap','stretch','panic','five','six7','point'].includes(gest);
      }
    }else if(pose==='work'){
      const p=frame.f|0, wave=Math.sin(p/WORK_FRAMES*Math.PI*2);
      if(frame.anim==='pat'){target=[side*(3.25+wave*.9),-6.4-(primary?wave:-wave)*1.3];opened=true;}
      if(frame.anim==='dig'&&primary)target=[2.6+wave*1.15,-8.6+wave*1.6];
      if(frame.anim==='toss'&&primary){
        const [x,y]=kpHand({face:1},Math.min(p,8));
        target=[x,y];
      }
    }else if(pose==='smoke'&&primary){
      target=SMOKE_ARM[v.side?'E':'S'].hand[frame]||neutral;
    }else if((pose==='duck'||pose==='tame')&&primary){
      const p=[0,.35,.8,1,.62,.2][frame]??0;
      target=opt.posture==='sit'?[3.5,-5.6]:[3+p*2.35,-7.2+p*2.1];opened=true;
    }
    const dx=target[0]-root[0],dy=target[1]-root[1],d=Math.hypot(dx,dy),max=7.6;
    if(d>max&&frame?.anim!=='toss')target=[root[0]+dx/d*max,root[1]+dy/d*max];
    const joint=fpaPoseArm(c,root,target,u.coat,far,.68,primary?-1:1);
    const angle=Math.atan2(target[0]-joint.elbow[0],target[1]-joint.elbow[1]);
    return {hand:target,angle,far,opened,skin};
  }
  function hand(c,g){
    fpaPoseHand(c,g.hand,g.angle,g.skin,g.far,.57,g.opened);
  }
  function paint(c,q,view,pose,frame,opt,originalHead){
    const v=viewTable[view], skin=SKINS[q.L.skin%SKINS.length];
    const stepAngle=pose==='walk'?frame/WALK_FRAMES*Math.PI*2:0;
    const stride=pose==='walk'?Math.sin(stepAngle):0;
    const bounce=pose==='walk'?-Math.abs(Math.cos(stepAngle))*.45:0;
    const bodyDrop=pose==='duck'||pose==='tame'?2.35:pose==='work'&&frame.anim!=='toss'?1.1:0;
    const drift=v.turn*.23+stride*.3, y=step(bodyDrop+bounce-(pose==='idle'?(IDLE_BREATH[frame]||0):0));
    const dx=(v.side?2.45:v.turn?.95:.48)*stride;
    shoe(c,-2.15*v.width,0,-dx,Math.max(0,stride)*1.35,false);
    shoe(c, 2.15*v.width,0, dx,Math.max(0,-stride)*1.35,true);
    const root1=[drift-3.5*v.width,y-11.45],root2=[drift+3.5*v.width,y-11.45];
    const neutral1=[root1[0]-.85,-6.9+y+stride],neutral2=[root2[0]+.85,-6.75+y-stride];
    const far=grip(c,q,v,-1,root1,neutral1,pose,frame,opt,skin);
    if(v.turn)hand(c,far);
    clothing(c,v,q.coat,drift,y);
    const near=grip(c,q,v,1,root2,neutral2,pose,frame,opt,skin);
    if(opt.gest==='read'&&!v.back)book(c,drift,-8.5,gestK(Number(opt.gf)||0));
    if(pose==='work'&&frame.anim==='dig'){
      const [x,y]=near.hand;
      line(c,[x-.35,y-1.4],[x+2.4,y+3],1.2,'#674b31');
      shape(c,[[x+1.5,y+2.65],[x+2.9,y+2.2],[x+4,y+4.55],
        [x+3.4,y+5.25],[x+2.3,y+4.9]],'#516664');
      rect(c,x+2.7,y+3.8,1,.5,'#a4ae95');
    }
    if(pose==='tame'&&!v.back){
      const [x,y]=near.hand;
      shape(c,[[x+.2,y-1.3],[x+1.65,y-2],[x+3,y-1],[x+2.8,y+.35],[x+.25,y+.3]],'#c5a274');
    }
    if(originalHead){
      // Reuse the approved face and cap in the two forward-facing side views.
      const bottom=PFY-12.5;
      c.drawImage(originalHead,0,0,PW*2,bottom*2,-PFX+step(drift-.25),-PFY+y,PW,bottom);
    }else head(c,v,q,drift,y,!opt.nohat,stride*.5);
    if(!v.turn)hand(c,far);
    hand(c,near);
  }

  function walkView(u,view){
    if(!['E','S','N'].includes(view))return view;
    const next=u.action?.path?.[u.action.i];
    if(!next||!u.action.walk||!Number.isFinite(u.x)||!Number.isFinite(u.y))return view;
    const [x,y]=next, hori=x+.5-u.x, vert=y+.5-u.y;
    if(Math.hypot(hori,vert)<.08||Math.abs(hori)<Math.abs(vert)*.42||Math.abs(vert)<Math.abs(hori)*.42)return view;
    // The renderer mirrors native E; S and N need their own reflected rows.
    return (vert<0?'N':'S')+(view!=='E'&&hori<0?'W':'E');
  }
  function render(u,view,pose,frame,opt={}){
    if(u.type!=='kid'||!aliases.has(pose)||u.carry||opt.wpn||
       pose==='work'&&!tools.has(frame?.anim))return nativeSprite(u,view,pose,frame,opt);
    if(pose==='walk')view=walkView(u,view);
    const flip=Boolean(mirrored[view]);
    const dir=mirrored[view]||view;
    if(!viewTable[dir])return nativeSprite(u,view,pose,frame,opt);
    const q=FantasyPublishedAppearanceArt.resolve(u);
    if(pose==='smoke'&&dir!=='S'&&dir!=='E')return nativeSprite(u,view,pose,frame,opt);
    const poseCount=pose==='walk'?WALK_FRAMES:pose==='idle'?IDLE_FRAMES:pose==='smoke'?SMOKE_ARM.S.hand.length:6;
    const f=pose==='work'?{anim:frame.anim,f:Math.min(WORK_FRAMES-1,Math.max(0,frame.f|0))}:
      (Math.abs(frame|0)%poseCount);
    const raw=Number(opt.gf)||0, gf=opt.gest?Math.max(0,Math.min(31,raw)):0;
    const key=[q.look,q.sex,view,pose,pose==='work'?f.anim+f.f:f,opt.gest||'',gf,opt.posture||'',!!opt.nohat].join('|');
    if(poseCache.has(key))return poseCache.get(key);
    const sprite=mkCanvas(PW*2,PH*2),c=sprite.getContext('2d');
    c.imageSmoothingEnabled=false;
    c.setTransform(flip?-2:2,0,0,2,PFX*2,PFY*2);
    const originalHead=(dir==='SE'||dir==='E')&&!opt.nohat?nativeSprite({...u,_spr:null},'E','idle',0,{}):null;
    paint(c,q,dir,pose,f,{...opt,gf},originalHead&&!originalHead._pendingSprite?originalHead:null);
    sprite._fantasyAppearance=true;
    return remember(poseCache,key,sprite,maxPoses);
  }
  personSprite=render;
  portraitURL=function(type,look=3,sx=''){
    if(type!=='kid')return nativePortrait(type,look,sx);
    const key=look+'|'+sx;
    if(portraits.has(key))return portraits.get(key);
    const s=render({type,look,sx},'S','idle',0,{}),cv=mkCanvas(48,48),c=cv.getContext('2d');
    c.imageSmoothingEnabled=false;c.fillStyle='#263929';c.fillRect(0,0,48,48);
    c.drawImage(s,2,6,48,48,0,0,48,48);
    return remember(portraits,key,cv.toDataURL(),128);
  };
  window.FantasyDwarfChild={version:1,render,base:nativeSprite,walkView,cache:poseCache,ready:FantasyPublishedAppearanceArt.ready};
})();

