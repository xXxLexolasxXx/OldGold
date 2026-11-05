/* Forest neutrals, presentation only. Load once, after the other fantasy modules.
 * Native poses, foot points and gameplay are never written by this adapter.
 * Five independently authored surfaces; W/NW/SW are paired mirrors.
 */
'use strict';
(() => {
  if (window.FantasyForestNeutrals) return;
  const api = window.FantasyForestNeutrals = {version:1,ready:false,assetErrors:[],pixelRatio:2};
  const headings=['S','SE','E','NE','N','NW','W','SW'];
  const cache=new Map(), motion=new WeakMap(); let rgba=0,hits=0,misses=0,active=null;
  const MAX_ENTRIES=768,MAX_RGBA=48*1024*1024;
  const originals={naFrame,neuDraw,lepFrame,lepDraw,lepPotSprite,lepDrawRainbow,sprBrownie,sprEnder,brownieDraw,endermanDraw,garA,garB,garC};
  const R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const Q=(c,pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();};
  // All strokes are rasterized to the same half-world-pixel grid.
  const L=(c,x,y,xx,yy,w,col)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='square';c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
  const ink='#342e30',skin='#e7bc95',skinD='#a77761',cream='#f3dfb5';
  const layouts={
    S:{head:[[-5,-5],[-3,-7],[3,-7],[5,-5],[5,3],[3,5],[-3,5],[-5,3]],eyes:[-2.8,1.8],nose:0,body:[[-5,-21],[5,-21],[4,-13],[6,-9],[-6,-9]],shoulders:[-4,4],feet:[-2.8,2.8]},
    SE:{head:[[-5,-5],[-2,-7],[3,-6],[5,-3],[6,0],[4,4],[0,5],[-4,3]],eyes:[-.5,3],nose:4,body:[[-5,-21],[3,-22],[5,-18],[3,-13],[6,-10],[-4,-9]],shoulders:[-4,3],feet:[-2,2.5]},
    E:{head:[[-4,-6],[1,-7],[4,-5],[4,-2],[7,0],[4,2],[4,4],[-1,5],[-4,2]],eyes:[2.1],nose:5,body:[[-3,-22],[2,-22],[4,-19],[2,-13],[4,-9],[-4,-9]],shoulders:[-1.8,1.7],feet:[-1,1]},
    NE:{head:[[-5,-4],[-2,-7],[3,-6],[5,-3],[4,3],[1,5],[-3,4],[-5,1]],eyes:[],nose:0,body:[[-4,-20],[2,-22],[5,-19],[4,-13],[6,-9],[-4,-10]],shoulders:[-3,3.5],feet:[-2,2.5]},
    N:{head:[[-5,-5],[-3,-7],[3,-7],[5,-5],[5,3],[3,5],[-3,5],[-5,3]],eyes:[],nose:0,body:[[-5,-21],[5,-21],[4,-13],[6,-9],[-6,-9]],shoulders:[-4,4],feet:[-2.8,2.8]}
  };
  function surface(dir){const mirror=['SW','W','NW'].includes(dir);return {mirror,key:({SW:'SE',W:'E',NW:'NE'})[dir]||dir};}
  function angle(dx,dy){return headings[(Math.round(Math.atan2(dx,dy)/(Math.PI/4))+8)%8];}
  function direction(o,target){
    const prev=motion.get(o);let dx=0,dy=0;
    if(prev){dx=o.x-prev.x;dy=o.y-prev.y;}
    let h=prev?.h||(o.vf?'S':o.face<0?'W':'E');
    if(Math.hypot(dx,dy)>.0001&&Math.hypot(dx,dy)<4)h=angle(dx,dy);
    else if(target&&Number.isFinite(target[0])&&Math.hypot(target[0]-o.x,target[1]-o.y)>.04)h=angle(target[0]-o.x,target[1]-o.y);
    motion.set(o,{x:o.x,y:o.y,h});return h;
  }
  function neutralTarget(o){
    if(o.tg&&typeof neuUnit==='function'){const t=neuUnit(o.tg);if(t)return [t.x,t.y];}
    if(o.st==='roam')return [o.wx,o.wy];if(o.st==='home')return [o.hx,o.hy];return null;
  }
  function put(key,make){
    if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);hits++;return s;}
    misses++;const s=make(),bytes=s.cv.width*s.cv.height*4;
    while(cache.size&&(cache.size>=MAX_ENTRIES||rgba+bytes>MAX_RGBA)){const k=cache.keys().next().value;const v=cache.get(k);rgba-=v.cv.width*v.cv.height*4;cache.delete(k);}
    if(bytes<=MAX_RGBA){cache.set(key,s);rgba+=bytes;}return s;
  }
  function raster(spec,paint,fade=0,hurt=0){
    const cv=document.createElement('canvas');cv.width=spec.w*2;cv.height=spec.h*2;
    const c=cv.getContext('2d');c.scale(2,2);c.translate(spec.ax,spec.ay);c.imageSmoothingEnabled=false;paint(c);
    // Quantize alpha, including transformed contours; no translucent vector rim.
    const image=c.getImageData(0,0,cv.width,cv.height),d=image.data;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
      const i=(y*cv.width+x)*4;if(d[i+3]<110||fade&&naHash(x>>1,y>>1)<fade)d[i+3]=0;
      else{d[i+3]=255;if(hurt)for(let j=0;j<3;j++)d[i+j]=Math.round(d[i+j]+(245-d[i+j])*hurt*.26);}
    }
    c.putImageData(image,0,0);cv.fine=2;
    return {cv,w:spec.w,h:spec.h,ax:spec.ax,ay:spec.ay,pixelRatio:2};
  }
  function eye(c,x,y,P,col='#3a493c'){
    if(P.eye>=2){L(c,x-1,y,x+1,y,.65,ink);return;}
    R(c,x-1,y-1,2.2,2,cream);R(c,x,y-.5,.8,1.5,col);R(c,x,y-.5,.5,.5,'#fff9dc');
  }
  function flower(c,x,y,color){R(c,x-1.5,y-.5,3,1,color);R(c,x-.5,y-1.5,1,3,color);R(c,x-.5,y-.5,1,1,'#d5ad67');}
  function wings(c,v,flap,forest,back){
    const side=v==='E',three=v==='SE'||v==='NE';
    const cols=forest?['#456d67','#82a99a','#dce7c7']:['#777f63','#afb697','#f3dfb5'];
    const pair=(sign,far)=>{
      c.save();c.translate(three?-1:side?-2:0,-21);c.scale(sign*(side?(far?.43:.85):three?(far?.65:1):1),far?.87:1);
      const spread=.83+flap*.17;c.scale(spread,1);
      Q(c,[[0,1],[3,-7],[9,-15],[14,-17],[18,-14],[17,-8],[12,-1],[7,3],[13,4],[15,8],[11,13],[7,12],[2,6]],ink);
      Q(c,[[1,0],[4,-7],[10,-14],[14,-16],[17,-13],[16,-8],[11,-1],[6,3],[12,5],[14,8],[10,12],[7,11],[3,5]],cols[0]);
      Q(c,[[3,-1],[6,-8],[11,-13],[14,-14],[15,-11],[14,-7],[9,-1]],cols[2]);
      Q(c,[[4,4],[11,5],[12,8],[10,10],[7,9]],cols[1]);
      L(c,2,1,13,-12,.65,cols[0]);L(c,5,-3,14,-5,.65,cols[0]);L(c,3,4,11,8,.65,cols[0]);
      for(const [x,y]of [[15,-11],[12,-4],[10,8]])flower(c,x,y,forest?'#a8c9b1':'#c18a86');
      c.restore();
    };
    if(back){pair(-1,true);pair(1,false);}else if(side){pair(-1,true);pair(-1,false);}else{pair(-1,true);pair(1,false);}
  }
  function fairyPaint(c,P,kind,v,fr){
    const forest=kind==='fairy',B=layouts[v],rear=v==='N'||v==='NE',side=v==='E',three=v==='SE'||v==='NE';
    const cloth=forest?'#73958a':'#bd7b89',dark=forest?'#3e6062':'#744e67',light=forest?'#b5cbb0':'#e7a9a5';
    const hair=forest?'#c3ae76':'#aa633e',hairD=forest?'#7d7353':'#663f32',hairL=forest?'#eddaa0':'#df9b59';
    c.save();c.translate(P.x,P.y-(P.dead||P.sleep?0:7));c.rotate(P.rot);
    const flap=P.dead||P.sleep?-1:P.wing;
    if(!rear)wings(c,v,flap,forest,false);
    // Far braid and far limbs are drawn beneath the new bodice.
    Q(c,[[-4,-26],[-7,-22],[-7+P.leg*.5,-13],[-5,-11],[-4,-14],[-5,-22]],hairD);
    const feet=B.feet;
    for(let i=0;i<2;i++){
      const x=feet[i],sw=P.leg*(i?-1:1),fx=x+sw*(side?3:three?2:1),fy=-1-Math.max(0,sw)*1.5;
      L(c,x,-11,x+sw,-6,2.2,ink);L(c,x+sw,-6,fx,fy,1.8,i?skin:skinD);
      R(c,fx-1.5,fy-1,3.5,1.5,'#526e52');R(c,fx-1,fy-1,2,.5,'#a6b778');
    }
    const arm=(near)=>{
      const sx=B.shoulders[near?1:0],sy=-20,theta=near?naTheta(P):P.up>.5?-2.7:.35+P.b*.2;
      const bend=near?-.5+P.b*.6:-.4,origin=near?1:-2,l1=near?3.8:3.5,l2=near?3.6:3.4;
      const mx=origin+Math.sin(theta)*l1,my=sy+Math.cos(theta)*l1,hx=mx+Math.sin(theta+bend)*l2,hy=my+Math.cos(theta+bend)*l2;
      L(c,sx,sy,mx,my,2.4,ink);L(c,mx,my,hx,hy,2.1,ink);
      L(c,sx,sy,mx,my,1.4,near?skin:skinD);L(c,mx,my,hx,hy,1.25,near?skin:skinD);
      R(c,hx-.8,hy-.7,1.6,1.5,skin);L(c,hx+.4,hy-.5,hx+.9,hy+.8,.5,skinD);
      if(near){
        const a=theta+bend+.2,dx=Math.sin(a),dy=Math.cos(a),xx=hx+dx*7.3,yy=hy+dy*7.3;
        L(c,hx-dx*2,hy-dy*2,xx,yy,1.4,'#745439');L(c,hx,hy,xx-.4,yy,.5,'#c7ab75');flower(c,xx,yy,forest?'#d9eac5':'#f3c8bc');
        if(P.cast>.1){const col=P.dark?'#b896d2':'#eedb9b';for(let i=0;i<4;i++){const a=i*1.7+P.cast*3;R(c,xx+Math.sin(a)*4,yy+Math.cos(a)*4,1,1,col);}}
      }
    };
    arm(false);Q(c,B.body,ink);
    const inner=B.body.map(([x,y])=>[x*.78,y+1]);Q(c,inner,cloth);
    Q(c,[[-4,-20],[-1,-21],[-1,-14],[-4,-10]],dark);
    if(!rear){Q(c,[[0,-20],[2,-20],[2,-15],[0,-14]],light);L(c,-2,-20,2,-14,.7,'#c7ad77');R(c,-3,-14,6,1,'#72563d');R(c,side?1:0,-14,1,1,'#e7c785');}
    else{L(c,-2,-21,2,-11,.7,'#b9ad7c');Q(c,[[-3,-20],[2,-21],[4,-17],[1,-15],[-3,-16]],dark);L(c,-2,-19,1,-16,.5,light);}
    for(const [x,y]of [[-3,-11],[0,-10],[3,-10]]){Q(c,[[x-1,y-3],[x+1,y-4],[x+2+P.leg*.3,y],[x,y+1]],x===0?light:cloth);R(c,x,y,.7,.5,cream);}
    if(forest){
      // A woodland mantle and split willow-leaf skirt distinguish the forest
      // fairy's entire costume from the flower pixie's short petal dress.
      Q(c,[[-5,-20],[-7,-18],[-8+P.leg*.6,-10],[-5,-7],[-3,-12],[-2,-18]],dark);
      L(c,-5,-18,-6+P.leg*.6,-10,.7,light);
      Q(c,[[1,-14],[4,-13],[5+P.leg*.5,-6],[2,-8],[0,-10]],'#9ab294');
      L(c,2,-12,3+P.leg*.5,-8,.6,cream);
    }
    Q(c,[[-5,-21],[-2,-22],[1,-21],[3,-22],[5,-20],[2,-18],[-1,-20],[-4,-18]],'#597451');
    R(c,-6,-14,3,4,'#78553d');R(c,-6,-14,3,1,'#b89663');R(c,-5,-12,1,1,'#dfbe7d');
    // Distinct head surfaces: profile has a projecting nose; rear has only hair.
    c.save();c.translate(side?1:three?.5:0,-27+(P.hurt>.5?.5:0));
    Q(c,B.head,ink);Q(c,B.head.map(([x,y])=>[x*.83,y*.85]),rear?hair:skin);
    if(rear){
      Q(c,[[-4,-4],[-2,-6],[2,-5],[4,-3],[3,3],[0,4],[-3,2]],hair);
      for(const x of [-2,0,2])L(c,x,-4,x-.7,2,.7,x<0?hairL:hairD);
      Q(c,[[-3,2],[-1,3],[-2,7],[-1,10],[-3,12],[-4,9]],hairD);L(c,-2.5,4,-3,10,.8,hairL);R(c,-4,9,2,1,'#96ac74');
    }else{
      Q(c,[[-5,-4],[-3,-7],[2,-6],[4,-4],[1,-3],[-1,-5],[-3,-2],[-4,2],[-5,1]],hair);
      L(c,-3,-5,-1,-6,.8,hairL);L(c,-4,-2,-4,2,.8,hairD);
      Q(c,[[side?-3:-5,-1],[side?-6:-8,-3],[side?-4:-5,2]],skinD);
      for(const x of B.eyes)eye(c,x,-.7,P,forest?'#54746a':'#5b704b');
      if(side||three){R(c,B.nose,.3,1.7,1.2,'#f2c9a3');R(c,B.nose,1.5,1,.6,skinD);}
      const mx=side?3:three?2:0;L(c,mx-1,3,mx+1,3,.55,'#9a635b');if(P.mouth>.4)R(c,mx,2.5,1,1.5,ink);
      R(c,side?1:-3,1.5,1,.7,'#cd9281');
    }
    for(const [x,y]of [[-3,-5],[0,-6],[3,-5]])flower(c,x,y,forest?'#d9dfb5':'#edc1ad');
    if(forest){Q(c,[[-3,-6],[-4,-10],[-1,-8],[0,-11],[2,-8],[4,-9],[3,-5]],'#6f8c61');L(c,-2,-7,0,-9,.6,cream);}
    c.restore();
    if(rear)wings(c,v,flap,forest,true);
    arm(true);c.restore();
  }
  function barkPaint(c,P,v,fr){
    const rear=v==='N'||v==='NE',side=v==='E',B=layouts[v],bark='#a18056',dark='#654e3d',light='#d0af7a',moss='#7b905c',shade='#4e694d';
    c.save();c.translate(P.x,P.y);c.rotate(P.rot);c.scale(1,P.sq);
    for(let i=0;i<2;i++){const x=B.feet[i]*1.6,sw=P.leg*(i?-1:1)*2.7,fy=-1-Math.max(0,sw)*.7;
      L(c,x,-16,x+sw*.4,-8,5,dark);L(c,x+sw*.4,-8,x+sw,fy,4,bark);L(c,x+sw*.4-.5,-7,x+sw-.5,fy,1,light);
      Q(c,[[x+sw-4,fy],[x+sw-2,fy-3],[x+sw+2,fy-3],[x+sw+5,fy],[x+sw+4,fy+1]],dark);L(c,x+sw-2,fy-1,x+sw+3,fy-1,1,bark);
    }
    const arm=(near)=>{
      const sx=B.shoulders[near?1:0]*1.5,sy=-31,th=near?naTheta(P):P.up>.5?-2.7:.15-P.a*.4,bend=near?(P.up>.5?.2:-.5):.35;
      const mx=(near?5:-6)+Math.sin(th)*8,my=sy+Math.cos(th)*8,hx=mx+Math.sin(th+bend)*8,hy=my+Math.cos(th+bend)*8;
      L(c,sx,sy,mx,my,5,ink);L(c,mx,my,hx,hy,4.7,ink);L(c,sx-.5,sy,mx-.5,my,3.8,near?bark:dark);L(c,mx-.5,my,hx-.5,hy,3.2,bark);L(c,sx-1,sy,mx-1,my,.8,light);
      R(c,hx-2,hy-1.5,4,3,bark);for(let i=0;i<3;i++)L(c,hx-1+i,hy,hx-1+i,hy+2,.6,light);
      if(near){const a=th+bend+.15,dx=Math.sin(a),dy=Math.cos(a),xx=hx+dx*13,yy=hy+dy*13;L(c,hx-dx*2,hy-dy*2,xx,yy,3.5,dark);L(c,hx-.5,hy,xx-.5,yy,1,light);Q(c,[[xx-3,yy-2],[xx+2,yy-3],[xx+4,yy],[xx+2,yy+3],[xx-3,yy+2]],bark);R(c,xx-1,yy-1,2,2,dark);if(P.b)Q(c,[[hx-3,hy-4],[hx+3,hy-4],[hx+4,hy],[hx,hy+3],[hx-3,hy]],moss);}
    };
    arm(false);
    const torso=side?[[-5,-35],[2,-37],[6,-32],[5,-15],[1,-12],[-5,-15]]:v==='SE'?[[-8,-32],[-4,-36],[3,-37],[8,-33],[8,-16],[4,-12],[-5,-14]]:v==='NE'?[[-8,-32],[-2,-37],[5,-36],[8,-31],[7,-14],[-5,-13]]:[[-8,-32],[-5,-37],[5,-37],[8,-32],[7,-14],[3,-12],[-6,-14]];
    Q(c,torso,ink);Q(c,torso.map(([x,y])=>[x*.87,y+.7]),bark);Q(c,[[-7,-32],[-4,-35],[-2,-34],[-3,-15],[-6,-15]],dark);
    for(const x of [-2,2,5]){L(c,x,-32,x-1,-17,.8,dark);L(c,x+.8,-31,x,-20,.6,light);}
    if(rear){Q(c,[[-5,-32],[0,-35],[5,-32],[4,-21],[0,-18],[-4,-22]],shade);for(const [x,y]of [[-2,-30],[2,-27],[0,-23]]){R(c,x,y,2,1,moss);R(c,x+.5,y,.5,.5,light);}}
    Q(c,[[-9,-33],[-4,-36],[5,-35],[9,-31],[6,-27],[2,-30],[-1,-26],[-5,-30],[-7,-27]],shade);
    Q(c,[[-8,-33],[-4,-35],[4,-34],[7,-31],[4,-29],[0,-31],[-3,-29]],moss);
    L(c,-5,-31,4,-15,1,'#bfa375');R(c,-7,-20,5,5,dark);R(c,-7,-20,5,1.2,light);R(c,-5,-18,1,1,'#e4c58a');
    c.save();c.translate(side?1.5:v==='SE'?1:0,-43);
    const head=side?[[-5,-5],[1,-7],[5,-4],[5,0],[9,2],[5,4],[2,8],[-4,6],[-6,1]]:v==='SE'?[[-6,-4],[-2,-7],[4,-6],[7,-2],[8,1],[6,4],[2,8],[-3,6],[-6,2]]:v==='NE'?[[-6,-4],[-2,-8],[4,-6],[7,-2],[5,6],[0,8],[-5,5]]:[[-6,-4],[-3,-7],[4,-6],[7,-2],[6,5],[2,7],[-5,5]];
    for(const [x,s]of [[-4,-1],[4,1]]){L(c,x,-4,x+s*3,-12,2,dark);L(c,x+s*2,-8,x+s*5,-10,1.2,bark);Q(c,[[x+s*3,-12],[x+s*6,-14],[x+s*6,-11]],moss);}
    Q(c,head,ink);Q(c,head.map(([x,y])=>[x*.86,y*.9]),bark);L(c,-4,-4,-4,3,1,light);
    if(rear){for(const x of [-2,1,4])L(c,x,-4,x-1,5,.8,dark);Q(c,[[-6,-1],[-2,-4],[3,-3],[6,0],[4,5],[0,3],[-4,5]],shade);R(c,-1,0,2,1,moss);}
    else{Q(c,[[-5,2],[5,2],[4,7],[1+P.leg*.5,12],[-2,8],[-5,9]],moss);for(const x of B.eyes)eye(c,x+.8,0,P,'#4c6344');L(c,-2,-2,1,-2,1.2,shade);if(!side)L(c,3,-2,5,-2,1.2,shade);R(c,side?5:3,1,side?3:2.5,2,light);for(const x of [-3,0,3])L(c,x,5,x-1,8,.7,shade);}
    c.restore();R(c,-8,-32,1,3,'#d9bf8b');Q(c,[[-11,-32],[-9,-34],[-6,-34],[-4,-32]],'#ca9571');R(c,-9,-34,2,.6,'#ecd1a0');arm(true);c.restore();
  }
  const naKinds=['pixie','fairy','leshy'];
  function frame(kind,fr='i0',dir='E'){
    if(!naKinds.includes(kind))return originals.naFrame(kind,fr);
    const {mirror,key:v}=surface(dir),S=NA_SPEC[kind],P=naPose(fr),scale=kind==='leshy'?.5:(S.sc||1)*.4;
    return put(kind+'|'+dir+'|'+fr,()=>raster(S,c=>{if(mirror)c.scale(-1,1);c.scale(scale,scale);kind==='leshy'?barkPaint(c,P,v,fr):fairyPaint(c,P,kind,v,fr);},P.fade,P.hurt));
  }
  naFrame=function(kind,fr){return naKinds.includes(kind)?frame(kind,fr,active?.dir||'E'):originals.naFrame(kind,fr);};
  neuDraw=function(c,N){
    if(!naKinds.includes(N.k))return originals.neuDraw(c,N);
    const dir=direction(N,neutralTarget(N)),sp=frame(N.k,N.fr||'i0',dir),x=Math.round(N.x*TILE),y=Math.round(N.y*TILE+6),dead=N.st==='die';
    const alpha=dead?Math.max(0,Math.min(1,1-(N.dt-.9)/2.3)):1;if(!alpha)return;
    c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;R(c,x-3,y,6,1,'rgba(10,8,4,.22)');
    const bob=N.k==='fairy'&&!dead?Math.round(Math.sin(Game.time*3.2+N.id)*1.3*.4*2)/2:0;
    c.drawImage(sp.cv,x-sp.ax,y+bob-sp.ay,sp.w,sp.h);c.restore();
    if(!dead&&N.hp<N.mhp-.5){const hy=y-(N.k==='leshy'?38:Math.ceil(60*(NA_SPEC[N.k].sc||1)*.4)),r=Math.max(0,N.hp/N.mhp);R(c,x-10,hy-1,20,4,'rgba(10,6,2,.85)');R(c,x-9,hy,Math.round(18*r),2,r>.5?'#5ac04a':r>.25?'#e0b030':'#e04a3a');}
  };
  function lepPaint(c,P,v){
    const rear=v==='N'||v==='NE',side=v==='E',B=layouts[v],coat='#55794f',coatD='#344f3b',coatL='#8baa68',gold='#d7b66d',beard='#b77840';
    c.save();c.translate(P.x,-12.2+P.y);c.rotate(P.rot);c.scale(1/Math.sqrt(P.sq),P.sq);
    const toLocal=pt=>{const y=pt[1]+12.2-P.y,cs=Math.cos(-P.rot),sn=Math.sin(-P.rot);return [(pt[0]*cs-y*sn)*Math.sqrt(P.sq),(pt[0]*sn+y*cs)/P.sq];};
    const leg=(near)=>{
      const h=near?1.8:-1.8,f=toLocal(near?P.rf:P.lf),ik=lepIK(h,0,f[0],f[1]-.6,6.2,6.4,[1,.1]);
      L(c,h,0,...ik.e,4.3,ink);L(c,...ik.e,...ik.b,3.3,ink);L(c,h-.4,0,ik.e[0]-.4,ik.e[1],3,near?coat:coatD);L(c,...ik.e,...ik.b,2.2,near?cream:'#bcb7a0');
      const [x,y]=ik.b;Q(c,[[x-2,y-1],[x+2,y-1],[x+4,y+1],[x+4,y+2],[x-3,y+2]],ink);R(c,x-2,y,4,1,'#6a5947');R(c,x+1,y,1,1,gold);R(c,ik.e[0]-1,ik.e[1]-.5,2,1,gold);
    };
    const arm=near=>{
      const sh=[near?3.6:-3.4,-9.6],hand=near?P.rh:P.ep==='tug'?[P.lh[0]-1.2,P.lh[1]+1.4]:P.lh;
      let pref=P.ep==='hip'?(near?[-1,.3]:[1,.2]):P.ep==='tug'?[.2,1]:P.ep==='up'?[near?-1:1,.4]:P.ep==='cheek'?[.4,1]:[-.5,1];
      const ik=lepIK(...sh,...hand,5.4,5.6,pref);
      L(c,...sh,...ik.e,4,ink);L(c,...ik.e,...ik.b,3.8,ink);L(c,sh[0]-.4,sh[1],ik.e[0]-.4,ik.e[1],2.7,near?coatL:coatD);L(c,...ik.e,...ik.b,2.4,near?coat:coatD);
      const [x,y]=ik.b;R(c,x-1.5,y-1.2,3,2.4,cream);R(c,x-1.3,y-.7,2.6,2.3,skin);L(c,x-.5,y,x+.7,y+.5,.5,skinD);
      if(near&&P.ingot)lepIngot(c,x+(P.ingot===1?1.6:1.4),y-(P.ingot===1?.2:2.6),P.ingot===1?-.3:-.4,P.ingot===1?.9:1);
    };
    leg(false);arm(false);
    const outline=side?[[-4,-11],[3,-11],[5,-6],[4,3],[0,4],[-5,3]]:v==='SE'?[[-6,-10],[3,-12],[6,-9],[7,2],[2,4],[-6,3]]:v==='NE'?[[-6,-9],[0,-12],[5,-10],[6,3],[1,4],[-7,2]]:[[-6,-11],[5,-11],[7,2],[2,4],[-2,3],[-7,3]];
    Q(c,outline,ink);Q(c,outline.map(([x,y])=>[x*.86,y+.5]),coat);Q(c,[[-5,-9],[-3,-10],[-3,2],[-6,2]],coatD);L(c,4,-8,5,1,1,coatL);
    if(!rear){Q(c,[[-2,-10],[2,-10],[3,-2],[-3,-2]],gold);Q(c,[[-1.5,-11],[1,-11],[0,-7]],cream);for(const y of [-6,-3])R(c,side?1:0,y,.8,.8,'#83693e');Q(c,[[-5,-10],[-2,-11],[-1,-7],[-3,-5]],coatL);}
    else{L(c,0,-10,0,1,.7,coatD);Q(c,[[-4,-11],[1,-12],[5,-10],[4,-8],[0,-7],[-4,-8]],coatL);R(c,-2,-7,4,.7,gold);}
    R(c,-5.5,-2.5,11,1.5,'#544535');if(!rear){R(c,side?1:-1.5,-3,3,2.5,gold);R(c,side?2:-.5,-2.5,1,1.5,ink);}
    leg(true);
    c.save();c.translate(.6,-17.4);c.rotate(P.head);c.scale(1.14,1.14);
    const H=B.head;Q(c,H,ink);Q(c,H.map(([x,y])=>[x*.85,y*.85]),rear?'#8b673f':skin);
    if(rear){Q(c,[[-5,-3],[-2,-6],[3,-5],[5,-2],[4,4],[1,6],[-3,4]],'#8b673f');for(const x of [-2,0,2])L(c,x,-1,x-.5,4,.8,beard);}
    else{Q(c,[[-5,1],[-3,3],[0,2],[4,2],[6,4],[3,8],[-1,9],[-5,6]],'#835237');Q(c,[[-3,3],[0,4],[4,3],[4,6],[1,8],[-2,7]],beard);for(const x of [-2,0,2])L(c,x,4,x+.5,7,.65,'#d6a261');for(const x of B.eyes)eye(c,x,-1.6,P,'#5c7146');R(c,side?5:v==='SE'?4:-.5,.1,side?2:2.5,1.8,'#efc39a');if(P.cheek)R(c,side?3:2,1.5,2,1.5,'#ca8976');if(P.eye===6)R(c,3.5,0,1,2,'#9ac5d3');L(c,side?2:-1,5,side?4:1.5,5,.6,ink);}
    c.save();c.translate(0,-4.6);c.rotate(P.hat+(P.tip?-.22:0));
    Q(c,[[-7,0],[-4,-2],[5,-2],[7,0],[6,2],[-6,2]],ink);Q(c,[[-6,0],[-3,-1],[4,-1],[6,1],[-6,1]],coatD);
    Q(c,[[-4.5,0],[-3.5,-10],[3.5,-11],[4.5,0]],ink);Q(c,[[-3.5,-.5],[-2.8,-9],[2.8,-10],[3.5,-.5]],coat);L(c,-2.5,-9,2.5,-9,.8,coatL);R(c,-4,-3,8,2,'#4a3e32');
    if(!rear){R(c,side?1:-1,-3.5,2.5,2.5,gold);R(c,side?1.7:-.3,-3,1,1.5,ink);flower(c,-3,-2,'#99b878');}else L(c,-2,-3,2,-3,.8,coatL);
    c.restore();c.restore();arm(true);c.restore();
    if(P.click||P.stars)for(const [x,y]of P.stars?[[9,-30],[14,-26],[5,-35],[12,-34]]:[[-3,-3],[3,-4],[0,-6],[-5,-5],[5,-6]])flower(c,P.x+x,y,'#ebd99f');
  }
  function normalizedLep(fr){
    const m=/^m(.+)~(.+)~([\d.]+)$/.exec(fr);if(!m)return LEP_ALL.includes(fr)?fr:'i0';
    const t=+m[3],q=t===.33||t===.67?t:Math.round(Math.min(1,t)*12)/12;
    return 'm'+(LEP_ALL.includes(m[1])?m[1]:'i0')+'~'+(LEP_ALL.includes(m[2])?m[2]:'i0')+'~'+q.toFixed(4);
  }
  function lepDirectional(fr='i0',dir='E'){
    fr=normalizedLep(fr);const P=lepPose(fr),{mirror,key:v}=surface(dir);
    return put('leprechaun|'+dir+'|'+fr,()=>raster(LEP_SPEC,c=>{if(mirror)c.scale(-1,1);c.scale(LEP_SPEC.sc,LEP_SPEC.sc);lepPaint(c,P,v);},P.fade,P.hurt));
  }
  lepFrame=function(fr){return lepDirectional(fr,active?.lepDir||'E');};
  lepDraw=function(c,o){
    const target=o.st==='roam'?[o.wx,o.wy]:o.st==='go'||o.st==='duel'?[o.gx,o.gy]:null;
    const dir=direction(o,target);
    // Hands keep the native screen-space IK endpoints even for a turned
    // torso. The gold ingot and victim FX therefore retain their anchors.
    const old=active;active={lepDir:surface(dir).key};try{return originals.lepDraw(c,o);}finally{active=old;}
  };
  lepPotSprite=function(layer){
    return put('leprechaun|pot|'+(layer==='B'?'B':'F'),()=>{
      const out=raster(LEP_POT,c=>{
        if(layer==='B'){
          Q(c,[[-12,-18],[-9,-21],[9,-21],[12,-18],[10,-13],[-10,-13]],'#3b3c34');
          for(const [x,y]of [[-8,-18],[-4,-21],[1,-22],[5,-20],[9,-18],[0,-18]]){
            Q(c,[[x-2,y-1],[x+1,y-2],[x+3,y],[x+1,y+2],[x-2,y+1]],'#b9914c');R(c,x-1,y-1,2.5,1.5,'#e6c57e');R(c,x-.5,y-1,1,.5,'#f8e6aa');
          }
        }else{
          for(const s of [-1,1])Q(c,[[s*9,-5],[s*12,0],[s*8,0],[s*6,-5]],'#393c36');
          Q(c,[[-13,-17],[13,-17],[15,-12],[12,-4],[6,0],[-6,0],[-12,-4],[-15,-12]],'#333c3a');
          Q(c,[[-12,-16],[-7,-16],[-8,-3],[-11,-5],[-14,-12]],'#222e2d');
          Q(c,[[6,-16],[12,-16],[14,-11],[11,-4],[7,-2]],'#65756a');
          L(c,8,-13,9,-7,1,'#9da993');L(c,-12,-16,-8,-13,1,'#819182');L(c,-8,-13,8,-13,1,'#819182');L(c,8,-13,12,-16,1,'#819182');
          for(const s of [-1,1]){Q(c,[[s*12,-16],[s*17,-16],[s*18,-13],[s*16,-10],[s*13,-11]],'#3e4942');L(c,s*15,-15,s*16,-13,1,'#a2ac8f');}
          Q(c,[[-3,-10],[0,-12],[3,-10],[3,-6],[0,-4],[-3,-6]],'#b99b5f');flower(c,0,-8,'#e2c889');
          for(const [x,y]of [[-5,-16],[1,-17],[6,-16]]){R(c,x-1.5,y-1,3,2,'#c4a160');R(c,x-1,y-1,2,1,'#efd79b');}
        }
      });
      // Native pot caller uses natural-size drawImage; its 1x canvas contract
      // is retained rather than accidentally doubling the prop and clipping.
      const cv=document.createElement('canvas');cv.width=LEP_POT.w;cv.height=LEP_POT.h;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(out.cv,0,0,cv.width,cv.height);
      return {cv,w:LEP_POT.w,h:LEP_POT.h,ax:LEP_POT.ax,ay:LEP_POT.ay};
    });
  };
  lepDrawRainbow=function(c,x,y,face,prog,alpha){
    if(prog<=0||alpha<=0)return;
    const cols=['#c68a82','#cfa575','#dac48a','#97b17c','#84aeb5','#939fc2','#b797bc'],cx=x+face*46*.95,cy=y-6,a0=face>0?Math.PI:0,span=Math.PI*.9*Math.min(1,prog);
    c.save();c.globalAlpha=alpha*.85;
    for(let i=0;i<7;i++){const r=46-i*1.5;for(let j=0;j<=Math.ceil(span*r*2);j++){const a=a0+(face>0?1:-1)*Math.min(span,j/(r*2));R(c,Math.round((cx+Math.cos(a)*r)*2)/2,Math.round((cy+Math.sin(a)*r)*2)/2,1.5,1.5,cols[i]);}}
    c.globalAlpha=alpha*.7;const ea=a0+(face>0?span:-span);for(let j=0;j<4;j++)R(c,Math.round(cx+Math.cos(ea)*(41-j*2.6)),Math.round(cy+Math.sin(ea)*(41-j*2.6)),1,1,'#f7e6be');c.restore();
  };
  function browniePaint(c,v){
    const rear=v==='N'||v==='NE',side=v==='E',B=layouts[v];
    c.save();c.translate(0,-2);c.scale(.9,.9);
    const feet=side?[-1,1]:[-4,4];
    for(const x of feet){L(c,x,-11,x,-2,4,ink);L(c,x,-10,x,-3,2.6,'#765941');Q(c,[[x-3,-3],[x+2,-3],[x+4,-1],[x+3,1],[x-3,1]],'#b39a65');for(const yy of [-2,-.5])L(c,x-2,yy,x+2,yy,.6,'#796745');}
    const arm=near=>{const x=B.shoulders[near?1:0]*1.4;L(c,x,-22,x+(near?2:-2),-14,4.7,ink);L(c,x-.3,-22,x+(near?1.7:-2.3),-14,3.2,near?'#91a6ba':'#61798e');R(c,x+(near?.7:-3.3),-14,2.5,3,skin);};
    arm(false);const torso=side?[[-4,-24],[3,-24],[5,-19],[4,-9],[-5,-9]]:v==='SE'?[[-7,-23],[2,-25],[7,-22],[7,-10],[-6,-9]]:v==='NE'?[[-6,-22],[0,-25],[7,-23],[6,-9],[-7,-10]]:[[-7,-23],[-4,-25],[4,-25],[7,-23],[7,-9],[-7,-9]];
    Q(c,torso,ink);Q(c,torso.map(([x,y])=>[x*.85,y+.5]),'#8197ab');Q(c,[[-6,-22],[-3,-23],[-3,-10],[-6,-10]],'#536d84');R(c,-6,-12,12,2,'#a05f4f');
    if(!rear){Q(c,[[-2,-24],[1,-24],[0,-20]],cream);R(c,1,-19,4,4,'#b7a16c');L(c,1,-17,5,-17,.6,'#796745');for(const yy of [-18,-16])R(c,-1,yy,.7,.7,'#e5c68d');}
    else{L(c,-1,-23,-1,-13,.8,'#607d93');R(c,1,-18,3,3,'#b7a16c');L(c,1,-17,4,-17,.5,'#796745');}
    c.save();c.translate(side?1:0,-29);c.scale(1.25,1.1);
    Q(c,B.head,ink);Q(c,B.head.map(([x,y])=>[x*.85,y*.85]),rear?'#855b3f':skin);
    if(!rear){Q(c,[[-5,1],[-1,3],[4,1],[5,4],[2,8],[-3,7],[-6,4]],'#8b5c3e');for(const x of [-3,0,3])L(c,x,3,x-.5,6,.8,'#bd9257');for(const x of B.eyes)eye(c,x,-1,P_BROWNIE,'#746a44');R(c,side?5:v==='SE'?4:-1,.5,2.5,2,'#e1ad82');}
    Q(c,[[-5,-3],[-4,-6],[-2,-7],[0,-5],[2,-7],[4,-5],[5,-3],[2,-2],[0,-4],[-3,-1]],'#895d3e');L(c,-3,-5,-2,-6,1,'#c49b60');
    for(const [x,y]of [[-4,-5],[-1,-6],[2,-5]])Q(c,[[x,y],[x-1,y-4],[x+2,y-1]],'#a77c49');
    if(rear)for(const x of [-2,0,2])L(c,x,-3,x+.5,3,.7,'#a77c49');c.restore();arm(true);c.restore();
  }
  const P_BROWNIE={eye:0};
  function brownieFrame(dir='S'){
    const {mirror,key:v}=surface(dir);return put('brownie|'+dir,()=>raster({w:30,h:40,ax:15,ay:40},c=>{if(mirror)c.scale(-1,1);browniePaint(c,v);}));
  }
  sprBrownie=function(){return brownieFrame('S').cv;};
  // Brownie has one native static body, not an invented walk/combat cycle.
  // Native apparition alpha, independent eye blink and bowl stay untouched.
  function enderPaint(c,carry,v){
    const rear=v==='N'||v==='NE',side=v==='E',near='#433a50',shade='#292333',hi='#726078';
    c.save();c.translate(-3.5,0);
    const tx=carry?15.5:0; // native trunk x=50, sprite anchor x=38
    const cargo=()=>{
      L(c,tx,-18,tx,-56,7,'#544330');L(c,tx-1,-18,tx-1,-56,3,'#9b8050');
      for(const [x,y,w,h]of [[tx-19,-62,17,17],[tx+2,-61,18,16],[tx-13,-78,25,23],[tx-9,-86,18,15]]){
        Q(c,[[x+3,y],[x+w-3,y],[x+w,y+4],[x+w,y+h-3],[x+w-4,y+h],[x+3,y+h],[x,y+h-4],[x,y+4]],'#3d6349');
        Q(c,[[x+3,y+1],[x+w-4,y+1],[x+w-1,y+5],[x+w-5,y+8],[x+2,y+6]],'#7e9b5b');R(c,x+3,y+2,3,1,'#b1be78');R(c,x+w-6,y+6,2,1,'#92ac68');
      }
      L(c,tx,-39,tx-9,-52,2,'#6e5639');L(c,tx,-40,tx+9,-53,2,'#6e5639');
      Q(c,[[tx-8,-20],[tx-5,-24],[tx+5,-24],[tx+9,-20],[tx+7,-16],[tx-6,-16]],'#5d4933');
      for(const [x,dx]of [[tx-3,-7],[tx+3,7],[tx,1]]){L(c,x,-18,x+dx,-11,2,'#695237');L(c,x,-17,x+dx,-12,.7,'#b19761');}
    };
    // Far arm, then cargo, then body, then near grasp: no floating load.
    if(carry&&!rear)cargo();
    for(const x of side?[-1,1]:[-2.7,2.7]){L(c,x,-25,x+(x<0?-1:1),-3,3.5,ink);L(c,x-.3,-24,x+(x<0?-1.3:.7),-3,2,near);R(c,x-2,-2,4,1.5,shade);R(c,x-1.5,-2,2,.5,hi);}
    const arm=nearArm=>{
      const x=side?(nearArm?2:-1):nearArm?5:-5;
      const hx=carry?tx:(nearArm?10:-10),hy=carry?(nearArm?-36:-42):-22;
      L(c,x,-44,hx,hy,3.2,ink);L(c,x-.2,-44,hx-.2,hy,1.8,nearArm?near:shade);R(c,hx-1.2,hy-1.2,2.4,2.4,near);L(c,hx-.6,hy,hx+1,hy,.6,hi);
    };
    arm(false);
    const torso=side?[[-3,-46],[2,-46],[4,-40],[2,-25],[-3,-25]]:v==='SE'?[[-5,-44],[2,-46],[5,-42],[4,-25],[-4,-25]]:v==='NE'?[[-5,-42],[0,-46],[5,-44],[4,-25],[-4,-25]]:[[-5,-45],[5,-45],[4,-25],[-4,-25]];
    Q(c,torso,ink);Q(c,torso.map(([x,y])=>[x*.77,y+.5]),shade);L(c,-3,-43,-2,-27,1,near);if(rear)L(c,1,-43,1,-27,.7,hi);
    const head=side?[[-5,-58],[3,-58],[5,-56],[5,-49],[2,-47],[-5,-48]]:v==='SE'?[[-6,-56],[0,-59],[6,-57],[6,-49],[0,-47],[-6,-49]]:v==='NE'?[[-6,-57],[0,-59],[6,-56],[6,-49],[0,-47],[-6,-49]]:[[-6,-58],[6,-58],[6,-48],[-6,-48]];
    Q(c,head,ink);Q(c,head.map(([x,y])=>[x*.84,y+.5]),near);L(c,-4,-57,side?2:4,-57,1,hi);
    if(!rear){const xs=side?[2.5]:v==='SE'?[-.5,3]:[-3,2];for(const x of xs){R(c,x-1,-53,2.5,1.5,'#b889bb');R(c,x-.5,-53,1,1,'#e3cee0');}}
    else{L(c,-3,-55,-3,-50,.6,shade);L(c,2,-55,2,-50,.6,shade);}
    if(carry&&rear)cargo();arm(true);c.restore();
  }
  function enderFrame(carry=0,dir='E'){
    const {mirror,key:v}=surface(dir),spec=carry?{w:76,h:100,ax:38,ay:100}:{w:40,h:62,ax:20,ay:62};
    return put('enderman|'+carry+'|'+dir,()=>raster(spec,c=>{if(mirror)c.scale(-1,1);enderPaint(c,carry,v);}));
  }
  sprEnder=function(carry){return enderFrame(carry,active?.enderDir||'E').cv;};
  endermanDraw=function(list,c,F,...bounds){
    const local=[];originals.endermanDraw(local,c,F,...bounds);
    for(const [z,draw]of local)list.push([z,()=>{const e=F.end;if(!e)return;const target=e.st==='carry'?e.dest:e.st==='goto'?e.tg:e.go,dir=direction(e,target),canonical=surface(dir).key;const old=active;active={enderDir:canonical};try{draw();}finally{active=old;}}]);
  };
  function stonePaint(c,style,phase,v,eyeLevel){
    const B=layouts[v],rear=v==='N'||v==='NE',side=v==='E',s='#7e7b70',d='#53574f',h='#b7ae95',black='#343b37';
    const flap=phase/7,headX=style==='B'?4.4:0,headY=style==='B'?-6:style==='C'?-10.6:-11.6;
    const wing=(near)=>{
      c.save();c.translate(style==='B'?-5:near?2.4:-2.4,style==='B'||style==='C'?-6:-7.4);
      const sign=side?-1:near?1:-1;c.scale(sign*(side?(near?.86:.55):v==='SE'||v==='NE'?(near?1:.65):1)*(style==='C'?1.12:1),style==='B'?.75:1);
      const lift=flap*5;Q(c,[[0,0],[2,-7-lift],[7,-12-lift],[13,-11-lift],[12,-8],[15,-5],[11,-4],[13,-1],[8,-2],[6,1]],black);
      Q(c,[[1,0],[3,-7-lift],[7,-11-lift],[12,-10-lift],[10,-7],[13,-5],[10,-3],[11,-2],[7,-3],[5,0]],d);
      Q(c,[[1,-1],[3,-7-lift],[7,-11-lift],[11,-10-lift],[7,-8-lift],[4,-4]],s);
      for(const [x,y]of [[12,-10-lift],[13,-5],[11,-2]])L(c,3,-7-lift,x,y,.6,black);
      L(c,1,-1,3,-7-lift,.7,h);L(c,3,-7-lift,7,-11-lift,.7,h);R(c,11,-11-lift,1,1,h);c.restore();
    };
    wing(false);if(!rear)wing(true);
    Q(c,style==='B'?[[-7,-8],[-4,-10],[2,-9],[5,-5],[2,0],[-6,0]]:style==='C'?[[-3,0],[-4,-4],[-2.5,-7.6],[2.5,-7.6],[4,-4],[3,0]]:[[-4,0],[-5,-4],[-3,-8.5],[3,-8.5],[5,-4],[4,0]],black);
    Q(c,style==='B'?[[-6,-7],[-3,-9],[2,-8],[4,-5],[1,-1],[-5,-1]]:style==='C'?[[-2.5,-.5],[-3,-4],[-2,-7],[2,-7],[3,-4],[2.5,-.5]]:[[-3,0],[-4,-4],[-2,-8],[2,-8],[4,-4],[3,0]],s);
    Q(c,[[-4,-4],[-2,-8],[0,-8],[-1,-2],[-2,0],[-3,0]],d);
    if(!rear){for(const y of [-5,-3])L(c,-1.5,y,2,y+.5,.6,d);}else L(c,0,-7,0,-1,.8,h);
    for(const sign of [-1,1]){
      const x=style==='B'?sign*2:sign*3.8;L(c,x,-5,x,-.5,2.5,black);L(c,x-.3,-4,x-.3,0,1.7,s);R(c,x-1,0,2,1,s);for(const dx of [-.7,0,.7])R(c,x+dx,1,.5,1,black);
    }
    c.save();c.translate(headX,headY);const H=side?[[-3,-4],[1,-4],[3,-2],[5,1],[3,3],[-1,4],[-4,2]]:v==='SE'?[[-4,-2],[-1,-4],[3,-3],[5,0],[4,3],[1,4],[-3,2]]:v==='NE'?[[-4,-3],[0,-4],[4,-2],[4,2],[1,4],[-3,3]]:[[-4,-1],[-3,-4],[3,-4],[4,-1],[3,2],[1.5,4],[-1.5,4],[-3,2]];
    for(const sign of [-1,1]){Q(c,[[sign*2,-3],[sign*5,-7],[sign*5,-9],[sign*3,-7],[sign*1,-4]],black);L(c,sign*2,-4,sign*4,-7,.8,h);Q(c,[[sign*3,-2],[sign*7,-3],[sign*4,0]],d);}
    Q(c,H,black);Q(c,H.map(([x,y])=>[x*.8,y*.9]),s);L(c,-2,-3,0,-3,1,h);
    if(rear){for(const x of [-1.5,1.5])L(c,x,-2,x,2,.65,d);}
    else{
      const xs=side?[1.8]:v==='SE'?[-.1,2.5]:[-1.8,1.8];for(const x of xs){R(c,x-.9,-1.2,1.8,1.4,black);if(eyeLevel)R(c,x-.5,-.8,1,.8,eyeLevel>=3?'#ebc47b':'#a58d5b');L(c,x-1.1,-2,x+1,-2,.8,d);}
      const mx=side?1.5:v==='SE'?1:0;R(c,mx-2,1.8,4,1,black);for(const x of [mx-1.5,mx+1.5])Q(c,[[x-.5,2],[x+.5,2],[x,4.5]],h);
      R(c,side?3:1,0,1,1,h);
    }c.restore();
    if(rear)wing(true);
    // Moss and repaired stone seams remain on the correct rear surfaces.
    R(c,-3,-7,1.5,1,'#788365');L(c,2,-6,2.5,-3,.5,d);R(c,2,-4,1,.5,h);
  }
  function garFrame(style='A',phase=0,dir='S',eyeLevel=4){
    phase=Math.max(0,Math.min(7,Math.round(phase)));eyeLevel=Math.max(0,Math.min(4,Math.round(eyeLevel)));
    const {mirror,key:v}=surface(dir);return put('gargoyle|'+style+'|'+dir+'|'+phase+'|'+eyeLevel,()=>raster({w:64,h:64,ax:32,ay:54},c=>{if(mirror)c.scale(-1,1);stonePaint(c,style,phase,v,eyeLevel);}));
  }
  function garRender(c,bx,by,lit,ph,style){
    const t=Game.time,k=garEyeK(),turn=Math.sin(t*(style==='B'?.5:style==='C'?.4:.45)+ph)*(style==='B'?.3+.7*k:style==='C'?.4+.6*k:.35+.65*k);
    const flap=style==='C'?(Math.sin(t*1.1+ph)*.5+.5)*(.25+.75*k):Math.max(0,Math.sin(t*(style==='B'?.8:.9)+ph))**6*k;
    // Fixed street statues have no locomotion. Native head turns select their
    // near-forward surfaces; other views are supplied for the complete model.
    // B is an architectural cantilever pointing right: its chain stays at
    // the native mouth position while the head looks toward/away from us.
    const dir=style==='B'?(turn<-.22?'NE':turn>.22?'SE':'E'):Math.abs(turn)<.22?'S':turn<0?'SW':'SE';
    const frame=garFrame(style,Math.round(flap*7),dir,Math.round(k*4));
    let ox=bx,oy=by-25;
    if(style==='A'){
      R(c,bx-2.2,by-22,4.4,17,'#6e685e');R(c,bx-2.2,by-22,1.2,17,'#9a9488');R(c,bx+1.2,by-22,1,17,'#3e3a34');R(c,bx-4.4,by-25,8.8,2.4,'#5a554e');R(c,bx-4.4,by-25,8.8,.8,'#8e887c');
    }else if(style==='B'){
      R(c,bx-2.4,by-24,4.8,19,'#6e685e');R(c,bx-2.4,by-24,1.2,19,'#9a9488');R(c,bx+1.4,by-24,1,19,'#3e3a34');R(c,bx-3.6,by-26.6,7.2,2.6,'#5a554e');ox=bx+7;oy=by-18.4;
    }else{
      R(c,bx-.9,by-30,1.8,25,IRON[1]);R(c,bx-.9,by-30,.6,25,IRON[2]);for(const yy of [-10,-17,-24])R(c,bx-2,by+yy,4,1.2,IRON[0]);
      lampCage(c,bx,by-30,5.6,9,lit,Math.round(Math.sin(t*6+ph)*18));if(lit)glow(c,bx,by-35,17,'255,196,100',.26+.06*Math.sin(t*5+ph));oy=by-46.4;
    }
    c.save();c.imageSmoothingEnabled=false;c.drawImage(frame.cv,ox-frame.ax,oy-frame.ay,frame.w,frame.h);c.restore();
    if(style==='A'){L(c,bx+4.4,by-23.6,bx+5.6,by-18.4,.6,IRON[0]);lampCage(c,bx+5.6,by-11,4.4,7,lit,Math.round(Math.sin(t*6+ph)*18));if(lit)glow(c,bx+5.6,by-16,16,'255,196,100',.26+.06*Math.sin(t*5+ph));}
    if(style==='B'){L(c,bx+11.4+turn*.5,by-19.4,bx+11.4,by-15.4,.6,IRON[0]);lampCage(c,bx+11.4,by-8,4.6,7.4,lit,Math.round(Math.sin(t*6+ph)*18));if(lit)glow(c,bx+11.4,by-13,16,'255,196,100',.26+.06*Math.sin(t*5+ph));}
  }
  garA=(c,x,y,l,p)=>garRender(c,x,y,l,p,'A');garB=(c,x,y,l,p)=>garRender(c,x,y,l,p,'B');garC=(c,x,y,l,p)=>garRender(c,x,y,l,p,'C');
  Object.assign(api,{headings,frame,lepFrame:lepDirectional,brownieFrame,enderFrame,garFrame,originals,direction,limits:{entries:MAX_ENTRIES,rgba:MAX_RGBA},stats:()=>({entries:cache.size,rgba,hits,misses}),clear:()=>{cache.clear();rgba=0;}});
  api.ready=true;
})();
