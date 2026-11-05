/* OldGold 0.11.99 presentation only. Load after skelart/ghostpx/reaperpx.
 * Batch 1: all four skeleton appearances; native selectors, timing, grip,
 * views, clipping, death lifecycle and victim drawing remain in skelDraw. */
'use strict';
(() => {
  if(window.FantasyUndeadPolish)return;
  const original=skelSprite,cache=new Map(),last=new WeakMap();
  const ratio=2,TAU=Math.PI*2;
  function paint(c,look,view,pose,f){
    const P=skelParams(pose,f),side=view==='E',back=view==='N';
    const ink='#493b33',bone=P.flash?'#fff3da':'#dfcfaa',shade='#b29e7c',hi='#f7e7bf';
    const rust='#9f6948',steel='#8b9182',wood='#8a6741',cap=look&1?'#c19b43':'#a44f3c';
    const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
    const polyline=(pts,col,w=.65)=>poly(c,pts,col,ink,w);
    const line=(x,y,xx,yy,w,col)=>naLimb(c,x,y,xx,yy,w,col);
    const joint=(x,y,r=1)=>{ellipse(c,x,y,r+.35,r+.35,ink);ellipse(c,x-.1,y-.1,r,r,bone);};
    const limb=(x,y,xx,yy,w=1.65)=>{line(x,y,xx,yy,w+.7,ink);line(x,y,xx,yy,w,bone);line(x-.3,y,xx-.3,yy,.4,hi);joint(x,y,w*.48);joint(xx,yy,w*.45);};
    function hat(x,y,angle=0){
      c.save();c.translate(x,y);c.rotate(angle);
      polyline([[-5,0],[-5,-4],[-3,-8],[1,-11],[5,-10],[7,-7],[4,-8],[5,-4],[5,0]],cap);
      polyline([[-4,-4],[-3,-8],[0,-10],[0,-5]],look&1?'#ddbd66':'#cc7350',.3);
      polyline([[1,-9],[4,-9],[6,-7],[3,-7],[4,-3],[1,-3]],look&1?'#886829':'#713d32',.3);
      rect(-5,-2,10,2,'#684b39');rect(-4,-2,8,.6,'#d0ae75');
      rect(1,-6,2,2,'#66533e');line(1,-6,3,-4,.4,'#d1b383');
      rect(-2,-7,1,1,'#e0bb76');line(-3,-4,-2,-7,.45,look&1?'#f0d28a':'#e49b6e');
      for(const x of [-3,0,3])rect(x,-1.6,.5,.5,hi);c.restore();
    }
    function sword(x,y,a){
      c.save();c.translate(x+Math.cos(a)*3.7,y+Math.sin(a)*3.7);c.rotate(a);
      // The native atlas has a tight weapon margin in the lunge. Keep the
      // hand/grip path exact and fit the chipped tip inside that same atlas.
      const m=c.getTransform();let length=17;
      for(const [v,origin,size] of [[m.a,m.e,c.canvas.width],[m.b,m.f,c.canvas.height]]){
        if(v>1e-5)length=Math.min(length,(size-5-origin)/v);
        if(v< -1e-5)length=Math.min(length,(5-origin)/v);
      }
      length=Math.max(7,length);
      polyline([[-1,-1.4],[length-2,-1.6],[length,0],[length-2,1.5],[-1,1.3]],steel,.6);
      line(0,-.9,length-3,-1,.65,'#d8d4b4');rect(3,0,1.6,1,rust);rect(length-5,-1,1.2,1.3,rust);
      rect(length*.4,-1.5,1.2,.8,ink);rect(-3,-2.7,2,5.4,rust);rect(-5,-.9,2.5,1.8,wood);ellipse(c,-5.6,0,1.1,1.1,steel);
      c.restore();joint(x,y,1.1);
    }
    function shield(x,y,edge=false){
      c.save();c.translate(x,y);if(edge)c.scale(.48,1);
      ellipse(c,0,0,5.2,5.5,ink);ellipse(c,0,0,4.7,5,steel);ellipse(c,0,0,3.9,4.2,wood);
      line(-1.4,-3.7,-1.4,3.7,.55,'#624d36');line(1.2,-3.7,1.2,3.7,.55,'#624d36');
      rect(-3,-2.6,1.3,.8,rust);rect(2.2,2,1,1,rust);ellipse(c,0,0,1.3,1.3,'#c9bea0');
      for(const [x1,y1] of [[0,-4],[4,0],[0,4],[-4,0]])rect(x1-.3,y1-.3,.6,.6,'#ead9ae');c.restore();
    }
    if(pose==='die'&&f>=4){
      const p=(f-4)/7;
      for(let i=0;i<10;i++){
        const x=Math.sin(i*4.7)*(3+i*.85)*(1+p*.12),y=-1.3-Math.abs(Math.cos(i*2.3))*2*(1-p);
        c.save();c.translate(x,y);c.rotate(i*.9+p*.08);limb(-2.2,0,2.2,0,1.4);c.restore();
      }
      polyline([[-3,-5],[0,-6.5],[3,-5.2],[3,-2.2],[-2,-1.7]],bone);
      rect(-1.7,-4.7,1.3,1.3,ink);rect(.8,-4.5,1.1,1.2,ink);hat(-6,-2,-.24-p*.08);
      if(look&2)shield(7,-2,true);sword(10,-1,.12);return;
    }
    c.save();c.translate(P.adv+P.shake,0);
    const hip=-12.5+P.sink,dy=P.bob+P.sink;
    for(const sign of back?[1,-1]:[-1,1]){
      const ph=P.mv?P.sw*sign:0,sl=P.mv?Math.max(0,P.cw*sign):0,lift=Math.max(0,ph)+sl*.8;
      let knee=side?sign*1.8+ph*2.4:sign*2.4+sign*P.sink*.35;
      const foot=side?sign*2.4+ph*3.6:sign*2.8;
      const fy=side?Math.max(-.5,-Math.max(0,-ph)*2.4)-sl*1.2:-lift*2.6;
      const ky=side?-7.4-Math.abs(ph)*.8-sl*1.2+P.sink*.5:(hip+fy)/2-lift*1.4;
      if(side)knee+=P.sink*.45;limb(sign*1.4,hip,knee,ky,1.8);limb(knee,ky,foot,fy,1.5);joint(knee,ky,1.15);
      limb(foot,fy,foot+(side?2.8:1.2),fy,1.45);
    }
    c.save();c.translate(0,dy);const lean=P.lean,sx=lean*.5;
    polyline([[-4,hip-dy-1],[0,hip-dy-2],[4,hip-dy-1],[3,hip-dy+1],[-3,hip-dy+1]],shade);
    limb(0,hip-dy,sx,-22,1.4);
    for(let i=0;i<3;i++){
      const yy=-15.5-i*2.4,w=(side?4.1:4.8)-i*.3;
      c.strokeStyle=ink;c.lineWidth=1.8;c.beginPath();c.ellipse(sx,yy,w,1.4,0,back?Math.PI:0,back?TAU:Math.PI);c.stroke();
      c.strokeStyle=bone;c.lineWidth=1.05;c.stroke();
    }
    if(back)for(let i=0;i<4;i++)joint(sx,-14-i*2.2,.6);
    limb(side?-5:-5.6,-22,side?5:5.6,-22,1.6);
    // Frayed remnants of a workman's collar, belt and tiny keepsake pouch.
    polyline([[-5,-23],[-2,-24],[0,-22],[2,-24],[5,-23],[4,-20],[1,-21],[-1,-20],[-4,-21]],'#778168',.4);
    rect(-4,-12,8,1.4,'#76563d');rect(-.7,-12,1.5,1.2,'#c7a769');
    rect(-5,-13,2.4,3,wood);rect(-5,-13,2.4,.6,'#c99f65');
    const shoulder=sign=>[sign*(side?5:5.6)+(side?0:lean*.3),-22];
    const far=()=>{const [ax,ay]=shoulder(-1),sw=side?(P.mv?-P.sw*3:P.armB):P.armB;
      const ex=side?-6.5+sw*.4:ax-1.8+sw*.2,ey=side?-16:-16.6,hx=side?-6+sw:ex-.6,hy=side?-10.5:-11.5+Math.abs(sw)*.3;
      limb(ax,ay,ex,ey,1.4);limb(ex,ey,hx,hy,1.3);joint(ex,ey,.85);if((look&2)&&!side)shield(hx-1.4,hy-3.6);};
    const near=()=>{const [ax,ay]=shoulder(1);let hx=ax+4+Math.cos(P.ang-.7)*2,hy=ay+6+Math.sin(P.ang-.7)*3,a=P.ang;
      if(!side){hx=ax+2.4+Math.sin(a*.5)*.5;hy=-11.6+Math.sin(a)*.6;}
      if(P.gp){const [gx,gy]=P.gp.h,ex=(ax+gx)/2-1,ey=(ay+gy)/2+3.5;limb(ax,ay,ex,ey,1.5);limb(ex,ey,gx,gy,1.4);joint(ex,ey,.9);joint(gx,gy,1.1);for(let i=0;i<3;i++)line(gx+i*.6,gy,gx+1.1-P.gp.k*.9,gy+1.2+i*.3,.5,bone);hx=-6;hy=-20;a=2.35;
      }else{const ex=side?ax+3.4:ax+2.2,ey=side?ay+4.4:-16.4;limb(ax,ay,ex,ey,1.4);limb(ex,ey,side?hx+1:hx,hy,1.3);joint(ex,ey,.9);}
      sword(hx+(side?1:.4),hy,side?a:-1+(a+1.1)*.6+(back?.1:0));};
    if(back){near();far();}else{far();if(side&&(look&2))shield(.4,-14.6,true);near();}c.restore();
    const hx=P.lean*.8+P.hdx,hy=-27.5+P.sink*.6+P.bob+P.hdy+P.lean*.2;
    polyline([[hx-4.7,hy-4.5],[hx-2,hy-6],[hx+3.4,hy-5.5],[hx+5,hy-2],[hx+4.5,hy+3],[hx-3.7,hy+3.5],[hx-5,hy]],shade);
    polyline([[hx-3.8,hy-4.4],[hx+2.7,hy-4.8],[hx+4.4,hy-1],[hx+3.8,hy+2.5],[hx-3.5,hy+2.6]],bone,.4);
    if(!back){
      for(const x of side?[hx+2]:[hx-2,hx+2.1]){rect(x-1.1,hy-1.7,2.2,2.4,ink);rect(x-.25,hy-1,.65,.8,P.eyeLit>.65?'#a7c59b':'#6f967e');}
      polyline([[hx+.2,hy+.1],[hx+1.1,hy+1.6],[hx-.6,hy+1.6]],ink,.2);
      rect(hx-2.3,hy+2.4,5,1,ink);rect(hx-2.3,hy+3.4+P.jaw*.45,5,1.1,bone);
      for(let i=0;i<4;i++)rect(hx-2+i*1.2,hy+2.4,.7,.8,hi);
      line(hx-3.3,hy-3.4,hx-1,hy-3.9,.5,hi);
    }
    hat(hx,hy-4);c.restore();
  }
  skelSprite=function(s,view,pose,frame){
    const look=skelLook(s),key=[look,view,pose,frame].join('|');let result=cache.get(key);
    if(result){cache.delete(key);cache.set(key,result);last.set(s,result);s._spr=result;return result;}
    const fallback=last.get(s);
    if(typeof spriteBudgetOk==='function'&&!spriteBudgetOk(!!fallback))return fallback;
    const started=performance.now(),cv=mkCanvas(SKA.W*ratio,SKA.H*ratio),c=cv.getContext('2d');
    c.scale(ratio,ratio);c.imageSmoothingEnabled=false;c.lineCap='round';c.lineJoin='round';c.translate(SKA.AX,SKA.AY);
    paint(c,look,view,pose,frame);
    // Crisp physical pixels: quantize edge coverage and colours to the model's
    // own material ramps rather than leaving a soft Canvas fringe.
    const image=c.getImageData(0,0,cv.width,cv.height),palette=['#493b33','#77664e','#b29e7c','#dfcfaa','#f7e7bf','#fff3da','#9f6948','#8b9182','#8a6741','#d8d4b4','#624d36','#c9bea0','#ead9ae','#684b39','#d0ae75','#66533e','#d1b383','#e0bb76','#76563d','#c7a769','#778168','#6f967e','#a7c59b',...(look&1?['#c19b43','#ddbd66','#886829','#f0d28a']:['#a44f3c','#cc7350','#713d32','#e49b6e'])].map(s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)));
    for(let i=0;i<image.data.length;i+=4){if(image.data[i+3]<128){image.data[i+3]=0;continue;}let best=palette[0],distance=Infinity;for(const col of palette){const d=(image.data[i]-col[0])**2+(image.data[i+1]-col[1])**2+(image.data[i+2]-col[2])**2;if(d<distance){distance=d;best=col;}}image.data.set([...best,255],i);}c.putImageData(image,0,0);
    cv.fine=ratio;result={cv};
    if(cache.size>=SKA.MAX)cache.delete(cache.keys().next().value);cache.set(key,result);last.set(s,result);s._spr=result;
    if(typeof spriteSpent==='function')spriteSpent(started);return result;
  };
  if(typeof drawGrip==='function'){
    const oldGrip=drawGrip,grips=new Map();
    drawGrip=function(c,hx,hy,f,k,pal,S=1){
      if(pal!==SK_PAL)return oldGrip(c,hx,hy,f,k,pal,S);
      const key=[f,k,S].join('|');let cv=grips.get(key);
      if(!cv){
        cv=mkCanvas(64,48);const g=cv.getContext('2d');g.scale(2,2);g.translate(16,12);g.lineCap='round';g.lineJoin='round';
        for(let i=0;i<3;i++){
          const o=i-1,a0=o*.75-.15,a1=a0+(o*.16+.12-a0)*k,a2=a1+.4+1.5*k;
          const l1=(5.6+(i===1?1:-.4))*S,l2=(4+(i===1?.6:-.3))*S;
          const x=-f*1.5*S,y=o*4.6*S,xx=x+f*Math.cos(a1)*l1,yy=y+Math.sin(a1)*l1;
          const ex=xx+f*Math.cos(a2)*l2,ey=yy+Math.sin(a2)*l2;
          naLimb(g,x,y,xx,yy,1.35,'#66533f');naLimb(g,xx,yy,ex,ey,1.2,'#66533f');
          naLimb(g,x-.15,y-.15,xx-.15,yy-.15,.8,'#dfcfaa');naLimb(g,xx-.15,yy-.15,ex-.15,ey-.15,.7,'#dfcfaa');
          ellipse(g,xx-.1,yy-.1,.7,.65,'#f7e7bf');
        }
        cv.fine=2;grips.set(key,cv);
      }
      blitFine(c,cv,hx-16,hy-12,32,24);
    };
  }
  window.FantasyUndeadPolish={version:'01199-skeletons-1',kinds:['skeleton'],ratio,originalSkeleton:original,paintSkeleton:paint,cache,sourceVersion:typeof GAME_VERSION==='undefined'?null:GAME_VERSION};
})();
