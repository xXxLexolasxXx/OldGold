/* OldGold: goblin graphics only. Load after goblinart.js and pxbeasts.js.
 * No species, dimensions, anchor, pose tables or gameplay changes.
 * GoblinPolish.setEnabled(false) restores the original renderer.
 */
(() => {
  'use strict';
  if (window.GoblinPolish) return;
  if (typeof NA_DRAW === 'undefined' || !NA_DRAW.goblin) {
    throw new Error('GoblinPolish requires world/neutralart2.js');
  }
  const original = NA_DRAW.goblin;
  const originalSpear = NA_DRAW.goblinB;
  const eliteKinds = ['goblinChamp', 'goblinKing'].filter(kind => NA_DRAW[kind]);
  const originalElite = Object.fromEntries(eliteKinds.map(kind => [kind, { draw: NA_DRAW[kind], px: NA_PX[kind] }]));
  const kinds = ['goblin','goblinB',...eliteKinds];
  // Measured from feod/fantasy-art.js: building buffers are world size ×2;
  // building composition has smoothing off and adds no automatic dark halo.
  const renderSpec = Object.freeze({ backingScale: 2, worldPixelStep: 0.5, autoOutline: false, smoothing: 'R.smooth (devScale < 1)' });
  const originalFrame = naFrame, originalBlit = blitFine;
  const originalCampaignDraw = typeof campDrawGoblin==='function'?campDrawGoblin:null;
  const originalFoeDraw = typeof foeDrawRaider==='function'?foeDrawRaider:null;
  const outerDeath = new WeakSet();
  let enabled = false;
  // Continuous shoulder movement through interpolated victory poses. No changes
  // to naPose, state selection, gameplay or animation durations.
  const raised = P => Math.max(0,Math.min(1,P.up||0));
  const armTheta = P => {const u=raised(P);return naTheta({...P,up:0})*(1-u)-3*u};
  if(originalFoeDraw) foeDrawRaider=function(c,N){
    const target=enabled&&N.st==='die'&&(N.k==='goblin'||N.k==='goblinChamp'||N.k==='goblinKing');
    if(target)outerDeath.add(N);
    try{return originalFoeDraw(c,N)}finally{if(target)outerDeath.delete(N)}
  };
  if(originalCampaignDraw) campDrawGoblin=function(c,N,art){
    const kind=art||(N.k==='goblinChamp'?'goblinChamp':N.id%2?'goblinB':'goblin');
    if(!enabled||!kinds.includes(kind))return originalCampaignDraw(c,N,art);
    let fr=N.st==='die'?naDieFr(N.dt||0):N.st==='atk'?naAtkFr(N.atkT,0.6):N.st==='chase'?'w'+((Game.time*16.5+N.id)%NA_N|0):naIdleFr(Game.time,N.id);
    if(Game.time-(N.hurtT??-9)<0.3&&N.st!=='die')fr=naHurtFr(Game.time-N.hurtT);
    const sp=naFrame(kind,fr),sc=kind==='goblin'||kind==='goblinB'?1.1:1;
    c.save();
    // foeDraw already applies a generic body rotation to dead foes. Replace
    // that visual transform with our authored fall, avoiding double rotation.
    if(outerDeath.has(N)){c.translate(0,-Math.min(6,(N.dt||0)*12));c.rotate(-Math.min(1.45,(N.dt||0)*4))}
    c.scale(sc,sc);blitFine(c,sp.cv,-sp.ax,-sp.ay);c.restore();
  };

  naFrame = function(kind,fr) {
    if (!enabled || !kinds.includes(kind)) return originalFrame(kind,fr);
    const key=kind+'|'+fr;
    if(naCache.has(key)){const s=naCache.get(key);naCache.delete(key);naCache.set(key,s);return s}
    const S=NA_SPEC[kind],P=naPose(fr);P.pal=S.pal||null;
    const [cv,c]=mkSprite(S.w,S.h,4);
    c.lineCap='round';c.lineJoin='round';c.translate(S.ax,S.ay);
    if(S.sc)c.scale(S.sc,S.sc);
    NA_DRAW[kind](c,P,fr);
    const out=toPixelArt(cv,2,{outline:false,alphaCut:100});
    out.fine=2;out.fantasyGoblin=true;
    // Same death dissolve and timing as the original sprite pipeline.
    if(P.fade>0){const ctx=out.getContext('2d'),img=ctx.getImageData(0,0,out.width,out.height),d=img.data;
      for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(!d[i+3])continue;
        if(naHash(x,y)<P.fade)d[i+3]=0;
        else{d[i]+=(230-d[i])*P.fade*0.4;d[i+1]+=(240-d[i+1])*P.fade*0.4;d[i+2]+=(200-d[i+2])*P.fade*0.4}
      }ctx.putImageData(img,0,0);
    }
    const sprite={cv:out,ax:S.ax,ay:S.ay,w:S.w,h:S.h};
    naCachePx+=out.width*out.height;
    while(naCachePx>NA_CACHE_PX&&naCache.size){const oldest=naCache.keys().next().value,old=naCache.get(oldest).cv;naCachePx-=old.width*old.height;naCache.delete(oldest)}
    naCache.set(key,sprite);return sprite;
  };
  blitFine = function(c,cv,x,y,w,h) {
    if(!cv.fantasyGoblin)return originalBlit(c,cv,x,y,w,h);
    const previous=c.imageSmoothingEnabled;
    c.imageSmoothingEnabled=typeof R!=='undefined'?R.smooth:false;
    c.drawImage(cv,x,y,w??cv.width/2,h??cv.height/2);
    c.imageSmoothingEnabled=previous;
  };

  function draw(c, P, spear = false) {
    const k = color => naK(P, color);
    const ink = k('#241f24'), moss = k('#73963e'), shade = k('#4a6e30');
    const light = k('#aac462'), cloth = k(spear ? '#a06840' : '#7a3a4a'), fold = k(spear ? '#583522' : '#4a2835');
    const leather = k('#875434'), darkLeather = k('#45291a');
    const shape = (points, color) => poly(c, points, color);
    const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    naShadow(c, 6);
    c.save();
    c.translate(P.x, P.y);
    c.rotate(P.rot);
    c.scale(1, P.sq);
    const sw = P.leg;

    // Dark far leg, lit near leg; the original stride and ground contact.
    naLimb(c, -1.5, -8.4, -2 - sw * 2.2, -1.1, 1.8, shade);
    naLimb(c, 1.4, -8.4, 2 + sw * 2.2, -1.1, 1.9, moss);
    for (const [x, near] of [[-2 - sw * 2.2, false], [2 + sw * 2.2, true]]) {
      shape([[x - 1.5, -2.4], [x + 1, -2.4], [x + 2.9, -0.9], [x + 2.9, 0.1], [x - 1.6, 0.1]], ink);
      rect(x - 1.1, -1.9, 2.3, 1.3, near ? leather : darkLeather);
      rect(x - 1.5, -0.5, 4.1, 0.5, darkLeather);
      if(near){naLimb(c,x-0.7,-2,x+0.6,-1.6,0.3,k('#b8804e'));rect(x+0.1,-1.5,0.3,0.3,k('#c0ae5c'))}
    }
    const farAngle=(0.3+P.b*0.4)*(1-raised(P))-2.7*raised(P);
    naArm(c, -2.8, -14.1, 3.6, 3.4, farAngle, 0.3, 1.8, ink);
    naArm(c, -2.8, -14.1, 3.6, 3.4, farAngle, 0.3, 1.1, shade);

    // A patched wine-coloured hood and tunic, with a small travelling pouch.
    shape([[-4.2, -15.2], [1, -16.1], [3.5, -14.8], [4.5, -10.7], [3.8, -7.3], [1.4, -8], [-0.2, -6.9], [-2, -8], [-4, -7.1], [-4.8, -10.7]], ink);
    shape([[-3.6, -14.8], [1, -15.4], [3.1, -14.3], [3.8, -10.6], [3.2, -8.2], [1.2, -8.8], [-0.4, -7.8], [-2.2, -8.8], [-3.5, -8.1], [-4.1, -10.9]], cloth);
    shape([[-3.6, -14.8], [-1.5, -15.1], [-2.2, -10.7], [-1.4, -8.5], [-3.5, -8.1], [-4.1, -10.9]], fold);
    naLimb(c, -2.5, -14.2, 2.8, -10, 1.2, darkLeather);
    naLimb(c, -2.6, -14.5, 2.7, -10.3, 0.45, leather);
    rect(-4.3, -10.5, 8.3, 1.2, darkLeather);
    rect(0.1, -10.6, 1.7, 1.3, k('#c0ae5c'));
    rect(0.6, -10.3, 0.7, 0.6, darkLeather);
    c.save(); c.translate(-3.7, -10.4);
    // Small secondary motion is derived from the game's existing pose only.
    c.rotate(sw * 0.07 - P.a * 0.05);
    shape([[-1, -0.2], [1.3, -0.1], [1.5, 2.7], [-0.6, 3.2], [-1.3, 2]], darkLeather);
    rect(-0.8, 0.4, 1.8, 1, leather);
    naLimb(c, -0.9, 2.4, 0.6, 2.4, 0.3, k('#a06840'));
    c.restore();
    rect(1.7, -8.9, 1.2, 0.8, k('#b8804e'));
    rect(1.8, -8.8, 0.25, 0.6, k('#f0d6a8'));
    rect(2.6,-8.8,0.25,0.6,k('#f0d6a8'));
    // Tailored seams, eyelets and woven hems remain attached to the new body.
    naLimb(c, 1.8, -14.4, 2.7, -11.1, 0.35, k(spear ? '#cc9a64' : '#a85a6a'));
    for (const y of [-13.6, -12.8, -12]) rect(0.8, y, 0.4, 0.35, k('#c0ae5c'));
    naLimb(c, -0.4, -8.4, 1.1, -9, 0.35, k('#cc9a64'));
    for (const x of [-2.5, -1.4, -0.3]) rect(x, -10.1, 0.2, 0.35, k('#b8804e'));
    if (spear) {
      // A short padded jerkin, stitched on the same moving torso.
      for (const y of [-13.3, -12.1]) {
        naLimb(c, -1.4, y, 1.8, y - 0.3, 0.35, k('#cc9a64'));
      }
      shape([[-4.2, -14.9], [-2.6, -15.6], [-1, -14.4], [-1.7, -12.7], [-4.6, -13.2]], darkLeather);
      naLimb(c, -3.9, -14.7, -2.7, -15, 0.4, k('#cc9a64'));
      rect(-3.8, -14.2, 0.5, 0.5, k('#c0ae5c'));
    }

    const hx = 1.6 + (P.a > 0.5 ? 1 : 0), hy = -18.6 + (P.hurt > 0.5 ? 0.6 : 0);
    c.save(); c.translate(hx, hy);
    shape([[-2, -1.2], [-8.3, -4.1 - (P.eye === 1 ? 0.8 : 0)], [-6.6, -0.2], [-2.2, 1.4]], ink);
    shape([[-2.7, -0.8], [-7, -3], [-5.7, -0.2], [-2.7, 0.7]], moss);
    shape([[-3, -0.5], [-6.2, -2.2], [-5.1, -0.2]], shade);
    if (!spear) {
      const hoodSwing = sw * 0.3 + P.up * 0.35;
      shape([[-3.4, 0], [-4.2, 0.2], [-4.7 + hoodSwing, 3.1], [-2.8 + hoodSwing, 2.2]], ink);
      shape([[-3.3, 0.4], [-3.8, 0.7], [-4.1 + hoodSwing, 2.5], [-3 + hoodSwing, 1.9]], fold);
      shape([[-4, 1.7], [-4.5, -2.5], [-2.8, -4.5], [0.6, -4.8], [3.2, -2.6], [3, 1.5], [0.1, 3.2]], ink);
      shape([[-3.5, 0.9], [-3.7, -2.3], [-2.5, -3.9], [0.4, -4.1], [2.4, -2.6], [1.3, -2.1], [-0.4, -3], [-2.2, -1.7], [-2.3, 1.1]], cloth);
      shape([[-3.5, 0.9], [-3.7, -2.3], [-2.5, -3.9], [-2.8, -1.4], [-1.9, 1.7]], fold);
    }
    shape([[-1.7, -1.9], [0.3, -2.7], [2.6, -1.6], [3, -0.6], [7.1, 1.2], [6.9, 2], [3.2, 1.8], [2.1, 3], [-0.5, 3.1], [-2.2, 1.5]], shade);
    shape([[-1.4, -1.8], [0.3, -2.2], [2.3, -1.3], [2.6, -0.2], [6.1, 1.1], [3.2, 1.1], [1.9, 2.4], [-0.3, 2.4], [-1.7, 1]], moss);
    rect(-1.3, -1.6, 1.3, 0.6, light);
    naLimb(c, 3, 0.2, 5.5, 1.1, 0.55, light);
    rect(4.8, 1.3, 0.5, 0.4, shade);
    naLimb(c, -0.8, 0.3, -0.4, 1.3, 0.3, light);
    ellipse(c, -5.2, -1.2, 0.48, 0.65, k('#c89226'));
    rect(-5.3, -1.4, 0.3, 0.5, ink);
    if (P.eye < 2) {
      ellipse(c, 1.1, -0.65, 1.15, 0.85, k('#fff2a0'));
      rect(1.5, -1.1, 0.6, 1, ink);
      naLimb(c, -0.1, -1.8, 2.2, P.eye === 1 ? -0.9 : -1.7, 0.65, ink);
    } else naEye(c, 1.1, -0.6, P);
    rect(0.4, 1.65, 2.6, 0.5 + P.mouth * 0.9, ink);
    rect(0.8, 1.6, 0.55, 0.8, k('#f0d6a8'));
    if (P.mouth > 0.3) rect(2.1, 1.6, 0.55, 0.7, k('#f0d6a8'));
    if (spear) {
      // A battered kettle helmet: separate shadow, steel, rim and rivets.
      shape([[-4.3, -1.3], [-3.5, -4], [-1.6, -4.6], [1.5, -4.4], [3.6, -2.8], [4, -1.1]], ink);
      shape([[-3.5, -1.8], [-2.9, -3.5], [-1.3, -4], [1.4, -3.9], [2.8, -2.7], [3.1, -1.7]], k('#867e74'));
      shape([[-3.5, -1.8], [-2.9, -3.5], [-1.3, -4], [-1.6, -1.8]], k('#b6ada0'));
      naLimb(c, -2.4, -3.2, -1.1, -3.5, 0.5, k('#e4ddd2'));
      rect(0.8, -3.4, 0.9, 0.4, k('#5c564f'));
      rect(-4.2, -1.8, 8.6, 0.9, ink);
      rect(-3.9, -1.7, 8, 0.45, k('#b6ada0'));
      for (const x of [-3.1, -0.8, 2.9]) rect(x, -1.25, 0.4, 0.4, k('#cec6ba'));
      shape([[-3.3, -0.9], [-2.1, -0.9], [-2.3, 2.4], [-3.4, 1.7]], darkLeather);
      naLimb(c, -2.9, -0.5, -2.9, 1.3, 0.45, leather);
    }
    c.restore();

    const th = armTheta(P);
    naArm(c, 2, -14, 3.8, 3.6, th, -0.4, 2, ink);
    const [ax, ay, ang] = naArm(c, 2, -14, 3.8, 3.6, th, -0.4, 1.25, moss);
    const [dx, dy] = naDir(ang + 0.15);
    // A sewn wrist guard follows the same forearm in all 81 poses.
    c.save();c.translate(ax,ay);c.rotate(ang);
    rect(-0.8,-2.8,1.6,1.9,darkLeather);
    rect(-0.65,-2.6,1.25,0.5,leather);rect(0,-2.5,0.3,0.3,k('#c0ae5c'));
    c.restore();
    c.save(); c.translate(ax, ay); c.rotate(Math.atan2(dy, dx));
    if (spear) {
      // Exactly the old weapon reach (-5 .. 12.6), attached to naArm.
      naLimb(c, -5, 0, 9, 0, 1.25, ink);
      naLimb(c, -4.8, 0, 9, 0, 0.8, leather);
      naLimb(c, -4.3, -0.22, 8.8, -0.22, 0.25, k('#cc9a64'));
      shape([[8.6, -1.4], [12.6, 0], [8.6, 1.4]], ink);
      shape([[9, -0.9], [12, 0], [9, 0.9]], k('#9e958a'));
      shape([[9, -0.9], [12, 0], [9, -0.1]], k('#e4ddd2'));
      rect(7.2, -0.7, 1.8, 1.4, darkLeather);
      for (const x of [7.3, 7.9, 8.5]) naLimb(c, x, -0.6, x + 0.3, 0.6, 0.25, k('#c0ae5c'));
      // Small cloth binding moves with the attack, not a separate effect.
      const flutter = P.leg * 0.25 + P.a * 0.2;
      shape([[6.7, 0.5], [8.1, 0.5], [7.8 + flutter, 3.1], [6.9 + flutter, 2.6]], k('#7a3a4a'));
      naLimb(c, 7, 0.7, 7.1 + flutter, 2.3, 0.3, k('#a85a6a'));
    } else {
      shape([[0, -1], [4, -1], [5.9, 0], [3.9, 1.1], [2.9, 0.7], [2.3, 1.2], [0, 1]], ink);
      shape([[0.4, -0.55], [3.9, -0.55], [5, 0], [3.6, 0.35], [0.4, 0.45]], k('#b6ada0'));
      naLimb(c, 0.6, -0.45, 3.8, -0.45, 0.35, k('#f6f2ea'));
      rect(-0.4, -1.5, 0.7, 3, leather);
      rect(-1.7, -0.6, 1.2, 1.2, darkLeather);
    }
    c.restore();
    ellipse(c, ax, ay, 0.85, 0.8, moss);
    if (P.a > 0.6) {
      c.strokeStyle = 'rgba(255,242,190,0.7)'; c.lineWidth = 0.5;
      c.beginPath(); c.arc(ax, ay, 8, ang - 1.2, ang - 0.2); c.stroke();
    }
    if (P.b > 0.5) {
      c.strokeStyle = 'rgba(220,230,200,0.85)'; c.lineWidth = 0.6;
      c.beginPath(); c.arc(4, -13, 4.6, -1.2, 1.2); c.stroke();
    }
    c.restore();
  }

  function drawElite(c, P, king) {
    const k = color => naK(P, color);
    const C = { ink: k('#241f24'), skin: k('#73963e'), shade: k('#4a6e30'), light: k('#aac462'),
      deep: k('#2f4a26'), wine: k('#7a3a4a'), fold: k('#452939'), rose: k('#a85a6a'),
      steel: k('#867e74'), silver: k('#cec6ba'), iron: k('#4a4540'), leather: k('#875434'),
      dark: k('#45291a'), gold: k('#c89226'), gleam: k('#fff2a0') };
    // Rounded material contours on the same ×2 raster: curves, not blur.
    const polyK = (pts, color) => {
      c.fillStyle=color;c.beginPath();
      const corner=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      for(let i=0;i<pts.length;i++){
        const p=pts[i],prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length];
        const r=Math.min(1.15,Math.hypot(p[0]-prev[0],p[1]-prev[1])*0.3,Math.hypot(p[0]-next[0],p[1]-next[1])*0.3);
        const a=corner(p,prev,r/(Math.hypot(p[0]-prev[0],p[1]-prev[1])||1)),b=corner(p,next,r/(Math.hypot(p[0]-next[0],p[1]-next[1])||1));
        if(!i)c.moveTo(...a);else c.lineTo(...a);c.quadraticCurveTo(...p,...b);
      }c.closePath();c.fill();
    };
    const dome=(color,inset=0)=>{c.fillStyle=color;c.beginPath();c.moveTo(-4+inset,-2.1);c.bezierCurveTo(-4.2+inset,-6.5,-0.6,-7.2,2.4,-5.5);c.quadraticCurveTo(3.8-inset,-4.5,4-inset,-2.1);c.closePath();c.fill()};
    const box = (x,y,w,h,color) => {c.fillStyle=color;c.fillRect(x,y,w,h)};
    const line = (x,y,xx,yy,w,color) => naLimb(c,x,y,xx,yy,w,color);
    const ball = (x,y,rx,ry,color) => ellipse(c,x,y,rx,ry,color);
    // Rolled breastplate edges follow the belly instead of forming flat slabs.
    const plate = (y,inset,color) => {
      const left=-4.7*B+inset,right=4.5*B-inset;
      c.fillStyle=color;c.beginPath();c.moveTo(left+0.7,y+inset);
      c.bezierCurveTo(-2*B,y-0.5+inset,2*B,y-0.8+inset,right-0.8,y-0.4+inset);
      c.quadraticCurveTo(right,y+0.4,right-0.2,y+1.7-inset);
      c.bezierCurveTo(2*B,y+2.7-inset,-2*B,y+3-inset,left+0.4,y+2.6-inset);
      c.quadraticCurveTo(left-0.3,y+1.5,left+0.7,y+inset);c.closePath();c.fill();
    };
    const rivet = (x,y) => {ball(x,y,0.28,0.28,C.ink);box(x-0.14,y-0.18,0.27,0.23,C.silver)};
    const tall = king ? 1 : 1.3, B = king ? 1.35 : 1.5, sw = P.leg;
    naShadow(c, king ? 8 : 10);
    c.save();c.translate(P.x,P.y);c.rotate(P.rot);c.scale(1,P.sq);
    // The cloak and its embroidered border flex with existing walk/attack poses.
    const sway = sw*0.55-P.a*0.3;
    const drape=(color,inset=0)=>{c.fillStyle=color;c.beginPath();c.moveTo(-4.8*B+inset,-17*tall+inset);
      c.quadraticCurveTo(-1,-18*tall+inset,2-inset,-17*tall+inset);
      c.bezierCurveTo(2.8-inset,-12,3.7-inset,-5,4-inset,-3-inset);
      c.quadraticCurveTo(-1+sway,-2.6-inset,-6.7*B+sway+inset,-1.8-inset);
      c.quadraticCurveTo(-7*B+sway+inset,-7,-4.8*B+inset,-17*tall+inset);c.closePath();c.fill()};
    drape(C.ink);drape(king?C.wine:C.fold,0.45);
    c.fillStyle=C.fold;c.beginPath();c.moveTo(-4.4*B,-16.4*tall);c.quadraticCurveTo(-3*B,-17*tall,-2.6*B,-16.4*tall);
    c.bezierCurveTo(-3.3*B,-12,-3.2*B+sway,-6,-3.8*B+sway,-3.1);c.quadraticCurveTo(-5*B+sway,-2.6,-6.1*B+sway,-2.7);
    c.quadraticCurveTo(-6.3*B+sway,-8,-4.4*B,-16.4*tall);c.closePath();c.fill();
    line(-5.8*B+sway,-3.4,1.5,-4.2,0.5,king?C.gold:C.leather);
    line(-4.2*B,-15*tall,-5.1*B+sway,-5.2,0.55,king?C.rose:C.wine);
    if(king) for(let j=0;j<5;j++) {const x=-7+j*1.9+sway;polyK([[x,-4],[x+0.5,-4.6],[x+0.9,-4],[x+0.5,-3.4]],C.gold)};

    // Articulated thighs, leather gaiters, steel kneecaps, stitched boots.
    for(const [sgn,near] of [[-1,false],[1,true]]) {
      const hx=sgn*1.8*B, knee=hx+sgn*sw*1.2, fx=sgn*2.1*B+sgn*sw*2.4;
      line(hx,-9.4*tall,knee,-4.8*tall,3.1, C.ink);
      line(hx,-9.4*tall,knee,-4.8*tall,2.45,near?C.skin:C.shade);
      line(knee,-4.8*tall,fx,-1.3,2.6,C.ink);
      line(knee,-4.8*tall,fx,-1.3,1.9,C.dark);
      for(let j=0;j<3;j++) {const t=j/3;const x=knee+(fx-knee)*t,y=-4.4*tall+(4.4*tall-2)*t;line(x-0.8,y,x+0.8,y-0.15,0.32,near?C.leather:C.iron)}
      if(!king){polyK([[knee-1.2,-6*tall],[knee+1,-6.2*tall],[knee+1.3,-4.8*tall],[knee,-4.2*tall],[knee-1.4,-4.8*tall]],C.iron);line(knee-0.8,-5.8*tall,knee+0.7,-6*tall,0.35,C.silver);rivet(knee,-5*tall)}
      polyK([[fx-1.7,-2],[fx+1,-2],[fx+3.2,-0.8],[fx+3.1,0.1],[fx-1.7,0.1]],C.ink);
      polyK([[fx-1.2,-1.6],[fx+0.8,-1.6],[fx+2.4,-0.7],[fx-1.2,-0.5]],C.leather);
      line(fx-0.7,-1.5,fx+0.7,-1.1,0.3,king?C.gold:C.silver);
    }
    const shieldAngle=(0.5+P.b*0.9)*(1-raised(P))-2.5*raised(P);
    const [sx,sy]=naArm(c,-3*B,-15*tall,4.3,3.8,shieldAngle,0.6,2.5,C.deep);
    // Rounded belly with a quilted wine undercoat and overlapping plates.
    ball(0,-12*tall,5.3*B,5.7*tall,C.ink);
    ball(0.3,-12*tall,4.9*B,5.3*tall,C.fold);
    ball(1,-12.4*tall,4.2*B,4.6*tall,C.wine);
    line(1.6,-15.5*tall,3.8,-11*tall,0.6,C.rose);
    for(let j=0;j<5;j++){const x=-4.2*B+j*2.3;polyK([[x,-9*tall],[x+1.9,-9*tall],[x+2+sway*0.4,-6.5*tall],[x+0.2+sway*0.4,-6.1*tall]],j%2?C.fold:C.wine);rivet(x+0.7,-8.4*tall)}
    if(!king){
      for(let j=0;j<3;j++) {const y=(-16+j*2.4)*tall;
        plate(y,0,C.ink);plate(y,0.4,j===1?C.steel:C.iron);
        c.strokeStyle=C.silver;c.lineWidth=0.4;c.beginPath();c.moveTo(-4*B,y+0.5);c.quadraticCurveTo(0,y-0.1,3.3*B,y+0.2);c.stroke();
        rivet(-3.5*B,y+1.3);rivet(3.3*B,y+1);
        line(0.7,y+0.5,1.7,y+1.2,0.35,C.dark);box(2,y+1,0.6,0.5,C.leather);
        // Broad bevels first, small wear marks second: legible at game scale.
        line(-3.8*B,y+0.8,-1.7*B,y+0.6,0.32,k('#9e958a'));
        line(2.7*B,y+0.7,3.3*B,y+1.4,0.25,C.silver);
        for(const x of [-2.1,0.1,2.1])box(x,y+1.7,0.3,0.25,C.iron);
      }
      polyK([[-6.5,-17.4*tall],[-3.1,-18.5*tall],[-0.8,-16.4*tall],[-2.1,-14.9*tall],[-6.9,-15.6*tall]],C.ink);
      polyK([[-6.1,-17.1*tall],[-3.2,-18*tall],[-1.5,-16.4*tall],[-2.5,-15.6*tall],[-6.3,-16*tall]],C.steel);
      line(-5.7,-17*tall,-3.2,-17.8*tall,0.45,C.silver);rivet(-4,-16.8*tall);
    } else {
      // Mended fur collar, chain, and an enamel clasp rather than flat fill.
      for(let j=0;j<9;j++){const x=-5.4+j*1.3,y=-17+Math.abs(j-4)*0.32;ball(x,y,0.9,1.1,C.dark);ball(x-0.15,y-0.3,0.65,0.65,k('#e0b882'))}
      for(let j=0;j<7;j++){const x=-3.4+j*1.1,y=-14.6+Math.sin(j/6*Math.PI)*1.3;ball(x,y,0.32,0.35,C.gold);box(x-0.1,y-0.2,0.2,0.2,C.gleam)}
      polyK([[-0.3,-13.7],[1,-14.3],[2.2,-13.6],[1,-12.4]],C.gold);ball(1,-13.5,0.5,0.6,k('#a85a6a'));
      for(const [x,y] of [[2.6,-11.6],[3.5,-10.4],[-2.8,-11.3]]){line(x-0.4,y,x+0.4,y,0.3,C.gold);line(x,y-0.4,x,y+0.4,0.3,C.gold)}
    }
    line(-4.2*B,-16*tall,3.4*B,-9.7*tall,1.4,C.dark);
    line(-4.2*B,-16.2*tall,3.4*B,-9.9*tall,0.45,C.leather);
    for(let j=0;j<8;j++){const t=j/7;box(-4.2*B+7.6*B*t,(-16+6.2*t)*tall,0.25,0.3,k('#cc9a64'))}
    box(-4.7*B,-10.3*tall,9.4*B,1.35,C.dark);
    box(0,-10.4*tall,2.2,1.6,C.gold);box(0.5,-10.1*tall,1.2,0.9,C.dark);box(1.1,-10*tall,0.3,0.7,C.gleam);
    c.save();c.translate(-4.8*B,-10*tall);c.rotate(sw*0.08-P.a*0.06);
    polyK([[-1,-0.3],[1.4,-0.3],[1.7,2.8],[-0.6,3.2],[-1.4,1.9]],C.dark);box(-0.8,0.1,1.8,1,C.leather);rivet(0,0.8);c.restore();

    const hx=(king?2.1:3.3)+(P.a>0.5?1:0),hy=(king?-19.7:-26)+(P.hurt>0.5?0.6:0);
    c.save();c.translate(hx,hy);
    polyK([[-2,-0.5],[-9.2,-4.6-P.eye*0.12],[-7,-0.4],[-2,1.5]],C.ink);
    polyK([[-2.6,-0.6],[-7.8,-3.5],[-6.4,-0.4],[-2.4,0.8]],C.skin);
    line(-6.5,-2.4,-3.4,-0.6,0.6,C.shade);
    ball(-5.6,-1.2,0.55,0.7,C.gold);ball(-5.6,-1.2,0.25,0.38,C.ink);
    ball(0,0,3.8,3.7,C.ink);ball(0.2,0,3.3,3.2,C.shade);ball(0.9,-0.3,2.6,2.5,C.skin);
    c.fillStyle=C.ink;c.beginPath();c.moveTo(2,-0.6);c.bezierCurveTo(3.7,-0.5,6.8,0.7,7.6,1.5);c.quadraticCurveTo(7.7,2.7,5.8,2.3);c.quadraticCurveTo(3.7,2.4,2.3,1.8);c.closePath();c.fill();
    c.fillStyle=C.skin;c.beginPath();c.moveTo(2.2,-0.1);c.quadraticCurveTo(4.6,0.1,6.6,1.4);c.quadraticCurveTo(5.3,2,2.5,1.2);c.closePath();c.fill();line(2.5,0,5.4,1,0.45,C.light);box(5.3,1.4,0.5,0.3,C.deep);
    if(P.eye<2){ball(1.5,-0.9,1.15,0.85,C.gleam);box(1.8,-1.4,0.55,1,C.ink);line(0,-2.1,2.7,-1.4,0.7,C.deep)}else naEye(c,1.5,-0.9,P);
    line(-0.7,0.4,-0.3,1.5,0.4,C.light);
    line(-1.2,-1.2,-0.5,0.4,0.35,k('#b8804e'));
    line(-0.9,-1.6,-0.1,-1.2,0.25,C.light);
    box(0.5,2.1,3,0.5+P.mouth*1.1,C.ink);
    for(const x of [0.9,2.6])polyK([[x,3.1],[x+0.7,3],[x+0.3,1.8]],k('#f0d6a8'));
    if(king){
      // Wisps below the crown and a few wiry chin hairs, fully pose attached.
      for(const [x,y]of[[-2.7,-1.7],[-2.4,-0.5],[-2,0.6],[-0.6,2.4]])line(x,y,x-0.4,y+0.6,0.32,k('#cec6ba'));
      const points=[[-4,-2.8],[-4.3,-6.7],[-2.4,-5],[-0.9,-7.5],[0.6,-5],[2.4,-7],[3.8,-2.8]];
      polyK(points,C.ink);polyK(points.map(([x,y])=>[x*0.84,y+0.45]),C.gold);
      line(-2.7,-5.2,-1,-6.6,0.45,C.gleam);box(-3.6,-3.7,7,1.1,C.gold);line(-3.4,-3.6,3,-3.6,0.35,C.gleam);
      for(const [x,color] of [[-2,C.wine],[0.3,k('#5292bc')],[2.3,C.wine]]){ball(x,-3.2,0.46,0.5,C.dark);ball(x-0.1,-3.3,0.3,0.32,color)}
    }else{
      dome(C.ink);dome(C.iron,0.45);
      c.fillStyle=C.steel;c.beginPath();c.moveTo(-3.5,-2.6);c.bezierCurveTo(-3.6,-4.5,-2.4,-5.7,-0.5,-5.6);c.quadraticCurveTo(-1.4,-4.4,-1.3,-2.6);c.closePath();c.fill();
      line(-2.8,-4.6,-1.2,-5.1,0.5,C.silver);box(-4,-2.5,8.2,0.7,C.dark);
      for(const x of [-3,-1,1,3])rivet(x,-2.1);
      for(const dir of [-1,1]){
        const horn=(color,inset)=>{c.fillStyle=color;c.beginPath();c.moveTo(dir*2.4,-5.1-inset);c.bezierCurveTo(dir*5.3,-5.5,dir*7,-8,dir*5.4,-9.1);c.bezierCurveTo(dir*5.9,-7.8,dir*4.8,-7,dir*2.2,-6.3+inset);c.closePath();c.fill()};
        horn(C.ink,0);horn(k('#e0b882'),0.3);
        line(dir*3.7,-6,dir*4.3,-6.8,0.32,C.leather);
        line(dir*4.2,-6.4,dir*4.8,-6.9,0.25,C.dark);
        line(dir*4.7,-7,dir*5.1,-7.4,0.25,C.leather);
      }
    }
    c.restore();
    if(!king){
      // Barrel shield is built on the arm, so blocks and celebrations carry it.
      const x=sx+1,y=sy-1;
      ball(x,y,6.2,6.7,C.ink);ball(x,y,5.7,6.2,C.iron);ball(x,y,4.9,5.4,C.leather);
      for(let j=-2;j<=2;j++){const xx=x+j*1.65;line(xx,y-4.5,xx,y+4.5,0.3,C.dark);line(xx+0.45,y-3.8,xx+0.45,y+3.9,0.25,k('#b8804e'))}
      line(x-4.2,y-2.2,x+4.2,y-2.2,0.8,C.iron);line(x-4.2,y+2.2,x+4.2,y+2.2,0.8,C.iron);
      for(const dx of [-3.5,3.5])for(const dy of [-2.2,2.2])rivet(x+dx,y+dy);
      ball(x,y,1.4,1.5,C.ink);ball(x,y-0.1,1.1,1.15,C.steel);ball(x-0.3,y-0.5,0.4,0.4,C.silver);
      line(x-2,y+0.5,x-0.9,y+1.3,0.35,C.dark);
    }
    // Every weapon is attached to the new articulated forearm in every pose.
    let ax,ay,ang,dx,dy;
    if(king){
      [ax,ay,ang]=naArm(c,2.5,-14.5,4,3.7,armTheta(P),-0.4,2,C.ink);
      naArm(c,2.5,-14.5,4,3.7,armTheta(P),-0.4,1.4,C.skin);
      [dx,dy]=naDir(ang+0.15);
    }else{
      // Retain the champion's original raised sword arc (pxbeasts.pbArmAng),
      // with new shoulder/elbow/wrist artwork rather than the small-goblin arc.
      const base=P.a>0?-0.2+P.a*1.5:-0.6+P.a*1.9;
      const a=base*(1-raised(P))-2.7*raised(P);
      const ex=4+Math.cos(a+1.25)*5.2,ey=-20+Math.sin(a+1.25)*5.2;
      ax=ex+Math.cos(a+0.45)*4.8;ay=ey+Math.sin(a+0.45)*4.8;
      for(const [width,color]of[[3.2,C.ink],[2.5,C.skin]]){line(4,-20,ex,ey,width,color);line(ex,ey,ax,ay,width*0.9,color)}
      line(4.1,-20.5,ex-0.3,ey-0.5,0.6,C.light);
      line(ex+(ax-ex)*0.35,ey+(ay-ey)*0.35,ax,ay,2.7,C.dark);
      for(const t of [0.45,0.7,0.95]){const x=ex+(ax-ex)*t,y=ey+(ay-ey)*t;line(x-0.55,y-0.7,x+0.55,y+0.7,0.35,C.leather)}
      ball(4,-20.5,1.9,1.6,C.iron);line(2.7,-21,4.7,-21.7,0.45,C.silver);rivet(3.4,-20.6);
      ang=a-0.35;dx=Math.cos(a-0.2);dy=Math.sin(a-0.2);
    }
    c.save();c.translate(ax,ay);c.rotate(Math.atan2(dy,dx));
    box(-2,-0.7,3,1.4,C.dark);for(let j=0;j<4;j++)line(-1.6+j*0.6,-0.6,-1.3+j*0.6,0.6,0.25,C.leather);
    if(king){
      line(0,0,9,0,1.7,C.ink);line(0,-0.2,8.5,-0.2,1,C.leather);
      ball(9,0,2.7,2.7,C.ink);ball(9,-0.1,2.2,2.2,C.dark);ball(8.6,-0.5,1.6,1.6,C.leather);
      box(7.2,-2,0.7,4,C.gold);box(9.7,-2,0.6,4,C.gold);line(8.1,-1.7,9.2,-1.7,0.4,C.gleam);
      for(const yy of [-1,1])polyK([[9,yy*1.4],[10.5,yy*3.1],[10.4,yy*1.2]],C.silver);
    }else{
      box(0,-3,1.2,6,C.iron);line(0.2,-2.6,0.2,2.6,0.4,C.silver);
      polyK([[1.2,-1.6],[15,-1.3],[18,0],[15,1.4],[12,0.9],[10.5,1.7],[8,1.1],[6,1.7],[1.2,1.7]],C.ink);
      polyK([[1.6,-1.1],[14.8,-0.8],[17,0],[14.5,0.8],[12,0.4],[10.2,1.1],[7.8,0.5],[6,1.1],[1.6,1.1]],C.steel);
      line(2,-0.9,14,-0.7,0.45,C.silver);line(3,0,13,0,0.25,C.iron);
      for(const x of [4,8,12]){box(x,0.4,0.8,0.5,C.leather);box(x+0.4,0.6,0.5,0.4,k('#b8804e'))}
    }
    c.restore();ball(ax,ay,king?1:1.3,king?0.9:1.2,C.skin);
    if(P.a>0.6){c.strokeStyle='rgba(255,242,190,0.65)';c.lineWidth=0.5;c.beginPath();c.arc(ax,ay,king?10:16,ang-1.2,ang-0.2);c.stroke()}
    c.restore();
  }

  function setEnabled(value) {
    value = !!value;
    if (value === enabled) return;
    NA_DRAW.goblin = value ? (c, P) => draw(c, P, false) : original;
    NA_DRAW.goblinB = value ? (c, P) => draw(c, P, true) : originalSpear;
    for (const kind of eliteKinds) {
      NA_DRAW[kind] = value ? (c,P) => drawElite(c,P,kind === 'goblinKing') : originalElite[kind].draw;
      if (value) delete NA_PX[kind];
      else if (originalElite[kind].px) NA_PX[kind] = originalElite[kind].px;
    }
    // Invalidate only our goblins; keep cache accounting exact.
    for (const [key, sprite] of naCache) {
      if (!kinds.includes(key.split('|')[0])) continue;
      naCachePx -= sprite.cv.width * sprite.cv.height;
      naCache.delete(key);
    }
    enabled = value;
  }
  window.GoblinPolish = Object.freeze({ setEnabled, renderSpec, get enabled() { return enabled; } });
  setEnabled(true);
})();
