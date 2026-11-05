/* Bark-and-moss forest guardian. Art only; original neutral AI and poses. */
'use strict';
(() => {
  if(window.FantasyLeshyPolish)return;
  const oldFrame=naFrame,oldDraw=neuDraw,cache=new Map(),before=new Map();
  NA_ALL.forEach(f=>before.set(f,oldFrame('leshy',f)));
  const scale=.5;
  function paint(c,P,f){
    const ink='#453c31',bark=naK(P,'#a47a4e'),dark=naK(P,'#6c523c'),light=naK(P,'#d3ad74');
    const moss=naK(P,'#80945c'),shadeMoss=naK(P,'#52694b'),leaf=naK(P,'#afbb78');
    const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
    const shape=(pts,col)=>poly(c,pts,col,ink,.6);
    const limb=(x,y,xx,yy,w,col)=>naLimb(c,x,y,xx,yy,w,col);
    c.save();c.translate(P.x,P.y);c.rotate(P.rot);c.scale(1,P.sq);
    const sw=P.leg*2.7;
    for(const [x,d] of [[-4,1],[4,-1]]){
      const lift=f[0]==='w'?Math.max(0,P.leg*d)*2.2:0;
      const knee=x+sw*d*.5-1,foot=x+sw*d;
      limb(x,-15,knee,-8-lift*.5,5.5,d===1?dark:bark);
      limb(knee,-8-lift*.5,foot,-2-lift,4.6,d===1?dark:bark);
      shape([[foot-3,-3-lift],[foot+2,-4-lift],[foot+5,-1-lift],[foot+4,-lift],[foot-4,-lift]],bark);
      limb(knee-.7,-7-lift*.5,foot,-2-lift,.8,light);
      ellipse(c,knee,-8-lift*.5,1.4,1.1,dark);
    }
    naArm(c,-6,-30,8,7,P.up>.5?-2.7:P.b?-1.1:.15-P.a*.4,P.b?1.7:.35,4,dark);
    shape([[-8,-32],[-5,-37],[5,-37],[8,-32],[7,-14],[3,-12],[-6,-14]],bark);
    shape([[-8,-32],[-5,-37],[-2,-36],[-3,-15],[-6,-14]],dark);
    for(const [x,y,len] of [[-1,-33,13],[3,-31,12],[5,-25,8]]){
      limb(x,y,x-1,y+len,.9,dark);limb(x+1,y+1,x,y+len-1,.6,light);
    }
    ellipse(c,2,-22,2.2,1.6,dark);ellipse(c,2,-22,1.1,.9,bark);
    const flutter=P.wing*.2+P.leg*.65;
    shape([[-9,-33],[-5,-36],[5,-35],[10,-31],[7,-27],[4,-29],[1+flutter,-25],[-3,-29],[-7,-27]],shadeMoss);
    shape([[-8,-33],[-4,-35],[4,-34],[8,-31],[5,-29],[2,-31],[-1,-28],[-4,-31]],moss);
    for(const [x,y] of [[-6,-32],[-1,-31],[4,-32]])rect(x,y,2,1,leaf);
    limb(-6,-31,4,-15,1,'#c5ad78');rect(-6,-18,5,5,dark);rect(-6,-18,5,2,light);rect(-4,-16,1,1,'#e3ca8d');
    const yy=-43+(P.hurt>.5?1:0),hx=1+(P.a>.5?1:0);
    // Small budding branches; reduced crown on the falling silhouette.
    const bud=f[0]==='d'?.6:1;
    for(const [x,dir] of [[hx-4,-1],[hx+4,1]]){
      c.save();c.translate(P.leg*dir*.35,0);
      limb(x,yy-4,x+dir*3*bud,yy-12*bud,2,dark);
      limb(x+dir*2,yy-8*bud,x+dir*5*bud,yy-10*bud,1.2,bark);
      shape([[x+dir*3*bud,yy-12*bud],[x+dir*6*bud,yy-14*bud],[x+dir*6*bud,yy-11*bud]],moss);
      c.restore();
    }
    shape([[hx-6,yy-4],[hx-3,yy-7],[hx+4,yy-6],[hx+7,yy-2],[hx+6,yy+5],[hx+2,yy+7],[hx-5,yy+5]],bark);
    shape([[hx-6,yy-4],[hx-3,yy-7],[hx-2,yy+5],[hx-5,yy+5]],dark);
    limb(hx-1,yy-5,hx-1,yy-2,.9,light);rect(hx+2,yy-4,2,1,light);
    shape([[hx-6,yy+2],[hx+5,yy+2],[hx+4,yy+7],[hx+1+flutter,yy+12], [hx-2,yy+8],[hx-5,yy+9]],moss);
    limb(hx-3,yy+4,hx-2+flutter,yy+8,1,shadeMoss);limb(hx+1,yy+4,hx+1+flutter,yy+9,.8,leaf);
    for(const x of [hx-1.5,hx+3.6]){
      if(P.eye>=2)naEye(c,x,yy,P,ink,.9);
      else{rect(x-1,yy-1,2.4,2.2,'#eee0b2');rect(x,yy-.6,.9,1.8,'#394836');rect(x,yy-.6,.5,.5,'#fff6d8');}
      limb(x-1.5,yy-2,x+1.5,yy-2+(P.eye===1?.8:0),1.2,shadeMoss);
    }
    shape([[hx+2,yy+1],[hx+6,yy+1],[hx+7,yy+3],[hx+3,yy+3]],light);
    if(P.mouth>.4)rect(hx+2,yy+4,2,P.mouth*1.5,dark);
    // Shelf mushrooms, berries and a vine wrist tie give readable small accents.
    rect(-8,-31,1.3,3,'#d4bf89');ellipse(c,-8,-31,3.2,1.2,'#cf9670');rect(-9,-32,2,.6,'#f2d1a0');
    rect(5,-33,1.1,1.2,'#cf9764');rect(7,-31,1.1,1.2,'#d4b178');
    const [x,y,a]=naArm(c,5,-31,8,8,naTheta(P),P.up>.5?.2:-.5,4,bark);
    ellipse(c,x,y,2.2,2.2,light);limb(x-1,y-2,x+1,y,1,moss);
    const [dx,dy]=naDir(a+.15),ex=x+dx*13,ey=y+dy*13;
    limb(x-dx*2,y-dy*2,ex,ey,3.5,dark);limb(x-dx*2-.5,y-dy*2,ex-.5,ey,.8,light);
    ellipse(c,ex,ey,3.5,2.8,bark);ellipse(c,ex,ey,2,1.6,light);ellipse(c,ex,ey,.8,.7,dark);
    if(P.b){
      // A bark guard and rebounding leaf chips make the .28 s parry readable
      // at the approved size, using the existing parry pose and timer.
      shape([[x-3,y-3],[x+2,y-4],[x+4,y],[x+1,y+3],[x-2,y+2]],dark);
      limb(x-2,y-2,x+1,y+1,.8,light);
      for(const [ox,oy] of [[5,-4],[7,-1],[5,3]])shape([[x+ox,y+oy],[x+ox+1,y+oy-1],[x+ox+2,y+oy]],leaf);
    }
    if(f==='strike'){c.strokeStyle=leaf;c.lineWidth=.8;c.beginPath();c.arc(x,y,14,a-1.3,a-.2);c.stroke();}
    if(P.mouth>.7)for(let i=0;i<3;i++)rect(hx+10+i*2,yy-1-i*2,1,1,leaf);
    c.restore();
  }
  NA_DRAW.leshy=paint;
  naFrame=function(kind,f){
    if(kind!=='leshy')return oldFrame(kind,f);
    if(cache.has(f))return cache.get(f);
    const S=NA_SPEC.leshy,cv=mkCanvas(S.w*2,S.h*2),c=cv.getContext('2d');
    c.scale(2,2);c.imageSmoothingEnabled=false;c.lineCap='round';c.lineJoin='round';
    c.translate(S.ax,S.ay);c.scale(scale,scale);const P=naPose(f);paint(c,P,f);
    if(P.fade){
      const img=c.getImageData(0,0,cv.width,cv.height);
      for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
        const o=(y*cv.width+x)*4;if(!img.data[o+3])continue;
        if(naHash(x>>1,y>>1)<P.fade)img.data[o+3]=0;
        else for(let j=0;j<3;j++)img.data[o+j]+=([230,240,200][j]-img.data[o+j])*P.fade*.4;
      }
      c.putImageData(img,0,0);
    }
    const out={cv,ax:S.ax,ay:S.ay,w:S.w,h:S.h,pixelRatio:2};cache.set(f,out);return out;
  };
  neuDraw=function(c,N){
    if(N.k!=='leshy')return oldDraw(c,N);
    const sp=naFrame(N.k,N.fr||'i0'),x=Math.round(N.x*TILE),y=Math.round(N.y*TILE+6),dead=N.st==='die';
    const alpha=dead?Math.max(0,Math.min(1,1-(N.dt-.9)/2.3)):1;if(!alpha)return;
    c.save();c.globalAlpha=alpha;if(typeof R!=='undefined')c.imageSmoothingEnabled=R.smooth;
    c.fillStyle='rgba(10,8,4,.3)';c.beginPath();c.ellipse(x,y+1,5,1.7,0,0,7);c.fill();
    c.translate(x,y);if(N.face<0)c.scale(-1,1);c.drawImage(sp.cv,-sp.ax,-sp.ay,sp.w,sp.h);c.restore();
    if(!dead&&N.hp<N.mhp-.5){const ratio=Math.max(0,N.hp/N.mhp);c.fillStyle='rgba(10,6,2,.85)';c.fillRect(x-10,y-38,20,4);c.fillStyle=ratio>.5?'#5ac04a':ratio>.25?'#e0b030':'#e04a3a';c.fillRect(x-9,y-37,Math.round(18*ratio),2);}
  };
  window.FantasyLeshyPolish={frames:NA_ALL.slice(),pixelRatio:2,modelScale:scale,before:f=>before.get(f),after:f=>naFrame('leshy',f)};
  if(new URLSearchParams(location.search).get('graphics')==='1'&&new URLSearchParams(location.search).get('leshy')==='1'){
    const oldList=drawSkeletons;let start=null;
    drawSkeletons=function(list,c,...bounds){
      oldList(list,c,...bounds);if(!Game.fantasyGallery)return;
      const b=Game.buildings.find(b=>b.type==='inn');if(!b)return;
      if(start===null){start=Game.time;R.cam.z=3;centerOn((b.x+b.w/2)*TILE,(b.y+b.h)*TILE);}
      const t=(Game.time-start)%14,moving=t<5||t>=9;
      const state=moving?'walk':t<7?'idle':'win',seq=NA_FRAMES[state];
      const progress=t<5?t/5:t<9?1:1-(t-9)/5;
      const N={k:'leshy',id:94001,x:b.x+.3+progress*3.6,y:b.doorY+1,face:t>=9?-1:1,st:state,fr:seq[Math.floor((Game.time-start)*(moving?9:5))%seq.length],hp:82,mhp:82};
      list.push([N.y+.2,()=>neuDraw(c,N)]);
    };
  }
})();
