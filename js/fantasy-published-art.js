'use strict';
// Optional art adapter for current OldGold. Load after native game modules.
// Native simulation, dimensions, anchors and action frame selectors are retained.
const FantasyPublishedArt = {images:{},errors:[],cache:new Map(),people:new Map(),version:1};
const FantasyArt = FantasyPublishedArt;
function faRect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(.5,w),Math.max(.5,h));}
function fpaBounds(cv){const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]>=96){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return x1<0?[0,0,1,1]:[x0,y0,x1-x0+1,y1-y0+1];}
FantasyPublishedArt.ready=Promise.all(["armory", "bakery", "bonfire-flames", "bonfire-hearth", "brewery", "butchery", "crystalmine", "farm", "gnome-child", "gnome-walk", "gnome-woman-walk", "goatpen", "goldmine", "graveyard", "guild_archer", "guild_mage", "guild_rogue", "guild_warrior", "hopfarm", "inn", "ironmine", "magicworkshop", "metallurgist", "mill", "quarry", "sawmill", "school", "smeltery", "squadtavern", "stable", "storehouse", "swine", "tannery", "weaponsmith", "woodcutter"].map(type=>new Promise(resolve=>{const im=new Image();im.onload=()=>{const cv=mkCanvas(im.width,im.height),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);const d=c.getImageData(0,0,cv.width,cv.height);if(type.startsWith('gnome-')){for(let i=3;i<d.data.length;i+=4)d.data[i]=d.data[i]>=220?255:0;c.putImageData(d,0,0);}const a={image:cv,bounds:fpaBounds(cv)};if(type.startsWith('gnome-')||type==='bonfire-flames')faSliceFrames(a,d.data,cv.width,cv.height,type==='gnome-child'||type==='bonfire-flames'?4:8,type==='gnome-child'||type==='bonfire-flames'?2:3);FantasyPublishedArt.images[type]=a;FantasyPublishedArt.cache.clear();FantasyPublishedArt.people.clear();resolve();};im.onerror=()=>{FantasyPublishedArt.errors.push(type);resolve();};im.src='assets/fantasy/'+type+'-v1.png';})));
const FPA_DONORS={house:'inn',well:'bonfire-hearth',tradepost:'storehouse',infirmary:'magicworkshop',pier:'sawmill',fisherhut:'woodcutter',library:'school',herohall:'guild_warrior',watchtower:'mill'};
const fpaNativeBuilding=buildingSprite,fpaCanvasIDs=new WeakMap();let fpaCanvasID=0;
buildingSprite=function(type,rot=0,level=1,settle,vr=0){
 const base=fpaNativeBuilding(type,rot,level,settle,vr),a=FantasyPublishedArt.images[type==='bonfire'?'bonfire-hearth':FPA_DONORS[type]||type];if(!a)return base;
 if(!fpaCanvasIDs.has(base.canvas))fpaCanvasIDs.set(base.canvas,++fpaCanvasID);const key=[type,rot,level,settle,vr,fpaCanvasIDs.get(base.canvas)].join('|');if(FantasyPublishedArt.cache.has(key))return FantasyPublishedArt.cache.get(key);
 const cv=mkCanvas(base.canvas.width,base.canvas.height),c=cv.getContext('2d'),k=cv.width/base.w;
 // Match the native architecture envelope: activities retain every native anchor.
 const box=fpaBounds(base.canvas);if(type!=='bonfire'){const depth=bDims(type,rot).h*TILE;const yard=(type==='inn'?40:type==='school'?38:25);box[3]=Math.max(10,Math.min(box[3],(base.top+depth-yard)*k-box[1]));}const b=a.bounds,s=Math.min(box[2]/b[2],box[3]/b[3]),w=b[2]*s,h=b[3]*s,x=box[0]+(box[2]-w)/2,y=box[1]+box[3]-h;
 c.imageSmoothingEnabled=false;c.save();if(rot===1||rot===2){c.translate(x*2+w,0);c.scale(-1,1);}c.drawImage(a.image,...b,x,y,w,h);c.restore();
 if(FPA_DONORS[type]){const colors={house:'#899b55',tradepost:'#d6ac43',infirmary:'#ddd7b0',pier:'#628e9c',fisherhut:'#628e9c',library:'#86578e',herohall:'#a63c34',watchtower:'#aa7443',well:'#829d91'};c.fillStyle='#493525';c.fillRect(x+w*.8,y+h*.35,2*k,13*k);c.fillStyle=colors[type];c.fillRect(x+w*.8+2*k,y+h*.35,8*k,5*k);if(type==='infirmary'){c.fillStyle='#ae4538';c.fillRect(x+w*.8+5*k,y+h*.35,2*k,5*k);c.fillRect(x+w*.8+3*k,y+h*.35+2*k,6*k,k);}}const spr={...base,canvas:cv,_publishedArt:true};FantasyPublishedArt.cache.set(key,spr);return spr;
};
const fpaNativeFlames=drawBonfireFlames;
drawBonfireFlames=function(c,x,y,strong,seed,mul=1){const a=FantasyPublishedArt.images['bonfire-flames'];if(!a||!strong)return fpaNativeFlames(c,x,y,strong,seed,mul);const f=a.frames[((Math.floor(Game.time*9+seed)%8)+8)%8],s=Math.min(34/a.maxW,45/a.maxH)*mul;c.save();c.imageSmoothingEnabled=false;glow(c,x,y-8,52*mul,'255,167,65',.2);c.drawImage(a.image,...f,x-f[2]*s/2,y-f[3]*s,f[2]*s,f[3]*s);c.restore();};
function faSliceFrames(art, pixels, width, height, cols, rows) {
  art.frames = []; art.maxW = 0; art.maxH = 0;
  for (let row = 0; row < rows; row++) {
    const top = Math.floor(row * height / rows), bottom = Math.floor((row + 1) * height / rows);
    // Generated sheets can have slightly uneven outer padding. Detect the
    // transparent gutters rather than cutting a hand/hat at a nominal cell edge.
    const runs = []; let start = -1, last = -1;
    const gap = Math.max(3, Math.floor(width / cols * 0.035));
    for (let x = 0; x <= width + gap; x++) {
      let count = 0;
      if (x < width) for (let y = top; y < bottom; y++) if (pixels[(y * width + x) * 4 + 3] >= 128) count++;
      if (count >= 3) { if (start < 0) start = x; last = x; }
      else if (start >= 0 && x - last > gap) { if (last - start > width / cols * 0.2) runs.push([start, last + 1]); start = -1; }
    }
    const groups = runs.length >= cols ? runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, cols).sort((a, b) => a[0] - b[0]) : null;
    for (let col = 0; col < cols; col++) {
    const left = groups ? groups[col][0] : Math.floor(col * width / cols);
    const right = groups ? groups[col][1] : Math.floor((col + 1) * width / cols);
    let x0 = right, x1 = left - 1, y0 = bottom, y1 = top - 1;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 128) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const f = x1 < x0 ? [left, top, 1, 1] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
    art.maxW = Math.max(art.maxW, f[2]); art.maxH = Math.max(art.maxH, f[3]); art.frames.push(f);
    }
  }
}

