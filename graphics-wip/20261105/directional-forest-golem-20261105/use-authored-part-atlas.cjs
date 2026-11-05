const fs=require('fs'),p='D:/для игры/feod/output/fantasy/directional-forest-golem-20261105/prototype-forest-golem.js';let s=fs.readFileSync(p,'utf8');const start=s.indexOf(' function assemble('),end=s.indexOf(' function canonical',start);s=s.slice(0,start)+`
 function artPart(c,A,name,x,y,w,h,angle=0,mirror=false,anchor=[.5,.5]){const p=A.raster[name];if(!p)return;c.save();c.translate(x,y);c.rotate(angle);if(mirror)c.scale(-1,1);c.drawImage(p,-anchor[0]*w,-anchor[1]*h,w,h);c.restore()}
 function artBone(c,A,name,a,b,width,mirror=false){const p=A.raster[name];if(!p)return;const h=p.height,w=p.width,s0=h*.22,s1=h*.78,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||.1,axisScale=len/(s1-s0),normal=width/w;c.save();c.translate(...a);c.rotate(Math.atan2(dy,dx)-Math.PI/2);if(mirror)c.scale(-1,1);c.scale(normal,axisScale);c.drawImage(p,-w/2,-s0);c.restore()}
 function assemble(c,A,G){const go=A.family==='golem',back=A.view==='N'||A.view==='NE',side=A.view==='E',far=0,near=1;
 const leg=i=>{const t=G.legs[i];artBone(c,A,'thigh',t.hip,t.knee,go?25:19,i===0);artBone(c,A,'shin',t.knee,t.ankle,go?23:15,i===0);artPart(c,A,'foot',t.sole[0],t.sole[1],go?(side?30:29):(side?22:17),go?14:8,0,i===0&&!side,[.5,1]);};
 const arm=i=>{const t=G.arms[i],dx=t.hand[0]-t.el[0],dy=t.hand[1]-t.el[1],angle=Math.atan2(dy,dx)-Math.PI/2;artBone(c,A,'upper',t.sh,t.el,go?23:20,i===0);artBone(c,A,'lower',t.el,t.hand,go?21:16,i===0);const add=go?0:3,L=Math.hypot(dx,dy)||1;artPart(c,A,'hand',t.hand[0]+dx/L*add,t.hand[1]+dy/L*add+(go?1.5:0),go?24:15,go?21:14,angle,i===0);};
 leg(far);arm(far);leg(near);artPart(c,A,'torso',G.torso[0],G.torso[1]+(go?3:-5),go?(side?53:66):(side?49:58),go?43:46,0,false);
 const hp=A.raster.head,H=go?21:32,W=go?(side?26:27):(side?36:36),x=G.head[0],y=G.head[1];
 // Mouth movement belongs to the native pose; rear surfaces never acquire it.
 if(!back&&(G.P.mouth||0)>.03){const split=.77,upper=mk(hp.width,Math.ceil(hp.height*split)),lower=mk(hp.width,hp.height-upper.height+2);upper.getContext('2d').drawImage(hp,0,0);lower.getContext('2d').drawImage(hp,0,upper.height-2,hp.width,hp.height-upper.height+2,0,0,hp.width,hp.height-upper.height+2);const top=y-H*.61;c.save();c.fillStyle='#29271f';c.fillRect(x-W*.22,top+H*.66,W*.44,H*.16+(G.P.mouth||0)*(go?4.2:5));c.drawImage(upper,x-W/2,top,W,H*split);c.drawImage(lower,x-W/2,top+H*split-1+(G.P.mouth||0)*(go?4.2:5),W,H*(1-split)+1);c.restore();}
 else artPart(c,A,'head',x,y,W,H,0,false,[.5,.61]);
 if(!go){const P=A.raster.club,w=P.width,h=P.height,a=G.weapon.hand,b=G.weapon.tip,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),axisScale=len/(h*.75);c.save();c.translate(...a);c.rotate(Math.atan2(dy,dx)+Math.PI/2);c.scale(10/P.width,axisScale);c.drawImage(P,-w/2,-h*.90);c.restore();}
 arm(near);
 }
`+s.slice(end);
const a=s.indexOf(' api.ready=Promise.all(');s=s.slice(0,a)+`
 api.ready=Promise.all(['golem','troll'].map(async family=>{const meta=await fetch(base+family+'-rig-parts.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=base+family+'-rig-parts-pixel.png'});for(const view of api.sourceViews){const raster={};for(const [key,m]of Object.entries(meta.parts)){const[name,v]=key.split('|');if(v!==view)continue;const[x,y,w,h]=m.rect,cv=mk(w,h);cv.getContext('2d').drawImage(im,x,y,w,h,0,0,w,h);raster[name]=cv;}assets[family+'|'+view]={family,view,raster,meta};}})).catch(e=>errors.push(String(e))).then(()=>{api.loaded=errors.length===0;return api});
})();
`;fs.writeFileSync(p,s);
