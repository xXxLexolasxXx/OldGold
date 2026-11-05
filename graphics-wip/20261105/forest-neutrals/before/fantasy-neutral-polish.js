/* Two fairy renderers, in ordinary games and loaded saves as well as previews.
 * Load after world/frostart.js. Only the sample village actors are opt-in. */
'use strict';
(() => {
  if (window.FantasyNeutralPolish) return;
  const original = NA_DRAW.pixie;
  const originalFrame = naFrame;
  const kinds = ['pixie', 'fairy'];
  const before = new Map();
  const frames = NA_ALL.concat(...NA_EXTRA.pixie.map(k => NA_FRAMES[k]));
  kinds.forEach(k => frames.forEach(f => before.set(k+'|'+f, naFrame(k, f))));
  function flowerPixie(c, P, kind='pixie', frame='i0') {
    const forest = kind === 'fairy';
    const ink = '#3d3435', leaf = naK(P, forest ? '#526e52' : '#6e8860');
    const cream = naK(P, forest ? '#dce4ce' : '#f3dfb8');
    const rose = naK(P, forest ? '#74948a' : '#be7182');
    const clothShadow = naK(P, forest ? '#445e60' : '#754c65');
    const clothLight = naK(P, forest ? '#b6cbb0' : '#edaaa4');
    const hair = naK(P, forest ? '#c8b580' : '#9f5838');
    const hairDark = naK(P, forest ? '#7f775c' : '#603b32');
    const hairLight = naK(P, forest ? '#f2dfaa' : '#db9658');
    const skin = naK(P, '#edc49f'), gold = naK(P, forest ? '#a4d7cc' : '#e8bd73');
    const block = (x,y,w,h,col) => { c.fillStyle=col; c.fillRect(x,y,w,h); };
    const shape = (points, col) => poly(c, points, col);
    const flower = (x,y,s=1) => {
      block(x-s,y-2*s,2*s,4*s,clothLight);
      block(x-2*s,y-s,4*s,2*s,cream);
      block(x-.7*s,y-.7*s,1.4*s,1.4*s,gold);
    };
    c.save();
    c.translate(P.x, P.y - (P.dead ? 0 : P.sleep ? 1 : 7));
    c.rotate(P.rot);
    // Braided hair tail follows the authored wing and walk poses.
    const falling = /^d[1-5]$/.test(frame);
    const folded = falling || P.sleep;
    const flap = folded ? -1 : P.wing;
    const sway=flap*.55+P.leg*.35;
    const flutter=P.dead||P.sleep ? 0 : P.leg*.55+flap*.25-P.a*.35;
    shape([[-4,-23],[-8,-19],[-9+sway,-11],[-6+sway,-8],[-7,-14],[-3,-18]],ink);
    shape([[-4,-22],[-7,-18],[-8+sway,-12],[-6,-13],[-5,-17]],hairDark);
    naLimb(c,-5,-21,-7+sway,-13,.9,hairLight);
    // Four cellular wings with articulated shoulders and marginal spots.
    const wing = (back) => {
      c.save(); c.translate(-3,-20);
      // Offset the far pair: the wing beat opens and folds rather than just stretches.
      c.rotate((back ? -.21 : .03)+flap*(back ? -.13 : .09));
      c.scale(back ? .79 : 1,back ? .9 : 1);
      // Folding before the fall keeps the wing tips within the unchanged frame.
      if(folded)c.scale(.8,frame==='d1' ? .76 : .65);
      const top=-15-flap*2;
      c.scale(1+flap*(back ? -.12 : .14),1);
      const wingShade=naK(P,forest ? '#90b4a6' : '#acb899');
      const vein=naK(P,forest ? '#6f958d' : '#84957c');
      poly(c,[[1,1],[-3,-8],[-8,top],[-13,top-1],[-17,top+3],[-17,top+7],[-12,-2],[-5,2],[-13,3],[-15,7],[-13,11],[-9,12],[-3,8],[2,2]],wingShade,ink,.5);
      shape([[0,0],[-4,-8],[-9,top+1],[-13,top],[-15,top+3],[-15,top+7],[-11,-3],[-4,1]],wingShade);
      shape([[-3,-3],[-6,-10],[-10,top+2],[-13,top+2],[-14,top+4],[-12,top+7],[-8,-5]],cream);
      shape([[-2,3],[-12,4],[-13,7],[-11,10],[-8,10],[-3,6]],wingShade);
      shape([[-4,4],[-11,5],[-11,8],[-8,9]],cream);
      naLimb(c,-1,1,-12,top+4,.65,vein);
      naLimb(c,-6,-6,-14,top+6,.55,vein);naLimb(c,-6,-6,-8,top+2,.55,vein);
      naLimb(c,-1,2,-10,8,.65,vein);
      block(-14,top+3,1,2,'#fff0cd');block(-13,top+7,1,2,'#fff0cd');
      block(-11,-5,1,2,'#fff0cd');block(-10,7,2,1,clothLight);
      block(-8,8,1,1,'#fff0cd');block(-11,top+4,2,3,'#fff0cd');block(-10,top+5,1,1,gold);
      c.restore();
    };
    wing(true);
    // Feet remain attached to the original pose and ground anchor.
    const sw=P.leg*1.8;
    naLimb(c,-1,-11,-2+sw,-1,1.6,ink);
    naLimb(c,2,-11,3-sw,-1,1.6,skin);
    block(-3+sw,-2,3,2,leaf); block(2-sw,-2,3,2,leaf);
    naLimb(c,-1,-9,-2+sw,-3,1.2,cream);naLimb(c,2,-9,3-sw,-3,1.2,cream);
    block(-3+sw,-4,2.5,1.4,leaf);block(2-sw,-4,2.5,1.4,leaf);
    block(-2+sw,-2,2,.6,'#c29a65');block(3-sw,-2,2,.6,'#c29a65');
    naArm(c,-2,-20,3.5,3.4,P.up>.5 ? -2.7 : .35+P.b*.2,-.4,1.4,skin);
    shape([[-4,-20],[2,-21],[4,-17],[2,-14],[6+P.leg*.4,-9],[3,-8],[0,-10],[-3,-8],[-5,-10],[-2,-14]],ink);
    shape([[-3,-19],[2,-20],[3,-17],[1,-13],[4,-10],[1,-10],[-1,-11],[-3,-10],[-1,-14]],rose);
    block(-2,-14,4,1,gold);
    shape([[-2,-18],[1,-19],[1,-16],[-1,-15]],'#f0b2ad');
    // Shaded bodice, overlapping petals, contrasting stitched hems.
    shape([[-3,-19],[-1,-20],[0,-15],[-2,-14]],clothShadow);
    shape([[0,-19],[2,-19],[2,-16],[0,-15]],clothLight);
    shape([[-3,-13],[-1,-14],[-1+flutter,-10],[-3+flutter,-9],[-4+flutter,-10]],rose);
    shape([[0,-14],[2,-13],[4+flutter,-10],[2+flutter,-8],[flutter,-10]],clothLight);
    naLimb(c,-3+flutter,-9,-1+flutter,-10,.7,cream);naLimb(c,1+flutter,-10,3+flutter,-9,.7,cream);
    block(1,-17,.7,.7,gold);block(1,-15.5,.7,.7,gold);
    shape([[-4,-21],[-1,-20],[1,-21],[3,-19],[0,-17],[-2,-18],[-5,-17]],leaf);
    naLimb(c,-4,-20,-2,-19,.7,clothLight);naLimb(c,0,-20,1,-19,.7,cream);
    if(forest){
      shape([[-4,-20],[-7,-16],[-8+sway,-10],[-5,-12],[-3,-17]],clothShadow);
      naLimb(c,-5,-17,-6+sway,-12,.6,clothLight);
    }
    // Cross-body strap, acorn satchel, metal clasp and belt buckle.
    naLimb(c,-3,-20,2,-13,.7,'#b69766');
    block(-3,-14,6,1.1,'#71543b');block(0,-14,1.5,1.1,gold);
    c.save();c.translate(P.dead||P.sleep ? 0 : P.leg*.35,0);
    shape([[-5,-14],[-2,-14],[-1,-12],[-2,-9],[-5,-10],[-6,-12]],ink);
    block(-5,-13,3,3,'#ad8050');block(-5,-13,3,1,'#d6b47a');block(-4,-11,1,1,gold);
    c.restore();
    const [hx,hy,ang]=naArm(c,1,-20,3.8,3.6,naTheta(P),-.5+P.b*.6,1.4,skin);
    const [wx,wy]=naDir(ang+.2), tx=hx+wx*7.3,ty=hy+wy*7.3;
    naLimb(c,hx,hy,tx,ty,1.1,'#79604d');
    if(forest){shape([[tx,ty-3],[tx+2,ty],[tx,ty+2],[tx-2,ty]],ink);shape([[tx,ty-2],[tx+1,ty],[tx,ty+1],[tx-1,ty]],P.dark?'#ad81ba':gold);}
    else flower(tx,ty,.85);
    if(P.dark)block(tx-.6,ty-.6,1.2,1.2,'#ad81ba');
    naLimb(c,tx,ty+1,tx-2,ty+3,.8,leaf);
    naLimb(c,hx+.25,hy,tx+.25,ty,.45,'#c5a575');
    // Two silk ends follow the arm's acceleration and settle during recovery.
    if(!P.dead){
      const ribbon=P.sleep ? 0 : P.a*2+flap*.5;
      naLimb(c,tx,ty+1,tx-2-ribbon,ty+4,.75,rose);
      naLimb(c,tx-2-ribbon,ty+4,tx-1-ribbon,ty+5,.6,cream);
      naLimb(c,tx,ty+1,tx+1-ribbon*.6,ty+4,.65,gold);
    }
    if(P.cast>0 || P.b) {
      const reach=frame==='c4'||frame==='k4' ? .68 : 1;
      const radius=(3+P.cast*7)*reach;
      c.strokeStyle=P.dark ? '#ad81ba' : gold;c.lineWidth=.8;
      c.beginPath();c.arc(tx,ty,radius,-1.3,3.8);c.stroke();
      for(let k=0;k<5;k++){const a=k*1.26+P.cast*2,r=(4+P.cast*7)*reach;block(tx+Math.cos(a)*r,ty+Math.sin(a)*r,1,1,P.dark ? '#ad81ba' : cream);}
      if(P.cast>.4){
        // Flower petals / leaf motes expand with the existing cast phase.
        for(let k=0;k<3;k++){
          const a=k*2.094+P.cast*2,r=radius;
          const x=tx+Math.cos(a)*r,y=ty+Math.sin(a)*r;
          shape([[x-1,y],[x,y-1.5],[x+1,y],[x,y+1.5]],P.dark ? '#bc8fca' : forest ? gold : clothLight);
        }
      }
    }
    if(frame==='strike'){
      c.strokeStyle=gold;c.lineWidth=.8;c.beginPath();c.arc(tx-1,ty,4,-1.7,.6);c.stroke();
      block(tx+3,ty-2,1,1,cream);
    }
    const yy=-25+(P.hurt>.5?.6:0);
    // Warm clustered highlights, side braid and a readable face like the dwarves.
    shape([[-5,yy-3],[-2,yy-5],[3,yy-4],[5,yy-1],[5,yy+5],[2,yy+7],[-4,yy+6],[-6,yy+2]],ink);
    shape([[-4,yy-2],[-1,yy-4],[3,yy-3],[4,yy],[2,yy+5],[-3,yy+5]],hairDark);
    block(-2,yy,6,5,'#ba8a72');block(-1,yy,5,4,skin);
    block(0,yy,3,1,'#f7d7aa');block(4,yy+2,1.5,1.7,skin);
    shape([[3.5,yy+1],[7,yy-.3],[5,yy+3]],skin);
    block(-4,yy-2,3,6,hair);block(-3,yy-2,1,4,hairLight);
    shape([[-3,yy-3],[1,yy-4],[4,yy-2],[3,yy],[1,yy-1],[-1,yy+1],[-2,yy-1]],hair);
    naLimb(c,-2,yy-2,1,yy-3,1,hairLight);
    if(P.eye===0||P.eye===1){block(1.5,yy+1,2,1.6,'#fff0cd');block(2.5,yy+1,1,1.8,P.dark?'#a67db6':'#394542');block(2.5,yy+1,.5,.5,'#fff9dc');}
    else naEye(c,2.5,yy+2,P,ink,.8);
    if(P.eye===1)block(1.5,yy+.2,2,.6,hairDark);
    block(3,yy+3,1,.7,'#da9c86');block(2.5,yy+4,1,P.mouth>.4?1:.5,'#9b6263');
    for(let i=0;i<3;i++){block(-4+(i%2),yy+3+i*1.5,2,1.6,hair);block(-4+(i%2),yy+3+i*1.5,.7,1,hairLight);}
    block(-4,yy+7,2,1,gold);
    naLimb(c,-4,yy-3,4,yy-3,1.3,leaf);
    if(forest){
      shape([[-4,yy-3],[-6,yy-7],[-2,yy-5],[-1,yy-3]],leaf);
      shape([[0,yy-3],[1,yy-7],[3,yy-5],[3,yy-3]],leaf);
      naLimb(c,-4,yy-5,-3,yy-4,.6,clothLight);flower(2,yy-3,.65);
    }else{flower(-3,yy-4,.8);flower(0,yy-5,.9);flower(3,yy-3,.65);}
    wing(false);
    if(!P.sleep && !P.dead) for(let k=0;k<3;k++){
      const phase=frame[0]==='v' ? Number(frame[1]) : 0;
      const x=-12-k*3+phase*.5,y=-3-k*7+flap-phase;
      block(x,y,1,1,k%2 ? rose : cream);
      if(P.up>.5&&k===1){block(x-1,y,3,.7,gold);block(x,y-1,.7,3,gold);}
    }
    if(P.sleep){block(-10,-19-P.sleep,3,1,cream);block(-8,-18-P.sleep,1,1,cream);block(-10,-17-P.sleep,3,1,cream);}
    c.restore();
  }
  kinds.forEach(k => { NA_DRAW[k]=(c,P,f)=>flowerPixie(c,P,k,f); });
  for(const key of naCache.keys()) if(kinds.some(k=>key.startsWith(k+'|')))naCache.delete(key);
  // The approved buildings use a 2x backing canvas at unchanged world size.
  // Render the fairy on that same half-world-pixel grid, without the legacy
  // 3x -> 1x palette quantizer and extra one-world-pixel outline pass.
  const renderCache=new Map();
  // Re-rasterize the complete model at dwarf height, retaining the buildings'
  // 2x backing grid. Do not shrink a finished texture (that changes pixel pitch).
  const modelScale=.4;
  naFrame=function(kind,fr){
    if(!kinds.includes(kind))return originalFrame(kind,fr);
    const key=kind+'|'+fr;
    if(renderCache.has(key))return renderCache.get(key);
    const S=NA_SPEC[kind],cv=mkCanvas(S.w*2,S.h*2),c=cv.getContext('2d');
    c.scale(2,2);c.imageSmoothingEnabled=false;c.lineCap='round';c.lineJoin='round';
    c.translate(S.ax,S.ay);c.scale((S.sc||1)*modelScale,(S.sc||1)*modelScale);
    const P=naPose(fr);P.pal=S.pal||null;
    NA_DRAW[kind](c,P,fr);
    if(P.fade>0){
      const d=c.getImageData(0,0,cv.width,cv.height);
      for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
        const o=(y*cv.width+x)*4;if(!d.data[o+3])continue;
        if(naHash(Math.floor(x/2),Math.floor(y/2))<P.fade)d.data[o+3]=0;
        else for(let j=0;j<3;j++)d.data[o+j]+=( [230,240,200][j]-d.data[o+j])*P.fade*.4;
      }
      c.putImageData(d,0,0);
    }
    const sprite={cv,ax:S.ax,ay:S.ay,w:S.w,h:S.h,pixelRatio:2};
    renderCache.set(key,sprite);return sprite;
  };
  // Explicit destination size keeps the original feet anchor and hitbox even
  // though the backing texture is twice as large. Other neutrals use their own
  // existing renderer unchanged. Match the buildings' camera smoothing policy.
  if(typeof neuDraw==='function'){
    const oldDraw=neuDraw;
    neuDraw=function(c,N){
      if(!kinds.includes(N.k))return oldDraw(c,N);
      const S=NSPEC[N.k],sp=naFrame(N.k,N.fr||'i0'),t=Game.time;
      const px=Math.round(N.x*TILE),py=Math.round(N.y*TILE+6),dead=N.st==='die';
      const alpha=dead ? Math.max(0,Math.min(1,1-(N.dt-.9)/2.3)) : 1;
      if(alpha<=0)return;
      c.save();c.globalAlpha=alpha;c.fillStyle='rgba(10,8,4,0.3)';
      c.beginPath();c.ellipse(px,py+1,S.sz*modelScale*(dead?1.1:.8),S.sz*modelScale*.28,0,0,7);c.fill();
      const bob=N.k==='fairy'&&!dead?Math.round(Math.sin(t*3.2+N.id)*1.3*modelScale*2)/2:0;
      c.translate(px,py+bob);if(N.face<0)c.scale(-1,1);
      if(typeof R!=='undefined')c.imageSmoothingEnabled=R.smooth;
      c.drawImage(sp.cv,-sp.ax,-sp.ay,sp.w,sp.h);c.restore();
      if(!dead&&N.hp<N.mhp-.5){
        // Keep the bar above the raised wand and fully opened wings as well as
        // the face. Scaling the old 46px offset alone put it across the eyes.
        const w=18,hy=py-Math.ceil(60*(NA_SPEC[N.k].sc||1)*modelScale),r=Math.max(0,N.hp/N.mhp);
        c.fillStyle='rgba(10,6,2,0.85)';c.fillRect(px-w/2-1,hy-1,w+2,4);
        c.fillStyle=r>.5?'#5ac04a':r>.25?'#e0b030':'#e04a3a';c.fillRect(px-w/2,hy,Math.round(w*r),2);
      }
    };
  }
  window.FantasyNeutralPolish={kinds,kind:'pixie',pixelRatio:2,modelScale,frames:frames.slice(),before:(f,k='pixie')=>before.get(k+'|'+f),after:(f,k='pixie')=>naFrame(k,f),original};
  // Opt-in visual rehearsal in the real village renderer. The sample actors
  // enter the normal depth list alongside buildings and dwarves; they do not
  // join simulation, combat, population or saves.
  if(new URLSearchParams(location.search).get('graphics')==='1'&&new URLSearchParams(location.search).get('fairies')==='1'){
    const oldList=drawSkeletons;
    let centered=false,start=0;
    drawSkeletons=function(list,c,...bounds){
      oldList(list,c,...bounds);
      if(!Game.fantasyGallery)return;
      const school=Game.buildings.find(b=>b.type==='school');if(!school)return;
      if(!centered){
        centered=true;start=Game.time;R.cam.z=2;
        centerOn((school.x+school.w/2)*TILE,(school.y+school.h+.6)*TILE);
      }
      for(let i=0;i<2;i++){
        const t=(Game.time-start+i*3)%18;
        const outbound=t<6,back=t>=10&&t<16;
        const travel=outbound?t/6:back?1-(t-10)/6:t<10?1:0;
        const state=outbound||back?'walk':t<8?'idle':t<10?'cast':'win';
        const seq=NA_FRAMES[state],rate=state==='walk'?10:state==='cast'?7:5;
        const actor={k:i?'fairy':'pixie',id:91001+i,x:school.x+.2+travel*3.8,y:school.doorY+1.1+i*.8,face:back?-1:1,st:state,fr:seq[Math.floor((Game.time-start+i*.37)*rate)%seq.length],hp:22,mhp:22};
        list.push([actor.y+.2,()=>neuDraw(c,actor)]);
      }
    };
  }
  // Optional art modules are loaded explicitly by the main game's entry point.
})();