const faNativePersonSprite = personSprite;
const FA_RENDER_CACHE = FantasyPublishedArt.people;
personSprite = function (u, view, pose, frame, opt = {}) {
  if(window.FantasyPublishedAppearance)u=FantasyPublishedAppearance.resolve(u).holder||u;
  const female = personSex(u)==='f' || !!OUTFIT[u.type]?.fem || u.type === 'waitress';
  const art = FantasyArt.images[female ? 'gnome-woman-walk' : 'gnome-walk'];
  if (!art || !OUTFIT[u.type]) {
    return faNativePersonSprite(u, view, pose, frame, opt);
  }
  const f = pose === 'walk' ? Math.floor((frame % WALK_FRAMES) * 8 / WALK_FRAMES) : 0;
  const row = view === 'E' ? 1 : view === 'N' ? 2 : 0;
  const workF = pose === 'work' ? frame.f : 0;
  const variant = u.look >>> 0;
  const normalizedLook=(u.look>>>0)>=0x20000?u.look:LOOK_POOL[(u.look>>>0)%LOOK_POOL.length];
  const key = [u.type, variant, view, pose, f, workF, pose === 'smoke' ? frame : '', pose === 'work' ? frame.anim : '', u.carry, opt.carryN || u.carryN || 1, opt.gest, opt.gf, opt.wpn, opt.gait, opt.nohat, u.injury].join('|');
  if (FA_RENDER_CACHE.has(key)) return FA_RENDER_CACHE.get(key);
  const cv = mkCanvas(PW * PART, PH * PART), c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false; c.scale(PART, PART);
  const src = art.frames[row * 8 + f];
  const scale = Math.min(25 / art.maxW, 33 / art.maxH);
  const dw = src[2] * scale, dh = src[3] * scale;
  const fight=pose==='fight'?(FIGHT_BODY[frame]||FIGHT_BODY.ready):null;
  const dip=fight?fight[1]:pose==='duck'||pose==='tame'?2:pose==='idle'?-(IDLE_BREATH[(Number(frame)||0)%IDLE_FRAMES]||0):pose==='work'?Math.sin((frame.f||0)*Math.PI/4):0;
  c.save();c.translate(PFX,PFY);c.transform(1,0,fight?fight[0]*.42:0,1,0,dip);c.drawImage(art.image,...src,Math.round(-dw/2),Math.round(-dh),Math.round(dw),Math.round(dh));c.restore();
  // Preserve value ramps while mapping the source green uniform to the exact
  // profession colors already defined by this game (hat and coat separately).
  if (!female) {
    const O = OUTFIT[u.type], L = lookOf({...u,look:normalizedLook});
    const cap = O.cap === 'serf' ? L.serfCap : O.cap === 'wizard' ? '#657d36' : O.cap === 'baker' ? '#eee5cf' : O.cap;
    const capRGB = hexToRgb(cap), coatRGB = hexToRgb(O.coat || L.green);
    const data = c.getImageData(0, 0, cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4, p = data.data;
      if (!p[i + 3] || p[i] > 185 || p[i + 2] > 110 || p[i + 1] < p[i] * 0.83 || p[i + 1] < p[i + 2] * 1.35) continue;
      const target = y < (PFY - dh + dh * 0.31) * PART ? capRGB : coatRGB;
      const light = Math.max(0.35, Math.min(1.5, p[i + 1] / 119));
      for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, Math.round(target[k] * light));
    }
    c.putImageData(data, 0, 0);
  }
  if (u.carry) {
    c.save(); c.translate(PFX, u.carry === 'trunk' ? 13 : 23);
    if (u.carry === 'trunk') c.scale(1.4, 1.2);
    drawLoads(c, u.carry, opt.carryN || u.carryN || 1); c.restore();
  }
  if (pose === 'work') {
    const toolKind=ANIM_TOOL[frame.anim];const angles=toolKind==='toss'?TOSS_A:toolKind==='pat'?PAT_A:toolKind==='sickle'||toolKind==='spade'?SWING_SICKLE:SWING_A;
    const a=angles[workF%angles.length],hx=19,hy=22;
    const tx = Math.round(hx + Math.sin(a) * 6), ty = Math.round(hy - Math.cos(a) * 8);
    pline(c, hx, hy, tx, ty, '#644127', 2);
    const tool = ANIM_TOOL[frame.anim];
    if (tool === 'axe') {
      poly(c, [[tx - 1, ty - 3], [tx + 5, ty - 2], [tx + 4, ty + 3], [tx - 1, ty + 1]], '#aeb6b1', '#42463e', 0.5);
    } else if (tool === 'pick') {
      pline(c, tx - 4, ty + 1, tx + 4, ty - 1, '#bfc3b7', 1);
    } else if (tool === 'sickle') {
      c.strokeStyle = '#c3c6b8'; c.lineWidth = 1; c.beginPath(); c.arc(tx, ty, 4, -2.6, 0.8); c.stroke();
    } else if (tool === 'spade') {
      poly(c, [[tx - 2, ty - 1], [tx + 2, ty - 1], [tx + 2, ty + 3], [tx, ty + 5], [tx - 2, ty + 3]], '#adb5aa');
    } else if (tool === 'hook') {
      pline(c, hx, hy, tx, ty - 4, '#a68b5d', 1); c.strokeStyle = '#b7bda8'; c.beginPath(); c.arc(tx + 1, ty - 4, 2, Math.PI, 0); c.stroke();
    } else { faRect(c, tx - 3, ty - 2, 6, 4, '#42423b'); faRect(c, tx - 3, ty - 2, 6, 1, '#c3c6b8'); }
    faRect(c, hx - 1, hy - 1, 3, 3, '#edbc8b');
  }
  if (opt.gest === 'eat' || opt.gest === 'drink') {
    faRect(c, 18, 20 - (opt.gf || 0) * 3, 3, 4, '#d49c3d');
    faRect(c, 18, 19 - (opt.gf || 0) * 3, 3, 1, '#fff2ce');
  }
  if (pose === 'smoke') {
    const rig = fpaSmokingRig(u, view, frame), O = OUTFIT[u.type];
    const coat = O.coat || '#66863d', hx = PFX + rig.hand[0], hy = PFY + rig.hand[1];
    pline(c, PFX + 4, PFY - 12, hx, hy, '#3e2c20', 3);
    pline(c, PFX + 4, PFY - 12, hx, hy, coat, 2);
    faRect(c, hx, hy, 2, 2, '#efc394');
  }
  fpaAction(c,u,view,pose,frame,opt);
  if (FA_RENDER_CACHE.size > 1600) FA_RENDER_CACHE.delete(FA_RENDER_CACHE.keys().next().value);
  const out=mkCanvas(PW*2,PH*2),oc=out.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(cv,0,0,out.width,out.height);FA_RENDER_CACHE.set(key,out); u._spr=out;
  return out;
};

