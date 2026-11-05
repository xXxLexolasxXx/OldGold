'use strict';
// Original 2 px/world spectral designs. Simulation, frame selectors, grab victims,
// health bars, combat phases, facing, world anchors and telegraphs remain native.
(() => {
 if(window.FantasyPublishedSpectral)return;
 const F={version:1,cache:new Map(),calls:{ghost:0,reaper:0},native:{ghostPxSprite,ghostPxFrame,reaperPxSprite,reaperPxFrame,ghostSprite,reaperSprite},coverage:{ghost:Object.keys(GPX_N),reaper:Object.keys(RPX_N)}};
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 function render(family,v,mood,f,n,hv=0,rag=''){
  f=Math.max(0,Math.min(n-1,f|0));const key=[family,v,mood,f,n,hv,rag].join('|');if(F.cache.has(key))return F.cache.get(key);
  const rp=family==='reaper',W=rp?81:60,H=rp?103:76,OX=rp?40:30,OY=rp?43:32;
  const cv=mkCanvas(W*2,H*2),c=cv.getContext('2d',{willReadFrequently:true});c.scale(2,2);c.translate(OX,OY);c.imageSmoothingEnabled=false;
  const phase=f/n*Math.PI*2,t=f/Math.max(1,n-1),atk=mood==='atk',boo=mood==='boo',hurt=mood==='hurt',die=mood==='die',flee=mood==='flee',calm=mood==='calm';
  const wind=atk?smooth(t/.35):0,strike=atk?smooth((t-.35)/.25):0,recoil=atk?smooth((t-.6)/.4):0,hit=hurt?(GPX_HURT[f]||0):0;
  const gp=!rp&&(mood==='grab'||mood==='carry')?(mood==='grab'?ghPoseLerp(t*GH_T[8]):ghPoseAt(8)):null;
  const lean=gp?gp.lean:atk?(-3*wind+9*strike)*(1-recoil):hurt?-4*hit+(GPX_SHK[f]||0)/3:flee?5:0;
  const bob=Math.sin(phase)*.65,hy=bob+(hurt?-hit:atk?strike-wind:0),hx=lean*.7,tail=rp?55:40;
  const P=rp?{out:'#221b27',dark:'#312b3d',mid:'#504153',light:'#796376',edge:'#b49a8d',trim:'#b78e50',bone:'#dfd2ad',shine:'#fff0c1'}:{out:'#23302d',dark:'#516956',mid:'#8eaa87',light:'#bed1a2',edge:'#e7dfb7',trim:'#aa8955',bone:'#e9dfb8',shine:'#fff2cb'};
  if(v==='B'&&!rp){P.dark='#53686a';P.mid='#93aaa0';P.light='#c4cfab';}if(v==='C'&&!rp){P.dark='#5c566b';P.mid='#a09caf';P.light='#d6d0bb';}
  if(hurt&&f<2){P.light='#fff2ce';P.mid='#d7c3a0';}
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,w,h);};
  const line=(x,y,X,Y,col,w=1)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='square';c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();};
  const poly=(p,col,out=true)=>{c.beginPath();c.moveTo(...p[0]);for(const q of p.slice(1))c.lineTo(...q);c.closePath();if(out){c.strokeStyle=P.out;c.lineJoin='miter';c.lineWidth=1.4;c.stroke();}c.fillStyle=col;c.fill();};
  const limb=(s,hand,far=false)=>{const sx=lean*.45+s*(rp?8:6.5),sy=hy+9,ex=(sx+hand[0])*.5+s*2,ey=(sy+hand[1])*.5+3;
   line(sx,sy,ex,ey,P.out,rp?6:4.5);line(ex,ey,hand[0],hand[1],P.out,rp?4:3.5);line(sx,sy,ex,ey,far?P.dark:P.mid,rp?4.5:3);line(ex,ey,hand[0],hand[1],P.bone,1.7);line(sx-1,sy,ex-1,ey,P.light,1);
   poly([[ex-2,ey-3],[ex+2,ey-2],[ex+2,ey+2],[ex,ey+3],[ex-3,ey]],far?P.dark:P.mid,false);line(ex-2,ey-2,ex,ey+1,P.light,.7);
   rect(hand[0]-1,hand[1]-1,3,3,P.bone);rect(hand[0]+1,hand[1],1,2,rp?'#9d927a':'#b5ae8c');for(let q=0;q<3;q++){const spread=gp?.7:boo||atk?1.5:1;line(hand[0]+q*.65,hand[1],hand[0]+3+q*.6,hand[1]+(q-1)*spread,P.shine,.65);}
  };
  const hands=[-1,1].map(s=>{
   if(gp)return(s<0?gp.hf:gp.hn).slice();
   if(atk)return [s*(rp?12:10)-3*wind+((rp?14:13)-s*2)*strike*(1-recoil),hy+10-(rp?24:23)*wind+30*strike*(1-recoil)];
   if(boo)return[s*(rp?14:12),hy-9+Math.sin(phase+s)*2];
   if(calm)return[s*5,hy+18];if(flee)return[s*6-9,hy+17+s*2];
   return [s*(rp?12:10)+Math.sin(phase+s),hy+17+Math.sin(phase*2+s)];
  });
  limb(-1,hands[0],true);
  // A tailored mantle and separately hanging strips replace the old SDF blob.
  const cloth=[];cloth.push([lean*.4-9,hy+7],[hx-7,hy+3],[hx+7,hy+3],[lean*.4+10,hy+9]);
  for(let i=0;i<10;i++){const yy=hy+11+(tail-11)*i/9,ww=(rp?11.5:9)*(1-i/14),dx=Math.sin(phase-i*.48)*(1+i*.45)+(flee?-i*.8:0)+lean*(1-i/12);cloth.push([dx+ww,yy]);}
  cloth.push([Math.sin(phase-4)*5-4,tail-3],[Math.sin(phase-3)*4-6,tail-8]);
  for(let i=8;i>=0;i--){const yy=hy+11+(tail-11)*i/9,ww=(rp?11.5:9)*(1-i/14),dx=Math.sin(phase-i*.48)*(1+i*.45)+(flee?-i*.8:0)+lean*(1-i/12);cloth.push([dx-ww,yy]);}
  poly(cloth,P.mid);
  // Sculpt the mantle with broad light clusters and curved pleats, not stripes.
  {const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),A=rgb(P.dark),B=rgb(P.light),target=rgb(P.mid),d=c.getImageData(0,0,cv.width,cv.height),z=d.data;
   for(let yy=0;yy<cv.height;yy++)for(let xx=0;xx<cv.width;xx++){const i=(yy*cv.width+xx)*4;if(!z[i+3]||z[i]!==target[0]||z[i+1]!==target[1]||z[i+2]!==target[2])continue;
    const wy=yy/2-OY,wx=xx/2-OX,depth=clamp((wy-hy-10)/(tail-9)),center=Math.sin(phase-depth*4)*(1+depth*4)+lean*(1-depth),width=(rp?12:10)*(1-depth*.45),nx=(wx-center)/width;
    const pleat=Math.cos((Math.floor((wx-center)*2)/2+Math.sin(wy*.12+phase)*1.3)*1.05),light=clamp(.56-nx*.28-depth*.15+pleat*.14),q=Math.round(light*6)/6;
    for(let j=0;j<3;j++)z[i+j]=Math.round(A[j]+(B[j]-A[j])*q);
   }c.putImageData(d,0,0);
  }
  for(let j=0;j<3;j++){const sx=lean*.4-6+j*6,sw=Math.sin(phase-j)*3,end=tail-7-(j%2)*8;
   poly([[sx-1,hy+16],[sx+2,hy+20],[sx+sw+1,end-6],[sx+sw-1,end],[sx+sw-2,end-3]],P.dark,false);
   line(sx-1,hy+17,sx+sw-1,end-5,P.light,.6);line(sx+sw-1,end-5,sx+sw-3,end-1,P.edge,.5);
  }
  // Broad shoulder collar, hem seams, hand-sewn patch, and small clasp.
  poly([[hx-9,hy+5],[hx,hy+11],[hx+9,hy+5],[lean*.4+12,hy+12],[hx,hy+17],[lean*.4-12,hy+12]],P.dark);
  poly([[hx-11,hy+7],[hx-7,hy+7],[hx-1,hy+13],[hx-2,hy+15],[hx-9,hy+12]],P.mid,false);
  poly([[hx+2,hy+14],[hx+8,hy+7],[hx+11,hy+9],[hx+8,hy+14],[hx+2,hy+17]],P.out,false);
  line(hx-10,hy+8,hx-3,hy+13,P.light,1);
  line(hx-9,hy+6,hx,hy+12,P.trim,1);line(hx,hy+12,hx+9,hy+6,P.trim,1);
  poly([[hx-2,hy+13],[hx,hy+11],[hx+2.5,hy+13],[hx+1.5,hy+16],[hx-1,hy+16]],P.trim);rect(hx-.5,hy+12,1.5,2,P.shine);rect(hx-.5,hy+14,1.5,1,rp?'#96626c':'#5c8b74');
  for(let j=0;j<3;j++){rect(hx-8+j*2,hy+8+j,.5,.5,P.trim);rect(hx+4+j*2,hy+10-j,.5,.5,P.trim);}
  const px=lean*.3-6,py=hy+22;poly([[px,py],[px+5,py-1],[px+5,py+5],[px+1,py+6]],P.dark,false);for(let j=0;j<3;j++)rect(px+j*2,py-1,.5,2,P.trim);
  if(rag==='T1')for(let j=0;j<3;j++){const yy=hy+23+j*7,xx=lean*.3+4+Math.sin(phase+j);line(xx-1,yy-1,xx+1,yy+2,P.trim,.5);line(xx-1,yy+1,xx+1,yy-1,P.trim,.5);}
  if(rag==='T2')for(let j=0;j<4;j++){const yy=hy+20+j*5;poly([[-5+j%2,yy],[2,yy+1],[-1,yy+3]],P.dark,false);}
  // Deep hood / cap silhouettes, a face framed by parchment cloth, no palette swap.
  const hoodTop=rp?(v==='R1'?-15:v==='R3'?-27:-25):v==='A'?-23:v==='B'?-16:-20;
  const tip=rp?(v==='R2'?(hv===0?12:hv===1?-10:-15):0):v==='A'?-11:v==='B'?8:0;
  poly([[hx-10,hy+5],[hx-12,hy-5],[hx-7,hy-15],[hx+tip,hy+hoodTop],[hx+4,hy+hoodTop+4],[hx+10,hy-10],[hx+11,hy+5],[hx+5,hy+9],[hx-6,hy+8]],P.dark);
  poly([[hx+tip,hy+hoodTop+1],[hx-6,hy-12],[hx-10,hy-5],[hx-9,hy-13]],P.mid,false);
  poly([[hx+tip+1,hy+hoodTop+2],[hx-2,hy-17],[hx+2,hy-12],[hx+5,hy-9],[hx+1,hy-18]],P.out,false);
  line(hx+tip+1,hy+hoodTop+2,hx-5,hy-14,P.light,.65);
  poly([[hx-6,hy-14],[hx-3,hy-17],[hx-1,hy-15],[hx-3,hy-12]],P.light,false);
  // A thick rolled hood edge catches warm light on the upper-left fold.
  poly([[hx-10,hy+4],[hx-11,hy-4],[hx-8,hy-11],[hx-3,hy-15],[hx+3,hy-15],[hx+9,hy-9],[hx+11,hy+2],[hx+7,hy+9],[hx,hy+12],[hx-7,hy+9]],P.mid,false);
  poly([[hx-9,hy+1],[hx-8,hy-6],[hx-4,hy-12],[hx+1,hy-13],[hx+3,hy-11],[hx-2,hy-10],[hx-6,hy-5],[hx-7,hy+3]],P.light,false);
  poly([[hx+5,hy-11],[hx+9,hy-6],[hx+10,hy+2],[hx+6,hy+8],[hx+1,hy+10],[hx+1,hy+7],[hx+6,hy+3],[hx+7,hy-4]],P.out,false);
  for(let j=0;j<4;j++)line(hx-9+j*.6,hy+3-j*2,hx-7+j*.6,hy+3-j*2,P.trim,.5);
  poly([[hx-8,hy+3],[hx-8,hy-6],[hx-3,hy-13],[hx+2,hy-13],[hx+8,hy-5],[hx+7,hy+5],[hx,hy+9]],P.out,false);
  line(hx-10,hy+3,hx-8,hy-8,P.light,1);line(hx-8,hy-8,hx+tip,hy+hoodTop,P.mid,1.5);line(hx+7,hy-8,hx+9,hy+3,P.edge,.7);
  if(!rp&&v==='B'){poly([[hx-5,hy+2],[hx+5,hy+2],[hx+6,hy+9],[hx+1,hy+18],[hx-4,hy+11]],P.light,false);for(let j=0;j<3;j++)line(hx-3+j*2,hy+5,hx-2+j*2,hy+12+(j%2)*3,P.edge,.65);}
  if(rp&&v==='R1'){poly([[hx-9,hy-9],[hx-5,hy-15],[hx+5,hy-15],[hx+9,hy-9],[hx+8,hy+2],[hx+5,hy-5],[hx-5,hy-5],[hx-8,hy+2]],'#6c625e');line(hx,hy-14,hx,hy-7,P.trim,1.5);}
  if(rp&&v==='R3')for(let j=-2;j<=2;j++){const yy=hy-16-Math.abs(j)*2;poly([[hx+j*3-1,hy-11],[hx+j*3,yy-4],[hx+j*3+2,hy-11]],P.bone,false);}
  // Sculpted bone: rounded brow vault, shaded temple, cheek planes and jaw.
  const boneShade=rp?'#998d75':'#aa9e7b',boneMid=rp?'#c4b894':'#d2c49a',boneHi='#f7e9bd';
  poly([[hx-4.5,hy-5],[hx-3,hy-7.5],[hx-.5,hy-8.5],[hx+2.5,hy-8],[hx+4.5,hy-6],[hx+5,hy-2],[hx+3.5,hy+1.5],[hx+2,hy+4.5],[hx-1.5,hy+5],[hx-4,hy+2]],boneShade,false);
  poly([[hx-4,hy-5],[hx-2.5,hy-7],[hx+.5,hy-7.5],[hx+3,hy-6],[hx+3.5,hy-3],[hx+2,hy-1],[hx-3,hy-1]],boneMid,false);
  poly([[hx-3,hy-5.5],[hx-1.5,hy-7],[hx+.5,hy-7],[hx+2,hy-6],[hx+.5,hy-5],[hx-2.5,hy-4.5]],boneHi,false);
  poly([[hx-4,hy-3],[hx-2,hy-4],[hx-.5,hy-2.5],[hx-1.5,hy-.5],[hx-3.5,hy]],P.out,false);
  poly([[hx+1,hy-3],[hx+3,hy-4],[hx+4,hy-2],[hx+3,hy],[hx+1,hy-.5]],P.out,false);
  line(hx-4,hy-3.5,hx-1,hy-4,P.bone,1);line(hx+.5,hy-3.5,hx+3,hy-4,P.bone,.7);
  poly([[hx-4,hy],[hx-2.5,hy-.5],[hx-1,hy+1],[hx-2,hy+2.5],[hx-4,hy+1.5]],boneHi,false);
  poly([[hx+2,hy+.5],[hx+4,hy-.5],[hx+3.5,hy+2],[hx+1.5,hy+2]],boneMid,false);
  poly([[hx,hy-.5],[hx+1.5,hy+2],[hx-.5,hy+2.5]],P.out,false);rect(hx-.5,hy-2,1,2.5,boneHi);
  const eye=atk||boo||gp?'#f29b55':calm?'#a9d4ef':rp?'#e1b26e':'#b3ddb4';
  rect(hx-3,hy-2,1.5,1,eye);rect(hx+1.5,hy-2,1.5,1,eye);rect(hx-2.5,hy-2,.5,.5,P.shine);rect(hx+2,hy-2,.5,.5,P.shine);
  const jaw=boo||atk||gp?2+Math.round(strike*2):0;
  poly([[hx-2.5,hy+2],[hx+2,hy+2],[hx+2,hy+4+jaw],[hx+.5,hy+5+jaw],[hx-2,hy+4.5+jaw]],boneMid,false);rect(hx-2,hy+2.5,4,jaw+1,P.out);
  for(let j=0;j<4;j++){rect(hx-1.5+j,hy+2.5,.5,1,P.bone);rect(hx-1.5+j,hy+3.5+jaw,.5,.5,boneHi);}
  if(!rp&&v==='C')for(let j=0;j<4;j++){line(hx-4,hy+18+j*3,hx+4,hy+18+j*3,P.bone,.7);rect(hx-.5,hy+16+j*3,1,3,P.light);}
  if(rp){
   // Three distinct horns/caps, native g.var stays intact.
   for(const s of [-1,1]){const xx=hx+s*8,yy=hy-10;
    const pts=hv===0?[[xx,yy],[xx+s*7,yy-1],[xx+s*7,yy-7],[xx+s*3,yy-9],[xx+s*1,yy-5],[xx+s*4,yy-3]]:hv===1?[[xx,yy],[xx+s*5,yy-7],[xx+s*3,yy-16],[xx+s*1,yy-8]]:[[xx,yy],[xx+s*8,yy-6],[xx+s*10,yy-13],[xx+s*4,yy-8]];poly(pts,P.trim);line(xx,yy,xx+s*4,yy-5,P.bone,.6);rect(xx+s*3,yy-3,1.5,1,'#dfbb77');rect(xx+s*5,yy-6,1,1,'#8c653d');
   }
   // The scythe retains the native pole angle, hand pivot and wind/strike curve.
   const a=atk?(-1.95-.5*wind)*(1-strike)+.15*strike:-1.25+Math.sin(phase)*.05;
   const hand=atk?[(24-18*wind+40*strike-20*recoil)/3,(30-34*wind+30*strike-10*recoil)/3]:boo?[34/3,-10/3]:[(30+Math.sin(phase+1)*2)/3,(26+Math.sin(phase*2)*3)/3];
   const ux=Math.cos(a),uy=Math.sin(a),top=[hand[0]+ux*30.5,hand[1]+uy*30.5],bot=[hand[0]-ux*21,hand[1]-uy*21];
   line(...bot,...top,P.out,2.7);line(...bot,...top,'#8a623d',1.5);line(bot[0]-.5,bot[1],top[0]-.5,top[1],'#c49a61',.5);
   const norm=[-uy,ux],q=(u,z)=>[top[0]+ux*u+norm[0]*z,top[1]+uy*u+norm[1]*z];
   poly([q(-1,0),q(2,3),q(1,12),q(-3,22),q(-7,27),q(-4,16),q(-3,7),q(-5,1)],'#a9b9ad');poly([q(0,3),q(1,10),q(-3,21),q(-7,27),q(-3,16),q(-2,5)],'#c9d3bd',false);poly([q(-5,1),q(-3,7),q(-4,16),q(-7,27),q(-5,14),q(-5,5)],'#697c79',false);line(...q(0,4),...q(-2,18),'#eef0d0',1);line(...q(-2,18),...q(-7,27),'#e0e3bd',.7);
   limb(1,hand);for(let j=0;j<3;j++)rect(hand[0]-1,hand[1]-1+j,3,.5,P.shine);
  }else limb(1,hands[1]);
  // Pixel wisps and seams move per native frame, not a new independent timer.
  for(let j=0;j<9;j++){const yy=tail-13+(j%3)*4,xx=Math.sin(phase+j*1.7)*(5+j*.7)+(flee?-8:0);rect(xx,yy,.5+j%2,.5,j%3?P.light:P.trim);}
  c.setTransform(1,0,0,1,0,0);const data=c.getImageData(0,0,cv.width,cv.height),d=data.data;
  for(let yy=0;yy<cv.height;yy++)for(let xx=0;xx<cv.width;xx++){const i=(yy*cv.width+xx)*4;d[i+3]=d[i+3]>=130?255:0;if(die&&d[i+3]){const wy=yy/2-OY,noise=((xx*17+yy*31+(xx*yy)%23)%67)/67,edge=tail-t*(tail+(rp?24:18));if(wy>edge+noise*8||t>=1)d[i+3]=0;else if(wy>edge-4&&noise>.4){d[i]=194;d[i+1]=177;d[i+2]=132;}}}
  c.putImageData(data,0,0);F.cache.set(key,cv);return cv;
 }
 ghostPxSprite=function(v,mood,f,rag=''){return render('ghost',v,mood,f,GPX_N[mood]||12,0,rag);};
 ghostPxFrame=function(g,v,mood,f,rag=''){F.calls.ghost++;return ghostPxSprite(v,mood,f,rag);};
 reaperPxSprite=function(v,mood,f,n=RPX_N[mood],hv=0,rag=RPX_RAG){return render('reaper',v,mood,f,n||12,hv,rag||'');};
 reaperPxFrame=function(g,v,mood,f,hv,rag=RPX_RAG){F.calls.reaper++;return reaperPxSprite(v,mood,f,RPX_N[mood],hv,rag);};
 ghostSprite=function(mood,i){const n=mood==='atk'?GHOST_ATK_FRAMES:mood==='grab'?9:mood==='carry'?4:GHOST_FRAMES;return render('ghost','A',mood,i,n);};
 reaperSprite=function(mood,i,v=0){return render('reaper','R2',mood,i,mood==='atk'?REAPER_ATK_FRAMES:REAPER_FRAMES,v%3);};
 ghostPxWarm=function(){if(typeof nightAmt==='function'&&nightAmt()<.1)return;for(const v of GHOST_PX)ghostPxSprite(v,'idle',0,'');};
 F.render=render;window.FantasyPublishedSpectral=F;
})();
