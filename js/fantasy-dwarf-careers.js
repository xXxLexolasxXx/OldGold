'use strict';
// Render-only working poses on the infirmary and stable's native anchors.
// The workers keep their accepted heads, outfits, feet and simulation state.
function fpaArrangeCareYard(base,type,artBox){
 if(type!=='infirmary'&&type!=='stable')return base;
 const [x,y,w,h]=artBox,bottom=y+h,out={...base,_artBox:artBox.slice()};
 if(type==='infirmary'){
   const left=14,right=base.w-14,floor=base.h-4;
   const door=base.doorPt?.[0],corridor=Number.isFinite(door)?[door-10,door+10]:null;
   const bedLeft=left+34,bedRight=right-34;
   const spans=corridor&&corridor[0]<bedRight&&corridor[1]>bedLeft
     ?[[bedLeft,Math.min(bedRight,corridor[0])],[Math.max(bedLeft,corridor[1]),bedRight]].filter(([a,b])=>b-a>=10)
     :[[bedLeft,bedRight]];
   const rows=[];
   for(let yy=Math.max(bottom+18,floor-7);yy<=floor-1;yy+=3)
     for(const [a,b]of spans)if(b-a>=10)rows.push([[half(a),half(yy)],[half(b),half(yy)]]);
   // The props and the native 18-second route consume these same anchors.
   // A tall sprite reserves its full head clearance below the architecture.
   out.beds=rows.length?rows:[[[bedLeft,floor-1],[bedRight,floor-1]]];
   out.rack=[right-12,floor-4];out.cauldron=[left+10,floor-2];
   const flipped=base._artRotation===1||base._artRotation===2;
   out._careLayout={fit:floor-19>=bottom+1&&rows.length>0,floor,architecture:artBox.slice(),corridor,flipped,stirSide:flipped?-1:1};
 }else{
   out._careStation=fpaCareStableStation(out,artBox);
 }
 return out;
 function half(n){return Math.round(n*2)/2;}
}
function fpaCareStableStation(spr,box){
 const overlaps=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
 const obstacles=[box];
 const pens=(spr.penRects||[]).map(([a,b])=>[Math.min(a[0],b[0])-20,Math.min(a[1],b[1])-27,
   Math.abs(b[0]-a[0])+40,Math.abs(b[1]-a[1])+34]);
 obstacles.push(...pens);
 if(spr.cartSpot)obstacles.push([spr.cartSpot[0]-30,spr.cartSpot[1]-35,60,42]);
 if(spr.doorPt)obstacles.push([spr.doorPt[0]-8,box[1]+box[3],16,Math.max(0,spr.h-box[1]-box[3])]);
 const r=spr.penRects?.[0];if(!r)return null;
 const center=[(r[0][0]+r[1][0])/2,(r[0][1]+r[1][1])/2];
 const face=spr._artRotation===1||spr._artRotation===2?-1:1;
 let best=null,bestScore=Infinity;
 for(let py=20;py<=spr.h-3;py+=2)for(let px=10;px<=spr.w-10;px+=2){
   const bounds=[px-(face<0?11:7),py-19,18,21];
   if(bounds[0]<2||bounds[0]+bounds[2]>spr.w-2||obstacles.some(o=>overlaps(bounds,o)))continue;
   const score=Math.hypot(px-center[0],py-center[1])+Math.abs(py-(box[1]+box[3]+22))*.2;
   if(score<bestScore){bestScore=score;best={foot:[px,py],trough:[px+face*5,py-4.5],face,fit:true,bounds};}
 }
 // Keep an explicit failed layout for the inspector, instead of silently
 // hiding the worker or accepting a clipped actor behind the building.
 const fallbackX=face>0?10:spr.w-10;
 return best||{foot:[fallbackX,spr.h-3],trough:[fallbackX+face*5,spr.h-7.5],face,fit:false,
   bounds:[fallbackX-(face<0?11:7),spr.h-22,18,21],obstacles};
}
(() => {
 if(typeof window==='undefined'||window.FantasyDwarfCareers)return;
 const api=window.FantasyDwarfCareers={version:1,drawHealer,drawStableYard,healerRig,stableLayout};
 const bodies=new Map(),buffer=mkCanvas(112,112),S=.78*2/3;
 const half=n=>Math.round(n*2)/2;
 const poly=(c,p,color)=>fpaSowPolygon(c,p,color);
 const band=(c,a,b,w,color)=>fpaSowBand(c,a,b,w,color);
 function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(half(x),half(y),Math.max(.5,half(w)),Math.max(.5,half(h)));}
 function ready(){return window.FantasyPublishedAppearanceArt&&FantasyPublishedArt.images['gnome-walk']&&FantasyPublishedArt.images['gnome-woman-walk'];}
 function bodyFor(actor,view,walk,frame){
   const source=personSprite({...actor,carry:null,_exactYardPose:true},view,walk?'walk':'idle',walk?frame:0);
   if(!source._fantasyAppearance)return null;
   const key=[actor.type,actor.look,actor.sx,view,walk?frame:'idle'].join('|');
   if(bodies.has(key)){const out=bodies.get(key);bodies.delete(key);bodies.set(key,out);return out;}
   const cv=mkCanvas(source.width,source.height),c=cv.getContext('2d',{willReadFrequently:true});
   c.drawImage(source,0,0);
   fpaCleanAtlasArms(cv,{...actor,carry:null},view,'yardGrip',0);
   const cloth=OUTFIT[actor.type].coat||'#506e54';
   c.save();c.scale(cv.width/PW,cv.height/PH);c.translate(PFX,PFY);
   c.clearRect(-13,-15,26,9);
   poly(c,[[-5.5,-15],[-2.5,-16],[4.5,-14.5],[5.5,-10],[4.5,-6],[-4.5,-6],[-5.5,-8]],'#332a22');
   poly(c,[[-4.8,-14.5],[-2,-15],[4,-14],[4.6,-10],[3.8,-6.5],[-4,-6.5],[-5,-8.5]],shade(cloth,-.22));
   poly(c,[[-4.3,-13.5],[1.5,-14],[3.7,-12],[3.7,-9],[-4,-9]],cloth);
   band(c,[-4,-8],[3.8,-8],1,'#74583e');
   // Restore the actual head/cheek/beard foreground after the torso repair.
   c.drawImage(source,0,0,source.width,(PFY-17.5)*2,-PFX,-PFY,PW,PFY-17.5);
   if(view==='E')c.drawImage(source,(PFX+.5)*2,(PFY-17.5)*2,20,10,.5,-17.5,10,5);
   else c.drawImage(source,(PFX-5.5)*2,(PFY-17.5)*2,22,10,-5.5,-17.5,11,5);
   c.restore();
   bodies.set(key,cv);if(bodies.size>64)bodies.delete(bodies.keys().next().value);
   return cv;
 }
 function sleeve(c,start,grip,cloth,dark=false){
   const elbow=[(start[0]+grip[0])*.5-.65,(start[1]+grip[1])*.5+1.1];
   const cuff=[grip[0]+(elbow[0]-grip[0])*.26,grip[1]+(elbow[1]-grip[1])*.26];
   band(c,start,elbow,dark?5:5.5,'#332a22');band(c,elbow,grip,dark?4.5:5,'#332a22');
   band(c,start,elbow,dark?4:4.5,shade(cloth,dark?-.23:0));
   band(c,elbow,grip,dark?3.5:4,shade(cloth,dark?-.23:0));
   band(c,[elbow[0]-.4,elbow[1]-.5],[cuff[0]-.4,cuff[1]-.5],1,shade(cloth,dark?-.08:.22));
   band(c,cuff,grip,4,shade(cloth,dark?-.02:.3));
   return elbow;
 }
 function herbs(c,x,y,k=1){
   for(const [dx,h,col]of [[-2.1,5.5,'#668948'],[0,7,'#8ba05b'],[2,5,'#546c3b']]){
     band(c,[x+dx*k,y],[x+dx*.55*k,y-h*k],.65*k,'#a2ad65');
     poly(c,[[x+dx*.7*k,y-h*.8*k],[x+(dx-2)*k,y-h*k],[x+(dx-1)*k,y-h*.55*k]],col);
     poly(c,[[x+dx*.7*k,y-h*.55*k],[x+(dx+1.5)*k,y-h*.8*k],[x+(dx+1)*k,y-h*.35*k]],col);
   }
   band(c,[x-2*k,y-1.2*k],[x+2*k,y-1.2*k],.8*k,'#c0a16a');
 }
 function pose(c,actor,x,y,view,rig){
   const v=view==='W'?'E':view,face=view==='W'?-1:1;
   const body=bodyFor(actor,v,rig.walk,rig.frame||0);if(!body)return false;
   const out=buffer.getContext('2d');out.setTransform(1,0,0,1,0,0);out.clearRect(0,0,112,112);
   out.setTransform(2,0,0,2,56,100);out.imageSmoothingEnabled=false;
   out.save();out.scale(S,S);
   const cloth=OUTFIT[actor.type].coat||'#506e54';
   const look=lookOf({...actor,look:(actor.look>>>0)>=0x20000?actor.look:LOOK_POOL[(actor.look>>>0)%LOOK_POOL.length]}),skin=SKINS[look.skin%SKINS.length];
   const {near,far}=rig;
   sleeve(out,v==='S'?[4.1,-15]:[1.7,-15],far,cloth,true);
   out.drawImage(body,-PFX,-PFY,PW,PH);
   sleeve(out,v==='S'?[-4.1,-15]:[-3,-15],near,cloth);
   const style=dwarfWorkwear(actor);
   if(style)paintWorkwearShoulder(style,(px,py)=>[-3.2-px,-15+py],(p,color)=>poly(out,p,color));
   if(style&&v==='S')paintWorkwearShoulder(style,(px,py)=>[3.2+px,-15+py],(p,color)=>poly(out,p,color));
   if(rig.mode==='knife'){
     herbs(out,far[0],far[1]+6,.85);
     const end=[near[0]+6.5,near[1]+2.1];
     band(out,[near[0]-1.2,near[1]-.55],near,1.8,'#654a30');
     poly(out,[[near[0]+.5,near[1]-.8],[end[0]+.7,end[1]-.6],[end[0]+.2,end[1]+1],[near[0],near[1]+1]],'#344a45');
     poly(out,[[near[0]+1,near[1]-.3],[end[0]+.35,end[1]-.15],[end[0],end[1]+.6],[near[0]+.8,near[1]+.6]],'#8fa89b');
     band(out,[near[0]+1.2,near[1]+.6],[end[0]+.2,end[1]+.65],.65,'#e2e8cc');
     band(out,[near[0]+1,near[1]-.9],[near[0]+1.5,near[1]+1],.6,'#c0a36b');
   }else if(rig.mode==='stir'){
     const end=rig.end,dx=end[0]-near[0],dy=end[1]-near[1];
     band(out,[near[0]-dx*.12,near[1]-dy*.12],end,1.7,'#4c3828');
     band(out,[near[0]-dx*.12,near[1]-dy*.12],end,.65,'#b99a61');
     poly(out,[[end[0]-1,end[1]-.8],[end[0]+1.3,end[1]-.7],[end[0]+1.6,end[1]+1.1],[end[0]-.8,end[1]+1.3]],'#7e6741');
   }else if(rig.mode==='brush'){
     band(out,[near[0]-.5,near[1]],[near[0]+3.5,near[1]],1.5,'#9d7849');
     poly(out,[[near[0]+2.2,near[1]-1],[near[0]+7,near[1]-1],[near[0]+7,near[1]+1.4],[near[0]+2.2,near[1]+1.4]],'#4e3d2b');
     band(out,[near[0]+2.7,near[1]-.5],[near[0]+6.5,near[1]-.5],.65,'#c29b61');
     for(let i=0;i<6;i++)band(out,[near[0]+2.6+i*.75,near[1]+1.2],[near[0]+2.6+i*.75,near[1]+2.5],.55,i%2?'#e1d09a':'#ae9d68');
   }else if(rig.mode!=='empty')herbs(out,(near[0]+far[0])/2+1,(near[1]+far[1])/2+(rig.mode==='dry'?6.5:1),rig.mode==='feed'?1:.75);
   const angle=rig.mode==='stir'?Math.atan2(rig.end[0]-near[0],rig.end[1]-near[1]):rig.mode==='knife'?.95:0;
   fpaSowFist(out,far,angle,skin,true);fpaSowFist(out,near,angle,skin,false);
   out.restore();
   c.save();c.imageSmoothingEnabled=false;c.translate(x,y);c.scale(face,1);
   c.drawImage(buffer,-28,-50,56,56);c.restore();
   api.lastPose={type:actor.type,mode:rig.mode,x,y,face,near:[x+near[0]*S*face,y+near[1]*S],far:[x+far[0]*S*face,y+far[1]*S]};
   return true;
 }
 function healerRig(cyc,t){
   const swing=Math.sin(t*6),walk=(cyc>=6&&cyc<8)||(cyc>=11&&cyc<13)||cyc>=17;
   if(cyc<6)return{mode:'knife',near:[2.2+swing*.55,-11.2+swing*.35],far:[6.5,-14.8],frame:0};
   if(cyc<8)return{mode:'carry',walk,near:[.3,-11],far:[6,-12],frame:Math.floor(t*9)%WALK_FRAMES};
   if(cyc<11)return{mode:'dry',near:[-3.8,-19.5+Math.sin(t*4)*.55],far:[3.1,-18.5+Math.sin(t*4)*.55],frame:0};
   if(cyc<13||cyc>=17)return{mode:'return',walk,near:[-3.5+swing*.5,-8.5],far:[4,-10+swing*.3],frame:Math.floor(t*9)%WALK_FRAMES};
   const swirl=t*4,near=[2.5+Math.cos(swirl)*.5,-11.5+Math.sin(swirl)*.4],end=[19.2+Math.cos(swirl)*1.9,-15.4+Math.sin(swirl)*.7];
   const dx=end[0]-near[0],dy=end[1]-near[1],length=Math.hypot(dx,dy);
   return{mode:'stir',near,far:[near[0]+dx/length*6,near[1]+dy/length*6],end,frame:0};
 }
 function drawHealer(c,b,spr,ox,oy,px,py,view,cyc,t){
   if(!ready())return false;
   const worker=b.worker,actor={type:'healer',look:worker?.look??b.id*83+4,sx:worker?personSex(worker):''};
   const rig=healerRig(cyc,t);
   if(rig.mode==='return')return pose(c,actor,ox+px,oy+py,view,{...rig,mode:'empty'});
   return pose(c,actor,ox+px,oy+py,view,rig);
 }
 function stableLayout(b,spr){
   if(spr._careStation)return spr._careStation;
   if(spr._artBox)return fpaCareStableStation(spr,spr._artBox);
   const rect=spr.penRects?.[0];if(!rect)return null;
   const minX=Math.min(rect[0][0],rect[1][0]),maxX=Math.max(rect[0][0],rect[1][0]);
   const maxY=Math.max(rect[0][1],rect[1][1]),center=(minX+maxX)/2;
   // Keep the activity along the outside fence, away from the main entrance.
   const side=center>spr.padx+b.w*TILE*.5?1:-1;
   const trough=[side>0?maxX-5:minX+5,maxY+3];
   return{trough,foot:[trough[0]-side*5,trough[1]+4.5],face:side};
 }
 function drawStableYard(c,b,spr,ox,oy){
   if(!ready()||b.state!=='done'||!b.working)return false;
   const layout=stableLayout(b,spr);if(!layout)return false;
   const worker=b.worker,actor={type:'stableman',look:worker?.look??b.id*73+6,sx:worker?personSex(worker):''};
   const t=Game.time+b.id*3,cyc=((t%8)+8)%8,wave=Math.sin(t*5);
   const [x,y]=layout.trough;
   c.save();c.imageSmoothingEnabled=false;
   poly(c,[[ox+x-5,oy+y-4],[ox+x+5,oy+y-4],[ox+x+6,oy+y],[ox+x-5,oy+y+1]],'#3e3327');
   poly(c,[[ox+x-4,oy+y-3.3],[ox+x+4.6,oy+y-3.3],[ox+x+4.8,oy+y-1],[ox+x-4,oy+y-.5]],'#8e7047');
   band(c,[ox+x-4,oy+y-3.2],[ox+x+4.6,oy+y-3.2],.6,'#c0a779');
   if(cyc<4)for(let i=0;i<8;i++)band(c,[ox+x-3+i*.8,oy+y-2],[ox+x-2.5+i*.8,oy+y-3],.5,i%2?'#b4a56a':'#d0be78');
   c.restore();
   const rig=cyc<4?{mode:'feed',near:[2.1+wave*.4,-11.4-wave*.3],far:[6.5,-14.5]}
     :{mode:'brush',near:[2.1+wave*.55,-10.5+wave*.25],far:[6.2,-14.2]};
   return pose(c,actor,ox+layout.foot[0],oy+layout.foot[1],layout.face<0?'W':'E',rig);
 }
})();