function fpaSmokingRig(u,view,frame){const v=view==='E'?'E':'S';return {hand:SMOKE_ARM[v].hand[Number(frame)%SMOKE_ARM[v].hand.length],mouth:SMOKE_MOUTH[v]};}
function fpaAction(c,u,view,pose,frame,opt){
 const O=OUTFIT[u.type],L=lookOf(u),coat=O.coat||L.green||'#66863d';
 const arm=(hx,hy,s=1)=>{pline(c,PFX+s*4,PFY-16,hx,hy,'#44362b',3);pline(c,PFX+s*4,PFY-16,hx,hy,coat,2);faRect(c,hx-.5,hy,2,2,SKINS[L.skin%SKINS.length][0]);};
 if(opt.gest){const ss=['clap','stretch','panic','five'].includes(opt.gest)?[1,-1]:[view==='N'?-1:1];for(const s of ss){const q=gestPts(opt.gest,opt.gf||0,s,PFY-16,PFY-25,view);arm(PFX+q[1][0]*.8,q[1][1],s);}}
 if(pose==='duck'||pose==='tame'){const f=Number(frame)||0;arm(PFX+6+(f%3),PFY-5);}
 const W=opt.wpn?wpnParse(opt.wpn):pose==='fight'?{m:'fists',o:'',out:true}:null;
 if(!W)return;
 if(!W.out&&pose!=='fight'){if(W.m)drawOnBack(c,W.m,PFX-4,PFY-16,view);if(W.o)drawOnBack(c,W.o,PFX+2,PFY-15,view);return;}
 const state=pose==='fight'&&FIGHT_BODY[frame]?frame:'ready',style=WPN_STYLE[W.m]||'fist',table=FIGHT_ARM[style]||FIGHT_ARM.fist||FIGHT_ARM.blade;
 const f=table[state]||table.ready,A=f[0],tilt=f[1],reach=f[2]||4.2,hx=PFX+1+Math.sin(A)*reach,hy=PFY-16-Math.cos(A)*reach;
 arm(hx,hy);c.save();c.translate(hx,hy);if(style==='bow')drawBow(c,W.m,0,0,tilt,state==='windup'?[-4,1]:null);else if(W.m&&W.m!=='fists')drawWeapon(c,W.m,0,0,Math.sin(tilt),-Math.cos(tilt));c.restore();
 const q=(W.o==='wshield'?FIGHT_BACK.shield:FIGHT_BACK.free)[state]||[2,3],bx=PFX+q[0],by=PFY-16+q[1];arm(bx,by,-1);if(W.o==='wshield')drawShield(c,bx,by,view==='E'?2.3:3.3,4);else if(W.o)drawWeapon(c,W.o,bx,by,.4,-.9);
}
window.FantasyPublishedArt=FantasyPublishedArt;
