'use strict';
// Fishing is a presentation of the native rod state. No unit, fun, job or
// timing fields are written here; the existing fishing generator owns them.
(() => {
  if (typeof window === 'undefined' || window.FantasyDwarfFishing) return;
  const bodies = new Map(), MAX_BODIES = 24;
  const snap = n => Math.round(n * 2) / 2;
  const mix = (a,b,t) => a + (b-a)*t;
  const ease = value => { const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t); };

  function pose(u,f,time=Game.time) {
    const dx=f.wx-u.x,dy=f.wy-u.y;
    const angle=Math.atan2(dy,dx),octant=((Math.round(angle/(Math.PI/4))+8)%8);
    const direction=['E','SE','S','SW','W','NW','N','NE'][octant];
    const profile=Math.abs(dx)>Math.abs(dy)*.45;
    const view=profile?'E':dy<0?'N':'S',face=profile?(dx<0?-1:1):1;
    const elapsed=Math.max(0,time-f.t0),cast=ease(elapsed/.8);
    const bite=f.bite>time,remaining=f.until-time;
    const biteTime=bite?Math.max(0,time-(f.bite-1.4)):0;
    const hook=bite?ease(biteTime/.22)*(1-.28*ease((biteTime-.7)/.7)):0;
    const reel=!bite&&remaining<2?ease((2-remaining)/.9):0;
    const lift=Math.max(hook,reel*.7),breathe=Math.sin(elapsed*2.4)*.18;
    let near,axis;
    if(profile){
      near=[1.4-lift*.4,-10.6-lift*.65+breathe];
      const a=mix(-1.1,-.89,cast)-lift*.3;
      axis=[Math.cos(a),Math.sin(a)];
    }else if(view==='N'){
      near=[-1,-10.2-lift*.6+breathe];
      const a=-1.15-lift*.2;
      axis=[Math.cos(a),Math.sin(a)];
    }else{
      near=[-1.2,-12-lift*.65+breathe];
      const a=.32-lift*.3;
      axis=[Math.cos(a),Math.sin(a)];
    }
    const spacing=profile?4.7:4.3;
    const far=[near[0]+axis[0]*spacing,near[1]+axis[1]*spacing];
    const butt=[near[0]-axis[0]*2.4,near[1]-axis[1]*2.4];
    const tip=[near[0]+axis[0]*22,near[1]+axis[1]*22];
    const bend=bite?1.35*(.7+.3*Math.sin(biteTime*15)):.35;
    const normal=[-axis[1],axis[0]];
    const bow=[mix(far[0],tip[0],.5)+normal[0]*bend,
      mix(far[1],tip[1],.5)+normal[1]*bend];
    return {view,face,direction,stage:cast<1?'cast':bite?'bite':reel?'reel':'wait',
      near,far,butt,tip,bow,axis,normal,lift,elapsed};
  }

  function bodyFor(actor,view,cloth) {
    const source=personSprite({...actor,carry:null,_exactYardPose:true},view,'idle',0,{posedWorkwearShoulder:'both'});
    if(!source?._fantasyAppearance)return null;
    if(bodies.has(source)){
      const body=bodies.get(source);bodies.delete(source);bodies.set(source,body);return body;
    }
    const body=mkCanvas(source.width,source.height),c=body.getContext('2d',{willReadFrequently:true});
    c.drawImage(source,0,0);
    fpaCleanAtlasArms(body,{...actor,carry:null},view,'yardGrip',0);
    // The profile atlas stores a tucked wrist inside the coat. Rebuild only
    // that sleeve strip, leaving the accepted cap, face and beard untouched.
    if(view==='E'){
      c.save();c.scale(body.width/PW,body.height/PH);c.translate(PFX,PFY);
      // The atlas profile retains a detached dark end of its old held prop
      // beyond the coat. It is outside the accepted beard/torso silhouette.
      c.clearRect(7,-14,6,10);
      c.clearRect(-13,-15,11,9);
      fpaSowPolygon(c,[[-5.5,-15],[-2,-15],[-2,-6],[-4.5,-6],[-5.5,-8]],'#352722');
      fpaSowPolygon(c,[[-4.5,-14.5],[-2,-14.5],[-2,-7],[-4,-7],[-5,-8.5]],shade(cloth,-.2));
      fpaSowPolygon(c,[[-4.5,-13],[-2,-13.5],[-2,-9],[-4,-9]],cloth);
      fpaSowBand(c,[-4.5,-8],[-2,-8],.7,'#715039');c.restore();
    }
    bodies.set(source,body);
    while(bodies.size>MAX_BODIES)bodies.delete(bodies.keys().next().value);
    return body;
  }

  function rod(c,rig) {
    const {near,butt,far,tip,bow,axis,normal}=rig;
    fpaSowBand(c,butt,far,1.65,'#352c21');
    fpaSowBand(c,butt,far,.8,'#bc965b');
    // A short sequence of half-pixel bands keeps the shaft on the same crisp
    // grid as the other tools while preserving a small load-dependent bend.
    let last=far;
    for(let i=1;i<=12;i++){
      const t=i/12,s=1-t,p=[s*s*far[0]+2*s*t*bow[0]+t*t*tip[0],
        s*s*far[1]+2*s*t*bow[1]+t*t*tip[1]];
      fpaSowBand(c,last,p,1.25,'#4a3a27');
      fpaSowBand(c,[last[0]-.2,last[1]-.2],[p[0]-.2,p[1]-.2],.5,'#c0a46d');last=p;
    }
    for(const depth of [-1.2,1.2]){
      const p=[near[0]+axis[0]*depth,near[1]+axis[1]*depth];
      fpaSowBand(c,[p[0]-normal[0]*1,p[1]-normal[1]*1],
        [p[0]+normal[0]*1,p[1]+normal[1]*1],.6,'#ba975d');
    }
    const reel=[butt[0]+normal[0]*1.3,butt[1]+normal[1]*1.3];
    fpaSowPolygon(c,[[reel[0]-1,reel[1]-.5],[reel[0]-.4,reel[1]-1.2],
      [reel[0]+.8,reel[1]-.9],[reel[0]+1.2,reel[1]+.3],
      [reel[0]+.3,reel[1]+1],[reel[0]-.8,reel[1]+.7]],'#61563b');
    fpaSowBand(c,[reel[0]-.5,reel[1]-.5],[reel[0]+.5,reel[1]+.5],.5,'#d0b67b');
  }

  function draw(c,u,f) {
    if(!f||f.k!=='rod'||f.until<=Game.time||u.inside||u.dead||u.carry)return false;
    if(u.brawl||u.burn?.stage||(typeof weatherPose==='function'&&weatherPose(u)))return false;
    const appearance=window.FantasyPublishedAppearanceArt;
    if(!appearance||typeof fpaWorkSleeve!=='function'||!FantasyPublishedArt.images['gnome-walk'])return false;
    const q=appearance.resolve(u),actor=q.holder,cloth=q.coat,skin=SKINS[q.L.skin%SKINS.length];
    const rig=pose(u,f),body=bodyFor(actor,rig.view,cloth);
    if(!body)return false;
    const px=Math.round(u.x*TILE),py=Math.round(u.y*TILE+6),{view,face,near,far,axis}=rig;
    const nearRoot=view==='E'?[-3.2,-15]:[-4.2,-15],farRoot=view==='E'?[1.5,-15.3]:[4.2,-15];
    const nearAngle=Math.atan2(axis[0],axis[1]);
    const farSleeve=()=>fpaWorkSleeve(c,farRoot,far,cloth,true);
    const nearSleeve=()=>fpaWorkSleeve(c,nearRoot,near,cloth,false);
    const hands=()=>{fpaSowFist(c,far,nearAngle,skin,true);fpaSowFist(c,near,nearAngle,skin,false);};
    c.save();c.imageSmoothingEnabled=false;c.translate(px,py);c.scale(face,1);
    c.fillStyle='rgba(14,24,12,.25)';c.beginPath();c.ellipse(0,0,7,1.7,0,0,Math.PI*2);c.fill();
    farSleeve();
    if(view==='N'){nearSleeve();rod(c,rig);hands();}
    c.drawImage(body,-PFX,-PFY,PW,PH);
    if(view!=='N'){nearSleeve();rod(c,rig);hands();}
    const wear=typeof dwarfWorkwear==='function'?dwarfWorkwear(actor):null;
    if(wear){
      paintWorkwearShoulder(wear,(x,y)=>[-3.2-x,-15+y],(points,col)=>fpaSowPolygon(c,points,col));
      if(view!=='E')paintWorkwearShoulder(wear,(x,y)=>[3.2+x,-15+y],(points,col)=>fpaSowPolygon(c,points,col));
    }
    c.restore();
    const tip=[px+rig.tip[0]*face,py+rig.tip[1]],bx=f.wx*TILE;
    const bitten=f.bite>Game.time;
    const by=f.wy*TILE+3+(bitten?Math.abs(Math.sin(Game.time*14))*1.5:Math.sin(Game.time*2)*.3);
    c.save();c.imageSmoothingEnabled=false;
    c.strokeStyle='rgba(228,229,201,.8)';c.lineWidth=.5;
    c.beginPath();c.moveTo(...tip);c.quadraticCurveTo((tip[0]+bx)/2,Math.max(tip[1],by)+4,bx,by);c.stroke();
    c.strokeStyle='rgba(213,236,222,.5)';c.lineWidth=.5;
    c.beginPath();c.ellipse(bx,by+.8,bitten?4:3,1.1,0,0,Math.PI*2);c.stroke();
    fpaSowPolygon(c,[[bx-1.2,by-.4],[bx-.7,by-1.5],[bx+.7,by-1.5],[bx+1.2,by-.4],
      [bx+.7,by+.8],[bx-.7,by+.8]],'#a54732');
    c.fillStyle='#f0dfbd';c.fillRect(snap(bx-.5),snap(by-.5),1,1);c.restore();
    return true;
  }

  window.FantasyDwarfFishing={version:1,draw,pose,get cacheSize(){return bodies.size;}};
  if(typeof FantasyPublishedArt!=='undefined')FantasyPublishedArt.ready.then(()=>bodies.clear());
})();
