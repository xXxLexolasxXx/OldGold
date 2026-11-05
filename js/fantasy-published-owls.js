/* Roof owls: render-only replacement, preserving perch/flight/cargo state. */
'use strict';
(() => {
  if(window.FantasyPublishedOwls||typeof owlSprite!=='function')return;
  const before=owlSprite,cache=new Map();
  const ink='#554332',dark='#75543b',brown='#ab8052',warm='#cfab76',cream='#ecdbac';
  const shape=(c,p,col)=>poly(c,p,col,ink,.45);
  function face(c,x,y,look,blink,small=false){
    const k=small?.7:1;c.save();c.translate(x+look*.35,y);c.scale(k,k);
    shape(c,[[-3.3,-1],[-2,-2.8],[0,-2.2],[2,-2.8],[3.3,-1],[2.8,2],[0,3],[-2.8,2]],warm);
    for(const s of [-1,1]){
      ellipse(c,s*1.25,.1,1.55,1.75,cream);
      if(blink)naLimb(c,s*1.25-.65,.15,s*1.25+.65,.35,.45,ink);
      else{ellipse(c,s*1.25+look*.2,.15,.7,.85,'#514736');c.fillStyle='#fff1cb';c.fillRect(s*1.25-.25+look*.2,-.3,.35,.35);}
    }
    shape(c,[[-.5,1],[.5,1],[0,2.1]],'#b38c4d');c.restore();
  }
  owlSprite=function(kind,look=0,blink=false,frame=0){
    const fly=kind==='fly',key=[kind,look,!!blink,frame].join('|');if(cache.has(key))return cache.get(key);
    const w=fly?OWLF_W:OWL_W,h=fly?OWLF_H:OWL_H,cv=mkCanvas(w*2,h*2),c=cv.getContext('2d');
    c.scale(2,2);c.imageSmoothingEnabled=false;c.lineJoin='round';c.lineCap='round';c.translate(fly?OWLF_FX:OWL_FX,fly?OWLF_FY:OWL_FY);
    if(fly){
      const angle=(frame-10)/12*Math.PI*2;
      const phase=frame>=10?Math.cos(angle):[1,0,-1][frame]||0,lift=-phase*4;
      const sweep=frame>=10?Math.sin(angle)*.8:0;
      for(const s of [-1,1]){
        shape(c,[[s*2,-2],[s*7,-3+lift*.5],[s*(14+sweep),-2+lift],[s*(15+sweep),lift],[s*(13+sweep),lift+1],[s*13,lift+2],[s*10,lift+2.5],[s*7,3+lift*.4],[s*2,2]],brown);
        for(let k=0;k<4;k++)naLimb(c,s*(6+k*2),-1+lift*(.3+k*.16),s*(7+k*2),1+lift*(.3+k*.16),.6,k%2?dark:warm);
      }
      shape(c,[[-2,2],[2,2],[2,5],[0,6],[-2,5]],dark);ellipse(c,0,.5,2.6,3.7,brown);ellipse(c,0,1,1.7,2.8,warm);
      face(c,0,-3,0,false,true);
    }else{
      shape(c,[[-1.8,-2],[1.8,-2],[1,1],[-1,1]],dark);
      shape(c,[[-3.5,-8],[-2.4,-10],[2.4,-10],[3.5,-8],[3.7,-3],[2.4,-.7],[-2.4,-.7],[-3.7,-3]],brown);
      ellipse(c,0,-4.6,2.4,3.8,cream);
      for(const s of [-1,1]){
        shape(c,[[s*2.5,-8],[s*3.8,-7],[s*3.7,-2],[s*2.4,-1],[s*1.8,-4]],dark);
        for(let k=0;k<3;k++)naLimb(c,s*2.6,-6+k*1.4,s*3.2,-5.8+k*1.4,.5,warm);
        c.fillStyle='#ba955d';c.fillRect(s*1.2-.65,-.5,1.3,.7);
      }
      for(const [x,y] of [[-1,-6],[1,-5.5],[-.7,-4],[.8,-3]])naLimb(c,x,y,x+.15,y+.8,.5,'#ad8b61');
      face(c,0,-10,look,blink);
      shape(c,[[-3,-11],[-3.4,-13],[-1.5,-12]],brown);shape(c,[[3,-11],[3.4,-13],[1.5,-12]],brown);
    }
    cv.fine=2;cache.set(key,cv);return cv;
  };
  // Native 0.11.99 draw order, culling, prey/cargo, perches and 12-phase clock.
drawOwls=function(c) {
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = R.smooth; c.imageSmoothingQuality = 'low';
  for (const o of Game.owls || []) {
    if (o.state === 'grab') { drawOwlGrab(c, o); continue; }
    if (o.state === 'away') continue;
    const x = o.x, y = o.y;
    if (typeof onScreen === 'function' && !onScreen(x, y, 80)) continue;   // сова за краем экрана
    if (o.state === 'fly') {
      // тень скользит по земле под совой
      const gy = o.to[1] + (o.from[1] - o.to[1]) * (1 - o.f) + 34;
      c.fillStyle = 'rgba(10,8,4,0.18)'; c.beginPath(); c.ellipse(x, gy, 8, 2, 0, 0, 7); c.fill();
      const fr = 10 + (Math.floor(o.ph * 30) % 12);   // 12 кадров взмаха
      const spr = owlSprite('fly', 0, 0, fr);
      c.save(); c.translate(x, y); if (o.face < 0) c.scale(-1, 1);
      if (o.item) { c.save(); c.translate(0, 6); c.scale(0.4, 0.4); drawLoad(c, o.item); c.restore(); }
      afBlit(c, spr, -OWLF_FX, -OWLF_FY, OWLF_W, OWLF_H);
      c.restore();
      continue;
    }
    // сидит на крыше; принесённую вещь держит в лапах
    if (o.item) { c.save(); c.translate(x + 0.5, y + 0.6); c.scale(0.38, 0.38); drawLoad(c, o.item); c.restore(); }
    const spr = owlSprite('perch', o.look, o.blink > 0, 0);
    afBlit(c, spr, x - OWL_FX, y - OWL_FY, OWL_W, OWL_H);
  }
  // вещи, которые сова выронила, — падают на землю
  for (const f of Game.falling || []) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(0.45, 0.45); drawLoad(c, f.g); c.restore();
  }
  c.imageSmoothingEnabled = prev; c.imageSmoothingQuality = 'low';
};
  window.FantasyPublishedOwls={before,after:owlSprite,pixelRatio:2,flightPhases:12,legacyApproved:true};
})();
