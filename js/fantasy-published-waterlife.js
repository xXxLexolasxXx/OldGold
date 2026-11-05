/* OldGold 0.12 presentation only. Waterlife: independent anatomical meshes rasterized at half-world pixels. */
'use strict';
(() => {
  if (window.FantasyWaterlife) return;
  const deps={SEA_ART:typeof SEA_ART!=='undefined',seaSprite:typeof seaSprite==='function',slDraw:typeof slDraw==='function',slDrawKraken:typeof slDrawKraken==='function',fishDraw:typeof fishDraw==='function',fishyDraw:typeof fishyDraw==='function',beDrawFish:typeof beDrawFish==='function',blitFine:typeof blitFine==='function'};
  const missing=Object.keys(deps).filter(k=>!deps[k]);
  if(missing.length){window.FantasyWaterlife={ready:false,errors:missing.map(k=>'Missing native dependency: '+k)};console.error('[FantasyWaterlife]',window.FantasyWaterlife.errors);return;}

  const kinds = new Set(['sprat','salmon','crab','star','urchin','jelly','turtle','hatch','shell','dolphin','whale','octo','serpent','tent','kraeye','mermaid','vodyanoy']);
  const cache = new Map(), turns = new WeakMap(), errors = [];
  const LIMIT = 768, BYTES = 24 * 1024 * 1024;
  let bytes = 0, hits = 0, misses = 0, active = null;
  const TAU = Math.PI * 2, quant = a => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  function direction(o) {
    let old = turns.get(o), a;
    if (Number.isFinite(o.a)) a = o.a;
    else if (Number.isFinite(o.tx) && Number.isFinite(o.ty) && Math.hypot(o.tx-o.x,o.ty-o.y) > .08) a = Math.atan2(o.ty-o.y,o.tx-o.x);
    else if (old && Math.hypot(o.x-old.x,o.y-old.y) > .0001) a = Math.atan2(o.y-old.y,o.x-old.x);
    const d = a === undefined ? old ? old.d : o.face < 0 ? 4 : 0 : quant(a);
    turns.set(o,{x:o.x,y:o.y,d}); return d;
  }
  function scope(o,fn) {const prev=active; active={o,d:direction(o),face:o.face||1};try{return fn();}finally{active=prev;}}
  function nativeFrame(k,a,f) {
    const n=SEA_ART[k].anims[a]||1, fine=(SEA_12.has(k)||k==='mermaid'||k==='vodyanoy')&&n>1, count=fine?12:n;
    const j=SEA_ONCE.has(a)&&fine?Math.max(0,Math.min(count-1,Math.floor(f*count/n))):((Math.floor(f*count/n)%count)+count)%count;
    return {j,count,p:SEA_ONCE.has(a)?j/Math.max(1,count-1):j/count};
  }
  const palettes={
    crab:['#391c22','#87372d','#c75b3e','#ee9561','#ffcf96'],
    salmon:['#162b3d','#425d70','#7e9fac','#c5d7d3','#f5e6cf'],
    sprat:['#142b3d','#29485b','#4d7489','#83acb9','#b6d8d5'],
    turtle:['#27362b','#46583a','#74864c','#aeb36c','#e0cd91'],
    jelly:['#3c284f','#76558d','#ad88ba','#dcb7d9','#f9e0ed'],
    star:['#613227','#a64a2c','#d9793f','#f2b06c','#ffe1a0'],
    urchin:['#211d32','#44304e','#6d446f','#9e6998','#d4a0ba'],
    shell:['#4b3541','#986e73','#c89b92','#edd1b4','#fff1d2'],
    dolphin:['#1a2e40','#3f596e','#6f8d9b','#a6bdc5','#dfebe0'],
    whale:['#172a3c','#2d455c','#526d82','#839ba8','#c3d6d0'],
    octo:['#482432','#853849','#bd5a63','#df9484','#f6ccb0'],
    serpent:['#192e30','#285448','#3d8060','#7caa73','#d8d4a0'],
    tent:['#352037','#613351','#985a7a','#c28c9d','#efd0bb'],
    mermaid:['#293b3c','#29685f','#4a9a80','#a4d2af','#efdfb9'],
    vodyanoy:['#263d32','#48634a','#749265','#a6b784','#e3dab0'],
    kraeye:['#352037','#613351','#985a7a','#c28c9d','#efd0bb'],
    gold:['#4c301d','#ab622c','#e9a343','#f6d473','#fff0b3'],
    red:['#4a2029','#9a3540','#d76556','#f3a17b','#ffddb4'],
    blue:['#1b2c47','#37588a','#598fc1','#9ac8de','#e0ecde'],
    amber:['#4f2d22','#9d5631','#d78a49','#edbb7f','#ffe0ac'],
    pink:['#49263e','#91456b','#cc78a2','#eaaac5','#ffe1df'],
    teal:['#183b3e','#286e6b','#53a89a','#96d6bd','#e1f0d1']
  };
  // All geometry is in anatomical (forward, right, height) coordinates. Faces carry depth,
  // so the body itself occludes far eyes/limbs in rear views; no frontal sprite squeezing.
  function model(g, ax, ay, d, C, water, transform) {
    const ang=d*Math.PI/4, ca=Math.cos(ang),sa=Math.sin(ang), faces=[];
    function proj(v){let [u,r,z]=transform?transform(v):v;let X=u*ca-r*sa,Y=u*sa+r*ca;return [ax+X,ay+Y*.55-z,Y*.835+z*.55];}
    function face(v,color){const pp=v.map(proj);let norm=[];const A=v[0],B=v[1],D=v[2];const U=B.map((x,i)=>x-A[i]),V=D.map((x,i)=>x-A[i]);norm=[U[1]*V[2]-U[2]*V[1],U[2]*V[0]-U[0]*V[2],U[0]*V[1]-U[1]*V[0]];const L=Math.hypot(...norm)||1;const ny=(norm[0]*sa+norm[1]*ca)/L,nz=norm[2]/L;
      if(ny*.835+nz*.55 < -.01) return;
      const nx=(norm[0]*ca-norm[1]*sa)/L;
      let c=typeof color==='string'?color:C[Math.max(1,Math.min(4,Math.round(2.05-nx*.7+ny*.1+nz*.8+color)))];
      faces.push({p:pp,c,depth:pp.reduce((s,p)=>s+p[2],0)/pp.length});}
    function ball(u,r,z,ru,rr,rz,col=0,seg=12,rings=6) {
      const p=(i,j)=>{const a=i/seg*TAU,b=-Math.PI/2+j/rings*Math.PI;return[u+Math.cos(a)*Math.cos(b)*ru,r+Math.sin(a)*Math.cos(b)*rr,z+Math.sin(b)*rz];};
      for(let j=0;j<rings;j++)for(let i=0;i<seg;i++)face([p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)],col);
    }
    function tube(A,B,r1,r2,col=0,seg=7){const V=B.map((x,i)=>x-A[i]),len=Math.hypot(...V)||1,N=V.map(x=>x/len),base=Math.abs(N[2])<.9?[0,0,1]:[0,1,0],X=[N[1]*base[2]-N[2]*base[1],N[2]*base[0]-N[0]*base[2],N[0]*base[1]-N[1]*base[0]],xl=Math.hypot(...X);for(let i=0;i<3;i++)X[i]/=xl;const Y=[N[1]*X[2]-N[2]*X[1],N[2]*X[0]-N[0]*X[2],N[0]*X[1]-N[1]*X[0]],pt=(T,r,i)=>T.map((v,j)=>v+r*(X[j]*Math.cos(i/seg*TAU)+Y[j]*Math.sin(i/seg*TAU)));for(let i=0;i<seg;i++)face([pt(A,r1,i),pt(A,r1,i+1),pt(B,r2,i+1),pt(B,r2,i)],col);ball(...A,r1,r1,r1,col,8,4);}
    function fin(v,col=0){face(v,col);face([...v].reverse(),col);}
    function eye(u,r,z,size=.45){ball(u,r,z,size,size*.62,size,'#f3ddad',8,4);ball(u+size*.82,r+(r<0?-1:1)*size*.32,z+size*.1,size*.48,size*.7,size*.55,'#192331',8,4);}
    function finish(alpha=1){
      faces.sort((a,b)=>a.depth-b.depth);
      g.globalAlpha=alpha;
      // Scanline rasterization: no Canvas vector antialiasing. Native backing is exactly x2.
      for(const F of faces){const p=F.p.map(v=>[v[0]*2,v[1]*2]);const min=Math.floor(Math.min(...p.map(v=>v[1]))),max=Math.ceil(Math.max(...p.map(v=>v[1])));g.fillStyle=F.c;
        for(let y=min;y<max;y++){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))xs.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const x=Math.ceil(xs[i]-.5),end=Math.ceil(xs[i+1]-.5);if(end>x)g.fillRect(x,y,end-x,1);}}
      }
      g.globalAlpha=1;
    }
    return{ball,tube,fin,eye,finish};
  }
  function outline(cv,C){const g=cv.getContext('2d'),im=g.getImageData(0,0,cv.width,cv.height),src=new Uint8ClampedArray(im.data),D=im.data,w=cv.width,h=cv.height;const color=C[0].match(/\w\w/g).map(x=>parseInt(x,16));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(src[i+3])continue;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const q=((y+dy)*w+x+dx)*4;if(src[q+3]){D[i]=color[0];D[i+1]=color[1];D[i+2]=color[2];D[i+3]=src[q+3];break;}}}g.putImageData(im,0,0);}
  function build(k,a,p,d,meta) {
    const {w,h,ax,ay}=meta,cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;cv.fine=2;const g=cv.getContext('2d'),C=(k==='salmon'&&a==='swim')?palettes.sprat:(palettes[k]||palettes.turtle);
    const s=Math.sin(p*TAU),once=Math.sin(p*Math.PI),die=a==='die',fade=die?1-p*.8:1;
    let T=(k==='mermaid'||k==='vodyanoy')&&a==='dive'?([u,r,z])=>[u,r,z-p*18]:null,water=false;
    if((k==='salmon'||k==='dolphin')&&a==='jump') {const lift=once*(k==='salmon'?7:13),pitch=(.5-p)*1.5,cs=Math.cos(pitch),sn=Math.sin(pitch);T=([u,r,z])=>[u*cs+z*sn+(k==='dolphin'?(p*22-11):0),r,z*cs-u*sn+lift];}
    if(a!=='jump'&&['salmon','dolphin','whale','kraeye'].includes(k)){const prev=T,offset=Math.abs(Math.sin(d*Math.PI/4))*(k==='whale'?11:k==='dolphin'?3.6:k==='kraeye'?9:2);T=v=>{const [u,r,z]=prev?prev(v):v;return[u,r,z+offset];};}
    if(['serpent','tent','kraeye'].includes(k)){const base={serpent:[124,72],tent:[64,100],kraeye:[68,40]}[k];if(w<base[0]){const prev=T;T=v=>{const [u,r,z]=prev?prev(v):v;return[u*w/base[0],r*w/base[0],z*h/base[1]];};}}
    const M=model(g,ax,ay,d,C,water,T),{ball,tube,fin,eye}=M;
    const E=(u,r,z,ru,rr,rz,col=0)=>ball(u,r,z,ru,rr,rz,col);
    if(k==='crab'){
      const sink=a==='hide'?p*6:0,z=4-sink+(a==='idle'?s*.22:0),lift=a==='atk'?once*2:0;
      // Four pairs of walking legs, two articulated chelipeds. Ventral death surface is separate.
      for(const side of [-1,1])for(let i=0;i<4;i++){const u=-2.2+i*1.4,v=side*(4.1+i*.25),step=a==='walk'?Math.sin(p*TAU+i*1.7+side)*.8:0;const A=[u,side*2.4,z],B=[u-.9,v,die&&p>.32?z+1.5:z-.7+step],D=[u-1.7,v+side*.9,die&&p>.32?z+2.5:Math.max(.1,1-sink+step)];tube(A,B,.38,.27,-.3);tube(B,D,.27,.11,-.7);}
      E(0,0,z,3.3,3.5,1.45,die&&p>.32?1:0);E(-.4,0,z+.85,2.5,2.5,.65,die&&p>.32?'#e7b991':.1);for(let i=0;i<5;i++){const u=-2+i;for(const side of [-1,1]){E(u,side*2.7,z+.6,.4,.45,.25,-.25);fin([[u-.35,side*2.7,z+.5],[u,side*3.5,z+.5],[u+.35,side*2.7,z+.5]],-.2);}}for(const side of [-1,1])tube([-1.8,side*1.2,z+1.44],[1.2,side*1.5,z+1.15],.07,.07,-.6);
      for(const side of [-1,1]){const A=[1.8,side*2.2,z],B=[3,side*3.6,z-.25+lift],D=[4.4,side*3.6,z-.8+lift];tube(A,B,.5,.4,-.4);tube(B,D,.4,.5,0);E(...D,1.15,.7,.65,.2);const gape=a==='atk'?(.2+once*.9):.35+s*.1; tube([4.6,side*3.85,z-.8+lift],[5.9,side*(3.8+gape),z-.8+lift],.42,.12,.5);tube([4.6,side*3.3,z-.8+lift],[5.8,side*(3.35-gape),z-.75+lift],.36,.1,0);if(!die||p<.32){tube([2.1,side*1.3,z+.8],[2.9,side*1.3,z+2],.18,.22,-.5);eye(2.95,side*1.3,z+2,.55);}}
      if(die&&p>.32)for(let i=0;i<4;i++)tube([-.8+i*.7,-2,z+1.25],[-.8+i*.7,2,z+1.25],.1,.1,'#a67c69');
    } else if(k==='turtle'||k==='hatch'){
      const q=k==='hatch'?.33:1,z=3*q,b=(a==='swim'?s: a==='walk'?s*.5:0)*q;
      for(const side of [-1,1])for(const end of [-1,1]){const A=[end*2.6*q,side*2*q,z-.6*q],B=[(end*3.7+b*side)*q,side*3.6*q,z-.5*q+(end===1?b:-b)*.4],D=[(end*4.9+b*side)*q,side*3.9*q,z-1.7*q];fin([A,[B[0]+q,B[1],B[2]],D,[B[0]-q,B[1],B[2]]],-.3);tube(A,B,.55*q,.35*q,-.4);}
      tube([-3.8*q,0,z],[-5.5*q,0,z-.3*q],.55*q,.12*q,-.5);
      const head=a==='idle'?saL([2,2,1,0,1,2],p*6)/2:1;if(head>.05){tube([3*q,0,z],[(3.1+head*2.3)*q,0,z+.25*q],.8*q,.65*q,.1);E((3+head*3)*q,0,z+.4*q,1.15*q,.8*q,.8*q,.2);for(const side of [-1,1])eye((3.7+head*3)*q,side*.6*q,z+.65*q,.25*q);}
      E(0,0,z,4.1*q,2.8*q,2*q,-.3);E(-.2,0,z+.25*q,3.65*q,2.45*q,1.85*q,.2);
      // Raised scutes with visible seams, in body coordinates rather than a painted screen cross.
      for(let u=-2;u<=2;u+=2)for(const r of [-1.25,0,1.25]){const zz=z+Math.sqrt(Math.max(.05,1-(u/4)**2-(r/2.8)**2))*2*q;E(u*q,r*q,zz,.83*q,.62*q,.12*q,((u+r)%2)>.5?.4:-.4);}
    } else if(k==='star'){
      E(0,0,1,1.1,1.1,.6,.2);for(let i=0;i<5;i++){const an=i*TAU/5,sx=Math.cos(an),sy=Math.sin(an),curl=i===1?s*.65:0;tube([sx*.5,sy*.5,1],[sx*2.5,sy*2.5,.65+curl],.65,.35,.1);tube([sx*2.5,sy*2.5,.65+curl],[sx*3.5,sy*3.5,.3+curl],.35,.1,-.2);E(sx*1.8,sy*1.8,1.15,.2,.2,.15,1);}
    } else if(k==='urchin'){
      E(0,0,1.3,2.1,2,1.55,-.5);for(let ring=0;ring<3;ring++)for(let i=0;i<12;i++){const an=i*TAU/12+ring*.4,z=.4+ring*.9,r=2.2-ring*.35;const A=[Math.cos(an)*r,Math.sin(an)*r,z],B=[Math.cos(an)*(r+1.1),Math.sin(an)*(r+1.1),z+.5+ring*.1+Math.sin(i+p*TAU)*.1];tube(A,B,.15,.025,i%3===0?.8:-.6,5);}
    } else if(k==='shell'){
      if(p>=.5){E(0,0,1,2.5,1.8,1.1,.2);tube([-2,0,1],[2,0,1],.14,.14,-.7);E(-.4,-.6,1.8,1.2,.5,.2,.6);}else for(let i=0;i<9;i++){const an=(-.8+i/8*1.6)*Math.PI;const tip=[Math.cos(an)*2.5,Math.sin(an)*2.5,1+Math.sin(i/8*Math.PI)*.9];tube([1.7,0,.5],tip,.2,.38,i%2?.2:.7,5);}E(.9,0,.4,1,1,.4,-.3);
    } else if(k==='jelly'){
      const pulse=a==='swim'?s*.6:a==='atk'?once*.8:-p*.6,drop=die?p*3:0;
      for(let i=0;i<8;i++){const an=i*TAU/8,r=2.6;let prev=[Math.cos(an)*r,Math.sin(an)*r,6-drop];for(let j=1;j<=6;j++){const v=[Math.cos(an)*(r+Math.sin(j*.9+p*TAU+i)*.55+(a==='atk'?once*j*.35:0)),Math.sin(an)*r,6-drop-j*.8];tube(prev,v,.16,.13,i%2?-.1:.3,5);prev=v;}}
      E(0,0,7-drop,4.2+pulse,3.8+pulse,2.5-pulse,.3);E(0,0,6.7-drop,3,2.7,1.7,-.2);for(let i=0;i<4;i++){const an=i*TAU/4;E(Math.cos(an)*1.35,Math.sin(an)*1.35,8.7-drop,.5,.5,.15,1);}
    } else if(k==='octo'){
      const z=5+(a==='swim'?s*.5:0);for(let i=0;i<8;i++){const an=i*TAU/8,stretch=a==='atk'?once*2:0;let prev=[Math.cos(an)*1.5,Math.sin(an)*1.5,z-2];for(let j=1;j<=5;j++){const r=1.5+j*(.7+stretch*.1),bend=Math.sin(p*TAU+i+j*.7)*.45;const v=[Math.cos(an)*r+Math.sin(an)*bend,Math.sin(an)*r-Math.cos(an)*bend,Math.max(.3,z-2-j*.55)+Math.sin(j*.7+p*TAU+i)*.5];tube(prev,v,.65-j*.09,.56-j*.09,j%2?-.3:.1);if(j<4)E(v[0],v[1],v[2]-.1,.18,.18,.18,1);prev=v;}}
      E(-.6,0,z+2,3.3,2.8,4.2,.2);E(1.5,0,z,2.1,2.4,1.7,-.1);for(const side of [-1,1])eye(2.4,side*1.7,z+1,.55);
      if(die)for(let i=0;i<5;i++)E(Math.cos(i*2.4)*p*6,Math.sin(i*2.4)*p*4,1,1+p*2,1+p,1,'#393045');
    } else if(k==='mermaid'||k==='vodyanoy'){
      const mer=k==='mermaid',breath=s*.15,skin=mer?'#e2b99a':'#9cad78',hair=mer?'#a34d67':'#4c7752',lightHair=mer?'#d27a88':'#6e9860';
      if(mer){
        // One continuous seated fish-tail. Paired caudal lobes, never human legs.
        let prev=[-.5,0,5];for(let j=1;j<=9;j++){const t=j/9,v=[-.5+t*5.2,Math.sin(t*2+p*TAU)*.6,5-t*4];tube(prev,v,1.7*(1-t)+.3,1.7*(1-t)+.15,.1,10);if(j%2===0)E(v[0],v[1]+.65,v[2]+.55,.23,.2,.12,.6);prev=v;}
        for(const side of [-1,1])fin([[4.6,0,1],[6.4,side*1.9,1.7+s*.3],[4.6,side*1.4,.6]],.7);
        E(0,0,8.7+breath,1.5,1.6,2.9,skin);E(.3,0,7,1.4,1.7,.8,.2);
        for(const side of [-1,1]){E(.65,side*.95,9.6,1,.8,.6,.4);const A=[0,side*1.5,10.5],B=[.5,side*2.2,8.7],D=[1.3,side*2.1,7.2+(side===1?s*.25:0)];tube(A,B,.45,.34,skin);tube(B,D,.34,.25,skin);E(...D,.4,.3,.5,skin);for(let i=0;i<3;i++)tube([D[0]+.15,D[1]+(i-1)*.16,D[2]],[D[0]+.55,D[1]+(i-1)*.16,D[2]-.2],.08,.06,skin);}
        // Back hair is a real rear surface. Forehead/fringe stays forward only.
        E(-.4,0,13.7,1.65,1.8,2.2,hair);E(.3,0,13.7,1.55,1.45,1.85,skin);E(-.45,0,15.1,1.5,1.7,.9,lightHair);for(const off of [-.7,0,.7]){tube([-1.2,off,15.2],[-1.7,off+s*.1,12],.13,.1,lightHair);tube([-1.7,off+s*.1,12],[-1.25,off+s*.2,9.7],.1,.08,hair);}
        for(const side of [-1,1]){tube([-.55,side*1.35,14],[.05+s*.2,side*1.65,8.4],.62,.28,hair);tube([-.9,side*.55,14.3],[-1.4,side*.8,9.3],.65,.35,lightHair);eye(1.6,side*.65,14.1,.28);}
        E(1.7,0,13.5,.35,.3,.35,skin);tube([1.72,-.35,12.9],[1.72,.35,12.9],.09,.09,'#a94e63');
      }else{
        E(0,0,3.7,3,3.7,2.8,-.1);E(.1,0,7.8,2.1,2.3,2.8,skin);E(2,0,7.5,.9,.6,.65,skin);
        for(const side of [-1,1]){tube([0,side*2.5,5.5],[1.3,side*3.1,3.6],.65,.5,skin);E(1.5,side*3.1,3.5,.65,.5,.5,skin);eye(1.8,side*1.05,8.7,.4);tube([1.65,side*.6,9.35],[1.55,side*1.65,9.2],.18,.22,'#52714b');}
        for(let i=-2;i<=2;i++){tube([1.5,i*.7,7],[1.7+Math.cos(i)*.25,i*.6,3.7+Math.abs(i)*.3],.57,.2,hair);tube([2.1,i*.6,6.5],[2.2,i*.5,4.5+Math.abs(i)*.2],.15,.08,lightHair);}
        // Lily pad, cream flower, wooden pipe and quantized smoke follow the same anatomy.
        E(-.2,0,10.6,2.6,2.9,.4,'#487249');E(-.3,0,10.9,2.1,2.5,.18,'#6f955d');for(let i=0;i<6;i++){const an=i*TAU/6;E(-.2+Math.cos(an)*.65,Math.sin(an)*.65,11.4,.6,.3,.3,'#e7dfb5');}E(-.2,0,11.6,.4,.4,.35,'#d3b354');
        tube([2.2,.7,6.6],[3.5,2.3,5.8],.17,.17,'#765536');E(3.6,2.4,6,.4,.4,.6,'#8d6843');if(a==='idle'&&p>.15&&p<.85)for(let i=0;i<3;i++)E(3.6+Math.sin(p*TAU+i)*.3,2.4,7+i*.7+p,.18+i*.04,.18,.24,'#bbc5b3');
      }
    } else if(k==='tent'){
      let H=64,bend=s*5;
      if(a==='rise')H=10+p*50;
      if(a==='atk'){const f=p*8;H=f<3?64+f*6:f<6?82-(f-3)*24:10+(f-6)*16;bend=f<3?-f*3.4:f<6?7+(f-3)*5:10-(f-6)*3;}
      if(die){H=Math.max(2,64-p*56);bend=Math.sin(p*10)*8;}
      let prev=[0,0,0];for(let i=1;i<=28;i++){const t=i/28,hook=t>.75?(t-.75)**2*115:0,v=[bend*t*t+hook,Math.sin(t*3+p*TAU)*1.2,H*t],rad=8.3*(1-t)+1;tube(prev,v,8.3*(1-(i-1)/28)+1,rad,i%4===0?-.2:0,9);
        if(i%2===0&&t<.92)for(const side of [-1,1]){const u=v[0]+rad*.82,r=v[1]+side*rad*.4,size=1.25*(1-t)+.25;E(u,r,v[2],size*.55,size,size,'#d5a5ad');E(u+.4,r,v[2],size*.24,size*.4,size*.4,'#795066');}
        if(i%3===0&&t<.92){E(v[0]-rad*.93,v[1],v[2],.35,rad*.32,.85,-.65);for(const side of [-1,1])E(v[0]-rad*.65,v[1]+side*rad*.65,v[2]+.5,.4,.4,.6,-.35);}
        if(i%4===0&&t<.9){tube([v[0]+rad*.8,v[1],v[2]],[v[0]+rad+2,v[1],v[2]+.8],.35,.025,'#ddd0ad');E(v[0]-.7,v[1]-rad*.9,v[2],.7,.3,1,-.7);}
        prev=v;}
      E(...prev,2.1,2.1,2.1,-.1);for(let i=0;i<6;i++){const an=i*TAU/6;tube([prev[0]+Math.cos(an)*1.5,prev[1]+Math.sin(an)*1.5,prev[2]],[prev[0]+Math.cos(an)*3.8,prev[1]+Math.sin(an)*3.8,prev[2]+1],.45,.05,'#ddd0ad');}
    } else if(k==='kraeye'){
      for(const side of [-1,1]){let prev=[-8,side*27,0];for(let j=1;j<=10;j++){const t=j/10,v=[-8-t*5,side*(27-t*t*13),t*26+Math.sin(t*3+p*TAU)*.5];tube(prev,v,3.3*(1-(j-1)/10)+.3,3.3*(1-t)+.3,-.2);if(j%2===0)E(v[0]+1.5*(1-t),v[1],v[2],.5,.7,.7,'#d6a8b2');prev=v;}}
      E(0,0,5,22,24,12,0);E(-5,0,9,18,19,8,.2);for(const [u,r,z]of [[-3,-15,15],[3,15,15],[-12,-7,17],[-13,8,17],[8,17,12],[10,-16,12]])E(u,r,z,1.5,1.2,.6,-.4);for(const side of [-1,1]){E(20,side*8,8,3,4.8,3.8,'#dab45c');tube([21,side*3.5,10.2],[21,side*12.5,12.2],.75,.9,-.8);if(p<.45||p>.65){E(22.7,side*8,8,.7,3.3,.5,'#231b29');E(22.8,side*9.5,9.3,.55,.55,.55,'#fff0c7');}else E(20,side*8,8,3,3,.6,-.4);}for(let i=-2;i<=2;i++){E(-8+i*6,0,14,2,2,.7,.3);for(const side of [-1,1]){E(-8+i*6,side*10,13,1,.8,.4,-.6);tube([-10+i*5,side*15,11],[-7+i*5,side*17,9.8],.22,.2,-.6);}}
      for(const side of [-1,1])for(let j=0;j<3;j++)tube([14-j*1.6,side*(4+j),12.2+j*.3],[17-j*1.4,side*(9+j),12.3-j*.2],.3,.22,-.7);
    } else if(k==='serpent'){
      let prev=[-48,0,0];for(let i=1;i<=26;i++){const u=-48+i*3,r=Math.sin(i*.45+p*TAU)*3,z=2+Math.max(0,Math.sin(i*.53+p*TAU))*10*(die?1-p:1),v=[u,r,z],rad=2+Math.sin(i/26*Math.PI)*4;tube(prev,v,Math.max(1,rad-.2),rad,0,10);
        for(const side of [-1,1]){E(u-.5,r+side*rad*.86,z+rad*.32,.7,.23,.5,i%3===0?.2:-.55);if(i%2===0)E(u+.2,r+side*rad*.58,z+rad*.72,.5,.35,.18,.45);}
        fin([[u-1.1,r,z+rad*.94],[u-.25,r-.6,z+rad],[u+.45,r,z+rad*.94],[u-.25,r+.6,z+rad]],-.35);
        if(i%2===0){fin([[u-2,r,z+rad*.8],[u,r,z+rad+4],[u+2,r,z+rad*.8]],'#ac613e');}prev=v;}
      fin([[-46,0,2],[-54,0,8+s],[-51,0,2],[-54,0,-1],[-45,0,1]],'#a8523d');const lift=die?(1-p):1,atk=a==='atk'?once:0;const head=[39+atk*5,0,(29+atk*9)*lift];tube([28,0,7], [32,0,head[2]-6],5,4,0,12);tube([32,0,head[2]-6],head,4,5,.2,12);E(...head,7,4,4,.3);for(const off of [-3,0,3])for(const side of [-1,1])E(head[0]+off,side*1.8,head[2]+3.7,.6,.45,.15,-.4);for(let j=1;j<6;j++){const t=j/6;for(const side of [-1,1])tube([29+t*8,side*3.6,8+t*(head[2]-12)],[31+t*8,side*3.6,9+t*(head[2]-12)],.16,.16,-.45);}
      E(head[0]+5,0,head[2]-1,4,3,2,'#c9ba80');for(const side of [-1,1]){E(head[0]+2.5,side*3.3,head[2]+1,1.1,.7,.85,'#cc593b');E(head[0]+2.7,side*3.7,head[2]+1,.3,.25,.7,'#231e25');fin([[head[0]-3,side*3,head[2]],[head[0]-10,side*7,head[2]+4],[head[0]-7,side*6,head[2]],[head[0]-10,side*7,head[2]-3]],'#9b4b39');tube([head[0]-2,side*2,head[2]+3],[head[0]-7,side*4,head[2]+9],1.1,.1,'#d8cfad');}for(let i=-1;i<=1;i++)tube([head[0]-2, i*1.1,head[2]+3],[head[0]-6-i, i*1.6,head[2]+7-Math.abs(i)],.6,.06,'#d8cfad');for(let j=0;j<3;j++)for(const side of [-1,1])tube([head[0]+4+j*1.3,side*2,head[2]-1],[head[0]+4+j*1.3,side*2,head[2]-3],.3,.03,'#e4d6b2');if(atk>.5){E(head[0]+6,0,head[2]-2,2.7,2.5,1.8,'#512d31');for(const side of [-1,1])tube([head[0]+6,side*2,head[2]-1],[head[0]+6,side*2,head[2]-3],.5,.04,'#f1e0b9');}
    } else {
      const isWhale=k==='whale',isDolphin=k==='dolphin',small=k==='sprat',isSalmon=k==='salmon';
      const fairy=!isWhale&&!isDolphin&&!small&&!isSalmon;
      const L=isWhale?20:isDolphin?6.5:fairy?(meta.w===34?12:9):isSalmon?5.7:2.4;
      const R=isWhale?4:isDolphin?1.7:fairy?(meta.w===34?2.6:3.7):isSalmon?1.3:.7;
      const z=isWhale?2:isDolphin?2.5:fairy?5.3:isSalmon?(a==='swim'?.8:2.2):1;
      const wag=s*(isWhale?.9:isDolphin?.8:fairy?1.1:.5);
      // Complete tapered body rings with a broad head, narrow caudal peduncle and bifurcated tail.
      let prev=[-L*.8,0,z];for(let i=1;i<=12;i++){const t=i/12,u=-L*.8+t*L*1.65,v=[u,Math.sin((1-t)*2)*wag,z],rad=R*(.35+Math.sin(t*Math.PI)*.65);tube(prev,v,Math.max(R*.25,rad*.92),rad,0,10);prev=v;}
      if(isDolphin)tube([L*.7,0,z],[L*1.1,0,z-.35],R*.55,R*.18,.3);
      const tail=[-L*.87,Math.sin(p*TAU)*R*.7,z],tip=-L*(fairy?1.45:1.12);
      if(isWhale||isDolphin){for(const side of [-1,1])fin([tail,[tip,side*R*1.8,z+wag*.6],[-L*.83,side*R*1.2,z+.1]],-.2);}
      else fin([tail,[tip,tail[1]+wag,z+R*1.5],[-L*1.05,tail[1]+wag,z],[tip,tail[1]+wag,z-R*1.5]],.2);
      fin([[-L*.2,0,z+R*.6],[-L*.4,0,z+R*(isWhale?1.6:2.1)],[L*.2,0,z+R*.8]],-.4);
      for(const side of [-1,1]){fin([[L*.3,side*R*.7,z],[L*.02,side*R*1.7,z-R*.7],[-L*.25,side*R*.8,z-.2]],side<0?-.5:.2);eye(L*.65,side*R*.65,z+R*.3,small?.15:isWhale?.4:isDolphin?.3:fairy?.65:.28);}
      if(fairy||isSalmon)for(let i=0;i<6;i++)for(const side of [-1,1])E(-L*.4+i*L*.14,side*R*.93,z+(i%2?.35:-.2),.25,.08,.19,.6);
    }
    M.finish(fade);outline(cv,C);
    // Burrowing sand, surface waterline and native spout/splash are outside the animal geometry.
    g.scale(2,2);
    if(k==='crab'&&a==='hide'){g.fillStyle='#ac8961';g.fillRect(ax-7,ay-2-p*3,14,1+p*3);g.fillStyle='#ddc28e';g.fillRect(ax-6,ay-2-p*3,12,.5);}
    if((['whale','dolphin','turtle','serpent','tent','kraeye','mermaid','vodyanoy'].includes(k))&&a!=='jump'&&a!=='walk'&&!(k==='turtle'&&a==='idle')){g.fillStyle='#a9cfcb';g.fillRect(ax-(k==='whale'?18:k==='kraeye'?24:k==='tent'?7:k==='serpent'?43:6),ay-.5,k==='whale'?36:k==='kraeye'?48:k==='tent'?14:k==='serpent'?86:12,.5);}
    if(k==='whale'&&a==='spout'){const height=[4,9,13,14,12,8][Math.min(5,Math.floor(p*5.99))];g.fillStyle='#d7e9df';g.fillRect(ax+7,ay-height,1,height);for(const side of [-1,1])for(let j=0;j<5;j++)g.fillRect(ax+7+side*j*(.6+p),ay-height+j*j*.18,.5,j%2?1:.5);}
    // Preserve the native impact-particle beat (native pose ~5), with world-root offsets.
    if(a==='atk'&&Math.round(p*8)===5&&(k==='tent'||k==='serpent')){g.fillStyle='#e4eee5';const points=k==='tent'?[[-10,-6],[10,-10],[-14,-16],[14,-3],[0,-22]]:[[48,-12],[50,-5],[44,-20],[52,-16]];const scale=w/(k==='tent'?64:124);for(const [x,y]of points)g.fillRect(ax+x*scale,ay+y*scale,Math.max(.5,scale),Math.max(.5,scale));}
    if(a==='jump'&&(p===0||p===1)){g.fillStyle='#e5eee5';for(let i=0;i<5;i++)g.fillRect(ax-5+i*2.5,ay-(i%2)*1.5,.5,1);}
    return{cv,ax,ay};
  }
  function get(k,a,f,d=0,override){
    const A=override||SEA_ART[k];if(!A) return null;
    const meta=override||{w:A.px&&typeof PX_FINE!=='undefined'&&PX_FINE>1?A.pw:A.w,h:A.px&&typeof PX_FINE!=='undefined'&&PX_FINE>1?A.ph:A.h,ax:A.px&&typeof PX_FINE!=='undefined'&&PX_FINE>1?A.pax:A.ax,ay:A.px&&typeof PX_FINE!=='undefined'&&PX_FINE>1?A.pay:A.ay};
    const F=override?{j:((Math.floor(f)%12)+12)%12,p:((Math.floor(f)%12)+12)%12/12}:nativeFrame(k,a,f),key=[k,a,d,F.j,meta.w,meta.h].join(':');
    if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);hits++;return v;}
    misses++;const value=build(k,a,F.p,d,meta),size=value.cv.width*value.cv.height*4;
    while(cache.size&&(cache.size>=LIMIT||bytes+size>BYTES)){const key=cache.keys().next().value,old=cache.get(key);bytes-=old.cv.width*old.cv.height*4;cache.delete(key);}if(size<=BYTES){cache.set(key,value);bytes+=size;}return value;
  }
  const originals={seaSprite,slDraw,slDrawKraken,fishDraw,fishyDraw,sprFish,sprFishN,beDrawFish};
  seaSprite=function(k,a,f){if(!kinds.has(k))return originals.seaSprite(k,a,f);const dir=active?active.d:0,face=active?active.face:1;return get(k,a,f,face<0?(4-dir+8)%8:dir);};
  slDraw=function(c,o){if(o.k==='mermaid'||o.k==='vodyanoy')return scope(o,()=>{const a=o.st==='dive'?'dive':o.k==='mermaid'?'sit':'idle';seaBlit(c,o.k,a,a==='dive'?Math.min(6,o.ph*7):o.ph*3,o.x*TILE,o.y*TILE+4,o.face,o.k==='mermaid'?.95:1);});if(!kinds.has(o.k)&&o.k!=='shoal')return originals.slDraw(c,o);return scope(o,()=>originals.slDraw(c,o));};
  // Kraken callbacks are deferred. Preserve the exact native list/depth, hit frame and health-bar code.
  slDrawKraken=function(list,c,vis){const start=list.length;originals.slDrawKraken(list,c,vis);const K=SL().kr;if(!K)return;const objs=[];if(vis(K.x,K.y))objs.push(K);for(const t of K.tents)if(t.st!=='dead'&&vis(t.x,t.y))objs.push(t);for(let i=start;i<list.length;i++){const fn=list[i][1],o=objs[i-start];if(o)list[i][1]=()=>scope(o,fn);}};
  function wrapList(fn,field){return function(list,c,F,...args){if(field==='fishy'){for(const o of F.fishy||[]){const start=list.length;fn(list,c,{...F,fishy:[o]},...args);for(let i=start;i<list.length;i++){const draw=list[i][1];list[i][1]=()=>scope(o,draw);}}}else{const start=list.length;fn(list,c,F,...args);for(let i=start;i<list.length;i++){const draw=list[i][1],o=F.fish;if(o)list[i][1]=()=>scope(o,draw);}}};}
  fishDraw=wrapList(originals.fishDraw,'fish');fishyDraw=wrapList(originals.fishyDraw,'fishy');
  function fishSprite(kind,fr,narrow){const d=active?active.d:0,face=active?active.face:1,local=face<0?(4-d+8)%8:d;const meta=narrow?{w:34,h:14,ax:17,ay:11}:{w:28,h:16,ax:14,ay:12};const cv=get(kind,'swim',fr>=30?fr-30:fr,local,meta).cv;
    // sprFishN's native jumping branch reads raw width/height without fine metadata.
    if(narrow){const key=['nativeN',kind,local,fr>=30?(fr-30)%12:fr%12].join(':');if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v.cv;}const small=document.createElement('canvas');small.width=34;small.height=14;small.getContext('2d').imageSmoothingEnabled=false;small.getContext('2d').drawImage(cv,0,0,34,14);small.fine=1;const size=34*14*4;while(cache.size&&(cache.size>=LIMIT||bytes+size>BYTES)){const key=cache.keys().next().value,old=cache.get(key);bytes-=old.cv.width*old.cv.height*4;cache.delete(key);}cache.set(key,{cv:small,ax:17,ay:14});bytes+=size;return small;}return cv;}
  sprFish=(kind,fr)=>fishSprite(kind,fr,false);sprFishN=(kind,fr)=>fishSprite(kind,fr,true);
  beDrawFish=function(c,o){return scope(o,()=>{const px=o.x*TILE,py=o.y*TILE,j=Math.max(0,o.jump),h=j>0?Math.sin(j*Math.PI)*13:0;
    c.save();c.fillStyle=j>0?'rgba(8,24,40,0.25)':'rgba(8,24,40,0.32)';c.beginPath();c.ellipse(px,py+1,j>0?5:6,j>0?1.8:2.2,0,0,7);c.fill();
    const sp=get('salmon',j>0?'inland':'swim',o.ph*10,active.d,{w:12,h:8,ax:6,ay:4});c.globalAlpha*=j>0?1:.4;c.imageSmoothingEnabled=false;c.translate(Math.round(px),Math.round(py-h-(j>0?3:0)));if(j>0)c.rotate((j-.5)*1.5*(o.face||1));blitFine(c,sp.cv,-sp.ax,-sp.ay+2.5);c.restore();
    if(j>0){const glint=Math.sin(j*Math.PI*3);if(glint>.3){c.fillStyle='#ffffff';c.fillRect(Math.round(px)+2,Math.round(py-h-6),1,1);c.fillRect(Math.round(px)+1,Math.round(py-h-5),3,1);c.fillRect(Math.round(px)+2,Math.round(py-h-4),1,1);}}c.imageSmoothingEnabled=R.smooth;
  });};
  const api=window.FantasyWaterlife={version:'waterlife-directional-1',ready:true,errors,kinds:[...kinds],originals,sprite:get,direction,stats:()=>({entries:cache.size,bytes,hits,misses,maxEntries:LIMIT,maxBytes:BYTES}),clear:()=>{cache.clear();bytes=0;},palettes};
})();
