'use strict';
// Approved atlas silhouettes are invariant for ordinary dwarves: colour-only.
// Explicit native HA choices replace only a semantic source component. The face,
// native action props, HA data model and saved unit state are preserved.
(() => {
 if(window.FantasyPublishedAppearanceArt)return;
 const previous=personSprite,previousPortrait=portraitURL,cache=new Map(),portraitCache=new Map(),bodyMasks=new WeakMap(),lastFrame=new Map(),K=2;
 const api=window.FantasyPublishedAppearanceArt={version:3,cache,portraitCache,resolve,render,base:previous,geometry,capLayout,removeHat:(u,v,p,f,o={})=>render(u,v,p,f,{...o,nohat:true}),ready:Promise.resolve(FantasyPublishedArt.ready)};
 function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.round(w*2)/2,Math.round(h*2)/2);}
 function oval(c,x,y,rx,ry,col){c.fillStyle=col;for(let yy=Math.floor((y-ry)*2)/2;yy<y+ry;yy+=.5){const q=(yy+.25-y)/ry;if(Math.abs(q)>=1)continue;const z=Math.sqrt(1-q*q)*rx,a=Math.ceil((x-z)*2)/2,b=Math.floor((x+z)*2)/2;if(b>a)c.fillRect(a,yy,b-a,.5);}}
 function shape(c,p,col){c.fillStyle=col;for(let y=Math.floor(Math.min(...p.map(a=>a[1]))*2)/2;y<Math.max(...p.map(a=>a[1]));y+=.5){const hits=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],q=y+.25;if((a[1]<=q&&b[1]>q)||(b[1]<=q&&a[1]>q))hits.push(a[0]+(q-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]*2)/2,z=Math.ceil(hits[i+1]*2)/2;if(z>x)c.fillRect(x,y,z-x,.5);}}}
 function rgb(s,fallback='#66834e'){return hexToRgb(typeof s==='string'&&/^#[0-9a-f]{3,6}$/i.test(s)?s:fallback);}
 function resolve(u){let holder=u,app=typeof haOf==='function'?haOf(u):null;if(!app&&u.type.includes('~')){const tail=u.type.slice(u.type.indexOf('~')+1).split('.').map(Number);if(tail.length===HA_MAX.length&&tail.every(Number.isInteger))app=haClean(tail);}if(u.type==='hero'){const t=app?haType(haBase(u),app):haBase(u);holder={...u,type:t,sx:personSex(u)};}const O=OUTFIT[holder.type]||OUTFIT.serf,sex=personSex(holder)==='f'||O.fem||holder.type==='waitress'?'f':'';const look=(holder.look>>>0)>=0x20000?holder.look:LOOK_POOL[(holder.look>>>0)%LOOK_POOL.length];holder={...holder,look,sx:sex};const L=lookOf(holder);const cap=O.cap==='serf'?L.serfCap:O.cap==='wizard'?'#6b527c':O.cap==='baker'?'#eee5d1':O.cap==='waitress'?'#efe8d9':typeof O.cap==='string'&&O.cap.startsWith('cls:')?O.tint||HA_CLS_CAP[O.cap.slice(4)]||'#9a9c99':O.cap;
  return{holder,app,O,L,sex,look,cap,coat:O.robe?O.robeCol||O.coat||L.green:O.coat||L.green,beard:L.bcol||BEARDS[L.beard%BEARDS.length],hair:O.fem?HAIR:L.hair||L.bcol||BEARDS[L.beard%BEARDS.length]};}
 function geometry(q,view,pose,frame,opt={}){const child=q.holder.type==='kid',a=FantasyArt.images[child?'gnome-child':q.sex==='f'?'gnome-woman-walk':'gnome-walk'];if(!a?.frames)return null;const f=pose==='walk'?Math.floor((frame%WALK_FRAMES)*8/WALK_FRAMES):0,row=view==='E'?1:view==='N'?2:0;const src=a.frames[child?((pose==='work'?4:0)+(pose==='walk'?Math.floor((frame%WALK_FRAMES)*4/WALK_FRAMES):pose==='work'?Math.floor((frame.f%WORK_FRAMES)*4/WORK_FRAMES):0)):row*8+f],s=Math.min((child?21:25)/a.maxW,(child?27:33)/a.maxH),dh=src[3]*s,top=PFY-Math.round(dh),[shear,dip]=fpaBodyMotion(view,pose,frame,opt);
  return{art:a,src,scale:s,dw:src[2]*s,top,dh,dip,shear,capY:top+dh*(q.sex==='f'?.22:.23),headY:top+dh*.30,child};}
 function transformed(c,G,fn){c.save();c.translate(PFX,PFY);c.transform(1,0,G.shear,1,0,G.dip);c.translate(-PFX,-PFY);fn();c.restore();}
 function bareCrown(c,q,G,view){const x=PFX+(view==='E'?-.4:0),y=G.capY+1,col=q.hair;oval(c,x,y+1.2,5.1,3.1,SKINS[q.L.skin%3][0]);oval(c,x-.1,y,5.3,2.7,shade(col,-.24));oval(c,x-1,y-.6,4.1,1.9,col);rect(c,x-2,y-1.5,3,.5,shade(col,.24));}
 function hair(c,q,G,view){const L=q.L,col=q.hair,x=PFX,y=G.headY-1,hs=(L.hs||0)%6;const H=[shade(col,.22),col,shade(col,-.32)];
  if(view==='N'){oval(c,x,G.capY+3,5,4,col);rect(c,x-1,G.capY+1,.5,5,H[0]);}
  // Temples/fringe retain a visible hair colour even under kerchief or bonnet.
  if(view!=='N'){for(const side of view==='E'?[-1]:[-1,1]){oval(c,x+side*4.8,y,1.2,3,col);rect(c,x+side*4.5-.2,y-1,.5,2,H[0]);}}
  c.save();c.translate(x,y);c.scale(1.12,.72);femHair(c,view,0,0,{...L,hs,hair:col,serfCap:q.cap,fem:true},{...q.O,fem:false});c.restore();
  if(hs===1&&view==='S')for(let i=0;i<5;i++){oval(c,x+5.6-i*.15,y+2+i*1.2,1,1,i%2?col:H[0]);if(i===4)rect(c,x+4.6,y+7,2,.5,'#bda164');}
  if(hs===4){const xx=view==='E'?x-5.5:x-5;oval(c,xx,y-1.4,2.4,2.2,H[2]);oval(c,xx-.3,y-1.8,1.7,1.5,col);rect(c,xx-1,y-2.2,2,.5,H[0]);}
  if(hs===5)for(const side of view==='E'?[-1]:[-1,1])for(let j=0;j<3;j++){oval(c,x+side*(4.7+j*.2),y+j*1.3,1.6,1.3,H[2]);oval(c,x+side*(4.7+j*.2)-.3,y+j*1.3-.3,1.1,.8,col);}
 }
 function beard(c,q,G,view){if(view==='N'||q.sex==='f'||q.L.noBeard)return;const x=PFX+(view==='E'?2:0),y=G.headY+1,col=q.beard,st=q.L.beardStyle||0,len=q.L.beardLen===2?8.6:6.2,w=view==='E'?3.4:5.2;
  let pts;if(st===0)pts=[[x-w,y],[x+w,y],[x+w*.9,y+len*.65],[x+2,y+len],[x-2,y+len],[x-w*.9,y+len*.65]];else if(st===1)pts=[[x-w,y],[x+w,y],[x+w*.75,y+len],[x+1,y+len-1.5],[x,y+len-2.5],[x-1,y+len-1.5],[x-w*.75,y+len]];else if(st===2)pts=[[x-w,y],[x+w,y],[x+w*.65,y+len*.6],[x,y+len+1],[x-w*.65,y+len*.6]];else if(st===3)pts=[[x-w,y],[x+w,y],[x+w*.95,y+len],[x-w*.95,y+len]];else pts=[[x-1.8,y+1],[x+1.8,y+1],[x+2,y+len*.7],[x,y+len],[x-2,y+len*.7]];
  shape(c,pts,shade(col,-.36));c.save();c.beginPath();c.moveTo(...pts[0]);for(const p of pts)c.lineTo(...p);c.closePath();c.clip();if(q.beardTexture){const T=q.beardTexture;c.drawImage(T.cv,...T.bounds,x-w,y,2*w,len+1);}else for(let k=-5;k<=5;k++){const xx=x+k;rect(c,xx,y+1,.8,len+1,k%3===0?shade(col,.13):k%3===1?col:shade(col,-.15));}c.restore();
  if(q.O.skBeard>=0){c.save();c.translate(x,G.headY);c.scale(1.15,q.O.skBeard===3?Math.max(.78,(PFY-G.headY-2)/15.6):.78);skinBeard(c,q.O.skBeard,view,0,0);c.restore();}
 }
 function moustache(c,q,G,view){if(view==='N'||q.sex==='f'||q.L.noBeard)return;const x=PFX+(view==='E'?1.5:0),y=G.headY-.1;c.save();c.translate(x,y);c.scale(1.1,.78);drawMoustache(c,view,0,0,q.beard,q.L.must);c.restore();}
 function capLayout(q,G,view){const child=G.child,profile=child||view==='E',eyeY=child?G.headY+2.05:q.sex==='f'?G.headY+.1:view==='E'?G.headY-1:G.headY-.2;return{view:child?'E':view,x:PFX+(child?1.1:0),eyeY,bottom:eyeY+1.3,anchor:eyeY-.15,profile};}
 function capClothPath(c,hx,b,s,tall,style){if(style!==4){capShape(c,hx,b,s,tall,style);return;}const X=x=>hx+x*s;c.beginPath();c.moveTo(X(-4.3),b);c.quadraticCurveTo(X(-4.6),b-tall*.7,X(-.4),b-tall*.96);c.quadraticCurveTo(X(3.6),b-tall*1.02,X(5.8),b-tall*.5);c.quadraticCurveTo(X(7.6),b-tall*.05,X(7.2),b+.55);c.quadraticCurveTo(X(6.2),b+.2,X(4.8),b-tall*.34);c.quadraticCurveTo(X(4.7),b-tall*.1,X(4.3),b);c.closePath();}
 function lowBrim(c,q,G,view){const H=capLayout(q,G,view),x=H.x,y=H.eyeY,col=q.cap,back=view==='N'&&!G.child,profile=H.profile;const outer=profile?(G.child?[[-6,-1.05],[-2,-1.1],[3,-.9],[6.6,-.35],[7.1,.25],[6.8,1.1],[3,1.2],[-3,1.05],[-5.9,.5]]:[[-6,-1.05],[-2,-1.1],[3,-.9],[7.6,-.35],[8.25,.25],[7.7,1.1],[3,1.2],[-3,1.05],[-5.9,.5]]):back?[[-6.2,-.9],[-3,-.55],[3,-.55],[6.2,-.9],[6,1],[3,1.2],[-3,1.2],[-6,1]]:[[-6.2,-1.05],[-3,-.7],[2,-.7],[6.2,-1.05],[6,1],[3,1.2],[-3,1.2],[-6,1]];const pts=outer.map(([a,b])=>[x+a,y+b]);shape(c,pts,shade(col,-.48));shape(c,outer.map(([a,b])=>[x+a*.95,y+b*.6-.25]),shade(col,-.08));shape(c,outer.slice(0,profile?6:4).map(([a,b])=>[x+a*.92,y+b*.45-.6]).concat([[x+4,y-.15],[x-4,y-.15]]),shade(col,.19));rect(c,x-4.5,y-.5,2,.5,shade(col,.31));rect(c,x+.5,y-.5,2.5,.5,shade(col,.22));if(profile)rect(c,x+5,y-.25,1.5,.5,shade(col,.17));if(q.O.cap==='waitress'){pline(c,x-4.8,y-.65,x-3.4,y+.45,'#b4a180',.5);pline(c,x+3.2,y+.45,x+4.7,y-.65,'#b4a180',.5);rect(c,x-2.5,y+.55,5,.5,'#c3b18c');rect(c,x-2,y-.9,2,.5,'#fff7df');for(const dx of[-3,-1,1,3])rect(c,x+dx,y+.2,.5,.5,'#d3c4a2');}if(q.O.rivets||q.O.cap==='cls:warrior'||q.O.cap==='cls:paladin'){rect(c,x-3.5,y+.25,.5,.5,'#d8ba78');rect(c,x+3.5,y+.25,.5,.5,'#d8ba78');}}
 function childCapNose(c,q,G,view){const H=capLayout(q,G,view),sk=SKINS[q.L.skin%3],x=H.x+6.9,y=H.bottom+.45;oval(c,x,y,1.65,1.1,sk[2]);oval(c,x+.15,y-.2,1.35,.85,sk[0]);rect(c,x+.3,y-.75,.7,.5,shade(sk[0],.15));rect(c,x-.8,y+.55,1,.5,sk[1]);}
 function cropCapBelow(cv,info,bottom){const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height);for(let i=0;i<info.M.face.length;i++)if(info.pos(i).y>bottom)im.data[i*4+3]=0;c.putImageData(im,0,0);}
 function drawHeadForeground(c,head,foreground){const w=head.width,h=head.height,cv=mkCanvas(w,h),o=cv.getContext('2d'),f=new ImageData(foreground,w,h),a=head.getContext('2d').getImageData(0,0,w,h).data;for(let i=0;i<w*h;i++)if(!a[i*4+3])f.data[i*4+3]=0;o.putImageData(f,0,0);c.drawImage(cv,0,0,PW,PH);}
 function cap(c,q,G,view,frame){const O=q.O,L=q.L,x=PFX+(G.child?1.1:0),y=G.capY,cap=q.cap,sway=Math.sin((Number(frame)||0)*.8)*.3;
  const cls=typeof O.cap==='string'&&O.cap.startsWith('cls:')?O.cap.slice(4):'',rise=O.skHat>=0?(O.skHat===0?14:O.skHat===4?10:O.skHat===5?12:11):cls?({mage:16,priest:14,warrior:12,barbarian:10,archer:12,druid:14,rogue:11,monk:4,bard:13,paladin:13}[cls]||14):O.cap==='baker'?14:q.sex==='f'&&(L.hs===2||L.hs===3)?8:(O.cap==='wizard'?15:CAP_TALL[L.capStyle||0]+(L.capStyle===9?4:2));
  const ys=Math.min(1.05,Math.max(.4,(y+Math.min(0,G.dip)-1.3)/rise));c.save();c.translate(x,y);c.scale(G.child?1.42:1.28,ys);
  if(O.skHat>=0)skinHat(c,O.skHat,view,0,0,sway);
  else if(typeof O.cap==='string'&&O.cap.startsWith('cls:'))coopHat(O.tint?haTintCtx(c,O.tint):c,O.cap.slice(4),view,0,0,sway);
  else if(q.sex==='f'&&(L.hs===2||L.hs===3))drawKerchief(c,view,0,0,cap,L.hs===3);
  else if(O.cap==='baker'||O.cap==='waitress')drawCap(c,{...O,cap:O.cap},view,0,0,sway,L,mulberry32(q.look+731));
  else {const style=O.cap==='wizard'?1:G.child?[8,2,3,0,7][(q.look>>>2)%5]:(L.capStyle||0),s=view==='E'?-1:L.capTip||1,tall=O.cap==='wizard'?13:CAP_TALL[style];c.save();c.beginPath();capClothPath(c,sway*.3,-1.1,s,tall,style);c.fillStyle=shade(cap,-.35);c.fill();c.clip();c.fillStyle=cap;c.fillRect(-3.8,-16,6,19);c.fillStyle=shade(cap,.18);c.fillRect(-3,-16,2,19);c.fillStyle=shade(cap,-.14);c.fillRect(1,-16,1.5,19);if(q.capTexture){const T=q.capTexture;c.drawImage(T.cv,...T.bounds,-5,-tall-1,10,tall+2);}c.restore();oval(c,0,-.4,4.9,1.4,shade(cap,-.33));oval(c,-.4,-.9,4.5,.8,shade(cap,.12));rect(c,-3,-1.2,5,.5,shade(cap,.27));if(style===8)oval(c,1.4*s,-1.1-tall,1.7,1.5,shade(cap,.27));if(style===4)oval(c,7.2*s,5.1,1.4,1.4,shade(cap,.27));if(style===9){acorn(c,-5.4*s,-tall*.9);acorn(c,5.4*s,-tall*.9);}if(O.cap==='wizard'){rect(c,-1,-6,.7,.7,'#e6c883');rect(c,1,-10,.6,.6,'#e6c883');}}
  if(view!=='N'&&(!q.app||q.app[8]>=0)){const d=view==='E'?-1:1,xx=-3.2*d;if(L.deco===0)twig(c,3.4*d,-1,d);else if(L.deco===1)oakLeaves(c,xx,-1,d);else if(L.deco===2)mushroom(c,xx,-1);else if(L.deco===3)feather(c,xx,-1,d);else if(L.deco===4)acorn(c,xx,-1);}
  if(O.candle&&view!=='N'){rect(c,-1,-3.8,2,3.5,'#d9d2ac');rect(c,-1,-1,2,1,'#967344');const f=Math.floor(Game.time*5)%4;shape(c,[[-.8,-4],[Math.sin(f)*.6,-7-f*.3],[1,-4]],f%2?'#eabf71':'#e0a254');rect(c,0,-5,.5,1,'#f3ddb0');}
  c.restore();
 }
 function foreground(c,q,view,pose,frame,opt){const u=q.holder;if(u.carry){c.save();c.translate(PFX,u.carry==='trunk'?13:23);if(u.carry==='trunk')c.scale(1.4,1.2);drawLoads(c,u.carry,opt.carryN||u.carryN||1);c.restore();}
  if(pose==='work'&&typeof fpaDrawWorkTool==='function')fpaDrawWorkTool(c,u,view,frame,opt);
  if(pose==='smoke'){const r=fpaSmokingRig(u,view,frame),hx=PFX+r.hand[0],hy=PFY+r.hand[1];pline(c,PFX+4,PFY-12,hx,hy,'#3e2c20',3);pline(c,PFX+4,PFY-12,hx,hy,q.coat,2);rect(c,hx,hy,2,2,SKINS[q.L.skin%3][0]);}

  fpaAction(c,u,view,pose,frame,opt);
 }

 function skinSeed(r,g,b){return r>130&&g>75&&b>35&&g/r>.60&&g/r<.83&&b/g>.48&&b/g<.87&&r-g>38;}
 function bodyTemplate(G){const cv=mkCanvas(PW*PART,PH*PART),c=cv.getContext('2d');c.scale(PART,PART);c.imageSmoothingEnabled=false;c.translate(PFX,PFY);c.transform(1,0,G.shear,1,0,G.dip);c.drawImage(G.art.image,...G.src,Math.round(-G.dw/2),Math.round(-G.dh),Math.round(G.dw),Math.round(G.dh));const out=mkCanvas(PW*K,PH*K),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(cv,0,0,out.width,out.height);return out;}
 function maskInfo(q,G,view,body){const w=body.width,h=body.height,raw=body.getContext('2d').getImageData(0,0,w,h).data,N=w*h,M={face:new Uint8Array(N),skin:new Uint8Array(N),hair:new Uint8Array(N),beard:new Uint8Array(N),cap:new Uint8Array(N)},rows=Array.from({length:h},()=>[w,-1]);
  const pos=i=>{const y=Math.floor(i/w)/K-G.dip,x=(i%w)/K-G.shear*(y-PFY);return{x,y};};
  for(let i=0;i<N;i++){const j=i*4;if(!raw[j+3])continue;const{x,y}=pos(i),r=raw[j],g=raw[j+1],b=raw[j+2],head=y>G.capY-2&&y<G.headY+4.5&&Math.abs(x-PFX)<9,seed=skinSeed(r,g,b);if(seed&&(head||y>G.headY+4&&y<PFY-1&&Math.abs(x-PFX)>6))M.skin[i]=1;
   if(head&&seed){M.face[i]=1;const centre=PFX+(view==='E'?3.2:0),limit=view==='E'?4.1:4.2;if(view!=='N'&&Math.abs(x-centre)<limit&&y>G.capY-.6){const yy=Math.floor(i/w);rows[yy][0]=Math.min(rows[yy][0],i%w);rows[yy][1]=Math.max(rows[yy][1],i%w);}}
  }
  for(let y=0;y<h;y++){const[a,b]=rows[y];if(b<a)continue;for(let x=a;x<=b;x++)if(raw[(y*w+x)*4+3])M.face[y*w+x]=1;}
  for(let i=0;i<N;i++){const j=i*4;if(!raw[j+3]||M.face[i]||M.skin[i])continue;const{x,y}=pos(i),r=raw[j],g=raw[j+1],b=raw[j+2];if(q.sex==='f'&&y>G.capY-2&&y<G.headY+(view==='N'?11:10)&&Math.abs(x-PFX)<9&&r>70&&g<r*.78&&b<g*.46&&(y<G.headY+1||view==='N'||view==='E'&&x<PFX-2||view==='S'&&Math.abs(x-PFX)>3))M.hair[i]=1;
   else if(q.sex!=='f'&&view==='N'&&y>G.capY&&y<G.headY+5&&Math.abs(x-PFX)<7&&r>g*1.25&&g>b*1.15)M.hair[i]=1;
   if(q.sex!=='f'&&view!=='N'&&y>G.headY+.5&&y<G.headY+11&&(view==='E'?x>PFX-.5&&x<PFX+9.5:Math.abs(x-PFX)<6.5)&&r>110&&g>90&&b>65&&r/g<1.22&&g/b<1.5)M.beard[i]=1;
  }
  for(const key of['hair','beard']){const seeds=M[key].slice();for(let i=0;i<N;i++){if(!raw[i*4+3]||M.face[i]||M.skin[i])continue;if(key==="hair"&&q.sex==="f"&&!(raw[i*4]<110||raw[i*4+1]<raw[i*4]*.8&&raw[i*4+2]<raw[i*4+1]*.7))continue;const x=i%w,y=Math.floor(i/w);for(let dy=-2;dy<=2;dy++){let found=false;for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&seeds[yy*w+xx]){M[key][i]=1;found=true;break;}}if(found)break;}}}
  for(let i=0;i<N;i++){if(!raw[i*4+3]||M.face[i]||M.hair[i]||M.beard[i]||M.skin[i])continue;const{x,y}=pos(i);if(y<G.capY+3.5&&Math.abs(x-PFX)<12)M.cap[i]=1;}
  return{w,h,raw,M,pos};
 }
 function makeParts(q,view,pose,frame,opt){const cv=mkCanvas(PW*PART,PH*PART),c=cv.getContext('2d');c.scale(PART,PART);foreground(c,q,view,pose,frame,opt);const out=mkCanvas(PW*K,PH*K),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(cv,0,0,out.width,out.height);return out;}
 function colour(q,G,view,source,info,fore){const out=mkCanvas(PW*K,PH*K),c=out.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0,out.width,out.height);const im=c.getImageData(0,0,out.width,out.height),d=im.data,original=new Uint8ClampedArray(d),f=fore.getContext('2d').getImageData(0,0,fore.width,fore.height).data,{M,raw,pos}=info,skin=rgb(SKINS[q.L.skin%3][0]),colours={skin,beard:rgb(q.beard),hair:rgb(q.hair),cap:rgb(q.cap),coat:rgb(q.coat),vest:rgb(q.O.vest||q.coat),skirt:rgb(q.O.skirt||q.coat)};
  for(let i=0;i<d.length/4;i++){const j=i*4;if(!original[j+3])continue;if(f[j+3]>100){for(let k=0;k<3;k++)d[j+k]=f[j+k];continue;}if(!raw[j+3])continue;const r=raw[j],g=raw[j+1],b=raw[j+2],lum=(r+g+b)/3;if(lum<48)continue;const{x,y}=pos(i);let key=null,level=1;if(M.skin[i]||M.face[i]&&skinSeed(r,g,b)){key='skin';level=Math.max(.64,Math.min(1.15,(r+g+b)/3/190));}else if(M.beard[i]){key='beard';level=Math.max(.25,Math.min(1.15,lum/211));}else if(M.hair[i]){key='hair';level=Math.max(.3,Math.min(1.38,lum/110));}else if(M.cap[i]){key='cap';level=Math.max(.28,Math.min(1.35,Math.max(r,g,b)/(q.sex==='f'?225:135)));}else if(r<=185&&b<=110&&g>r*.83&&g>b*1.35&&y>G.capY+1){key=q.sex==='f'||q.O.vest&&view!=='N'&&Math.abs(x-PFX)<6&&y>PFY-16&&y<PFY-7?'vest':'coat';level=Math.max(.3,Math.min(1.35,g/119));}else if(q.sex==='f'&&y>PFY-13&&y<PFY-2&&r>g*1.15&&g>b*1.2){key='skirt';level=Math.max(.3,Math.min(1.3,lum/94));}if(key)for(let k=0;k<3;k++)d[j+k]=Math.max(0,Math.min(255,Math.round(colours[key][k]*level)));}
  c.putImageData(im,0,0);return{cv:out,data:im,original,fore:f};
 }
 function maskCanvas(info,mask){const cv=mkCanvas(info.w,info.h),c=cv.getContext('2d'),im=c.createImageData(info.w,info.h);for(let i=0;i<mask.length;i++)if(mask[i])im.data[i*4+3]=255;c.putImageData(im,0,0);return cv;}
 function texture(info,paint,mask){const cv=mkCanvas(info.w,info.h),c=cv.getContext('2d'),im=c.createImageData(info.w,info.h);let x0=info.w,y0=info.h,x1=-1,y1=-1;for(let i=0;i<mask.length;i++)if(mask[i]){for(let j=0;j<4;j++)im.data[i*4+j]=paint.data.data[i*4+j];const x=i%info.w,y=Math.floor(i/info.w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}c.putImageData(im,0,0);return x1<0?null:{cv,bounds:[x0,y0,x1-x0+1,y1-y0+1]};}
 // The preserved base has a one-physical-pixel cap outline outside its raw mask.
 // Remove only detached old dark border fragments, before drawing new head/decor.
 function cleanupOldCapOutline(paint,info,G){const d=paint.data.data,{w,h,M,raw}=info,N=w*h,seen=new Uint8Array(N);let removed=0;
  const oldCapBorder=i=>{const j=i*4;if(raw[j+3]>=16||paint.fore[j+3]>=16||d[j]>90||d[j+1]>90||d[j+2]>90||info.pos(i).y>=G.headY-.5)return false;for(let k=0;k<4;k++)if(d[j+k]!==paint.original[j+k])return false;const x=i%w,y=Math.floor(i/w);let cap=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const z=yy*w+xx;if(M.face[z]||M.skin[z]||M.hair[z]||M.beard[z])return false;if(M.cap[z])cap=true;}return cap;};
  for(let i=0;i<N;i++){if(seen[i]||d[i*4+3]<80)continue;const points=[i];seen[i]=1;for(let at=0;at<points.length;at++){const z=points[at],x=z%w,y=Math.floor(z/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[k]||d[k*4+3]<80)continue;seen[k]=1;points.push(k);}}if(points.length>12||!points.every(oldCapBorder))continue;for(const z of points){d[z*4+3]=0;removed++;}}
  if(removed)paint.cv.getContext('2d').putImageData(paint.data,0,0);return removed;
 }
 function clearComponent(paint,info,mask,inpaint=false,q=null){const d=paint.data.data,source=new Uint8ClampedArray(d),{w,h,M}=info;for(let i=0;i<mask.length;i++){if(!mask[i]||M.face[i]||paint.fore[i*4+3]>100)continue;const j=i*4;if(!inpaint){d[j+3]=0;continue;}const x=i%w,y=Math.floor(i/w);let left=-1,right=-1;if(q&&q.sex==="f"&&y/K>14){if(q&&q.sex==="f"){const xx=Math.abs(x/K-PFX),yy=y/K;if(yy<17&&xx>4.3){d[j+3]=0;continue;}const sleeve=xx>5&&yy>=17&&yy<22,col=rgb(sleeve?"#e6d5b2":q.O.vest||q.coat),shadeFactor=sleeve?(.76+.22*Math.max(0,1-Math.abs(yy-19)/3)):.64+.24*Math.max(0,1-xx/6);for(let k=0;k<3;k++)d[j+k]=Math.round(col[k]*shadeFactor);continue;}let best=-1,dist=1e9;for(let xx=0;xx<w;xx++){const a=y*w+xx;if(!mask[a]&&!M.skin[a]&&!M.face[a]&&source[a*4+3]>100&&Math.abs(xx-w/2)<dist){best=a;dist=Math.abs(xx-w/2);}}if(best>=0){for(let k=0;k<3;k++)d[j+k]=source[best*4+k];continue;}}for(let q=x-1;q>=0;q--){const a=y*w+q;if(!mask[a]&&source[a*4+3]>100){left=a;break;}}for(let q=x+1;q<w;q++){const a=y*w+q;if(!mask[a]&&source[a*4+3]>100){right=a;break;}}if(left>=0&&right>=0){const dl=x-left%w,dr=right%w-x;for(let k=0;k<3;k++)d[j+k]=Math.round((source[left*4+k]*dr+source[right*4+k]*dl)/(dl+dr));}else d[j+3]=0;}paint.cv.getContext('2d').putImageData(paint.data,0,0);}
 function eraseProtected(layer,info){const c=layer.getContext('2d'),d=c.getImageData(0,0,layer.width,layer.height);for(let i=0;i<info.M.face.length;i++)if(info.M.face[i])d.data[i*4+3]=0;c.putImageData(d,0,0);}
 // The semantic mask depends on the atlas cell and its transform, not on the
 // dwarf's identity, profession colours or tool. Reuse it across those poses.
 function cachedMask(q,G,view){
  let masks=bodyMasks.get(G.art);
  if(!masks){masks=new Map();bodyMasks.set(G.art,masks);}
  const key=[G.src[0],G.src[1],q.sex,view,G.shear,G.dip].join('|');
  if(masks.has(key))return masks.get(key);
  const info=maskInfo(q,G,view,bodyTemplate(G));
  info.capCloth=info.M.cap.map((v,i)=>v&&info.pos(i).y<G.capY-.8?1:0);
  if(masks.size>=64)masks.delete(masks.keys().next().value);
  masks.set(key,info);
  return info;
 }
 const pendingDecorativeSprite=mkCanvas(1,1);pendingDecorativeSprite._pendingSprite=true;
 function render(u,view='S',pose='idle',frame=0,opt={}){if(view==='W')view='E';if(!u||!OUTFIT[u.type])return previous(u,view,pose,frame,opt);const q=resolve(u),G=geometry(q,view,pose,frame,opt);if(!G)return previous(u,view,pose,frame,opt);const ap=q.app,explicit=i=>!!ap&&ap[i]>=0,cls=typeof q.O.cap==='string'&&q.O.cap.startsWith('cls:'),hairChange=q.sex==='f'&&explicit(11),beardChange=q.sex!=='f'&&!q.L.noBeard&&(explicit(3)||explicit(4)||explicit(5)||explicit(13)),capChange=true,capeChange=explicit(14),special=capChange||beardChange||hairChange||capeChange;
  const {gf,...options}=opt,candle=capChange&&q.O.candle?Math.floor(Game.time*5)%4:0;
  const motion=JSON.stringify([q.holder.type,q.look,q.sex,view,pose,frame?.anim,options,u.carry,u.carryN,u.injury,candle]);
  const key=motion+'|'+(pose==='work'?frame.f:frame)+'|'+(opt.gest?gf||0:0);
  if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);u._spr=s;return s;}
  // Timing-sensitive external props (the thrown object, pipe, and combat FX)
  // are drawn after this sprite and must use the exact native frame.
  const canDefer=pose==='idle'||pose==='walk'||(pose==='work'&&frame.anim!=='toss'&&frame.f<8);
  const fallback=canDefer?cache.get(lastFrame.get(motion)):null;
  // A queued frame can reuse another phase of the same action and costume.
  // It never substitutes idle for a swing or a different tool/view.
  if(R.inFrame&&(fallback||u._decorativeSprite||(R.cam.z<=1&&canDefer))){
   const snapshot={...u,_spr:null};
   if(spriteDefer('fpa:'+key,()=>render(snapshot,view,pose,frame,opt)))return fallback||pendingDecorativeSprite;
  }
  if(R.inFrame)spriteBudgetOk(false);
  const t0=performance.now();
  const source=previous({...u,_spr:null},view,pose,frame,{...opt,nohat:false}),info=cachedMask(q,G,view),fore=makeParts(q,view,pose,frame,opt),paint=colour(q,G,view,source,info,fore);let out=paint.cv;
  if(special){if(beardChange)q.beardTexture=texture(info,paint,info.M.beard);if(!opt.nohat)q.capTexture=texture(info,paint,info.capCloth);if(capChange){clearComponent(paint,info,info.M.cap,false);if(!opt.nohat)cleanupOldCapOutline(paint,info,G);}if(beardChange)clearComponent(paint,info,info.M.beard,true);if(hairChange){const removeHair=info.M.hair.map((v,i)=>v&&info.pos(i).y>G.headY+5.2?1:0);clearComponent(paint,info,removeHair,true,q);}out=mkCanvas(PW*K,PH*K);const c=out.getContext('2d');c.scale(K,K);c.imageSmoothingEnabled=false;
   if(capeChange&&view!=='N'){c.save();c.translate(PFX,PFY);c.scale(1.75,1);skinCape(c,q.O.skCape,view,-13,-6,false);c.restore();}c.drawImage(paint.cv,0,0,PW,PH);
   const layer=mkCanvas(PW*K,PH*K),l=layer.getContext('2d');l.scale(K,K);l.imageSmoothingEnabled=false;
   if(capChange){const crown=mkCanvas(PW*K,PH*K),cc=crown.getContext('2d');cc.scale(K,K);transformed(cc,G,()=>bareCrown(cc,q,G,view));cc.setTransform(1,0,0,1,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(info.capMaskCanvas??=maskCanvas(info,info.M.cap),0,0);l.drawImage(crown,0,0,PW,PH);}
   transformed(l,G,()=>{if(hairChange)hair(l,q,G,view);if(beardChange){beard(l,q,G,view);moustache(l,q,G,view);}});eraseProtected(layer,info);c.drawImage(layer,0,0,PW,PH);
   let capLayer=null;if(capChange&&!opt.nohat){const H=capLayout(q,G,view);capLayer=mkCanvas(PW*K,PH*K);const hc=capLayer.getContext('2d');hc.scale(K,K);hc.imageSmoothingEnabled=false;transformed(hc,G,()=>{cap(hc,q,{...G,capY:H.anchor},H.view,frame);lowBrim(hc,q,G,view);});cropCapBelow(capLayer,info,H.bottom);if(G.child)transformed(hc,G,()=>childCapNose(hc,q,G,view));c.drawImage(capLayer,0,0,PW,PH);}
   if(capeChange&&view==='N'){c.save();c.translate(PFX,PFY);c.scale(1.6,1);skinCape(c,q.O.skCape,view,-13,-6,true);c.restore();}if(!ap&&!opt.nohat&&!cls){if(capLayer)drawHeadForeground(c,capLayer,paint.fore);}else c.drawImage(fore,0,0,PW,PH);
  }
  out._fantasyAppearance=true;out._fpaNoHat=!!opt.nohat;out._fpaColourOnly=!special;cache.set(key,out);if(cache.size>800)cache.delete(cache.keys().next().value);
  lastFrame.delete(motion);lastFrame.set(motion,key);if(lastFrame.size>800)lastFrame.delete(lastFrame.keys().next().value);
  if(R.inFrame)spriteSpent(t0);
  u._spr=out;return out;
 }
 personSprite=render;
 portraitURL=function(type,look=3,sx=''){if(!OUTFIT[type]||(UNIT_TYPES[type]&&UNIT_TYPES[type].animal))return previousPortrait(type,look,sx);const me=type==='hero'?(Game.hero?.look===look?Game.hero:Game.units.find(u=>u.type==='hero'&&u.look===look)):null,u=me||{type,look,sx},q=resolve(u),key=JSON.stringify([q.holder.type,q.look,q.sex]);if(portraitCache.has(key))return portraitCache.get(key);const s=render(u,'S','idle',0,{}),cv=mkCanvas(48,48),c=cv.getContext('2d');c.fillStyle='#263929';c.fillRect(0,0,48,48);c.imageSmoothingEnabled=false;c.drawImage(s,2,0,48,48,0,0,48,48);const url=cv.toDataURL();portraitCache.set(key,url);if(portraitCache.size>500)portraitCache.delete(portraitCache.keys().next().value);return url;};
 api.ready.then(()=>{cache.clear();portraitCache.clear();if(typeof PORTRAIT_CACHE!=='undefined')PORTRAIT_CACHE.clear();if(window.FantasyPublishedPortraits)FantasyPublishedPortraits.cache.clear();});
})();







